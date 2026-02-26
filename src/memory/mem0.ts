/**
 * Mem0 记忆层封装
 *
 * - 若配置 MEM0_API_KEY：使用 Mem0 托管 API（官方 key），无需本地向量库。
 * - 否则：使用 mem0ai/oss 本地 Memory（需 OPENAI_API_KEY 或 Ollama）。
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

// 托管 API 返回格式
type HostedSearchResult = Array<{ memory?: string; data?: { memory?: string } }>;
// OSS Memory 类型
type OssMemoryInstance = {
  search(query: string, config: { userId?: string; limit?: number }): Promise<{ results: Array<{ memory?: string }> }>;
  add(messages: Array<{ role: string; content: string }>, config: { userId?: string }): Promise<unknown>;
};
// 托管 Client 类型（mem0ai 主包）
type HostedClient = {
  search(
    query: string,
    options?: { api_version?: string; user_id?: string; filters?: Record<string, unknown>; limit?: number }
  ): Promise<HostedSearchResult>;
  add(messages: Array<{ role: string; content: string }>, options?: { user_id?: string }): Promise<unknown>;
};

type MemoryBackend = { type: "hosted"; client: HostedClient } | { type: "oss"; client: OssMemoryInstance };

// ============================================================================
// 类型
// ============================================================================

export interface Mem0Message {
  role: "user" | "assistant";
  content: string;
}

// ============================================================================
// 单例（托管 或 本地 OSS）
// ============================================================================

let memoryBackend: MemoryBackend | null = null;

// ============================================================================
// 路径配置（环境变量可选覆盖）
// ============================================================================

/** 解析为绝对路径并确保所在目录存在；未配置则用默认相对路径 */
function resolveDbPath(envValue: string | undefined, defaultRelative: string): string {
  const raw = envValue?.trim();
  const fullPath = raw
    ? (raw.startsWith("/") || (process.platform === "win32" && /^[a-zA-Z]:\\/.test(raw))
        ? raw
        : join(process.cwd(), raw))
    : join(process.cwd(), defaultRelative);
  const parentDir = dirname(fullPath);
  if (parentDir && !existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }
  return fullPath;
}

/**
 * 构建 OSS Memory 配置
 *
 * 环境变量说明：
 * - 若设置 MEM0_EMBEDDER=ollama：embedding 走本地 Ollama，避免第三方 API key 在 search 时报 401
 *   （mem0ai 自带的 openai embedder 不会使用 baseURL，请求会发往 api.openai.com）
 * - 否则使用 openai embedder（需 OpenAI 官方 key，或兼容且支持 embedding 的 baseURL 服务）
 * - LLM 摘要始终用 OPENAI_API_KEY + OPENAI_API_BASE
 *
 * 路径：MEM0_VECTOR_DB_PATH、MEM0_HISTORY_DB_PATH
 */
function buildOssConfig(): Record<string, unknown> {
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const baseURL = process.env.OPENAI_API_BASE?.replace(/\/chat\/completions\/?$/i, "") ?? "https://api.openai.com/v1";
  const chatModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const vectorDbPath = resolveDbPath(process.env.MEM0_VECTOR_DB_PATH, "data/vector_store.db");
  const historyDbPath = resolveDbPath(process.env.MEM0_HISTORY_DB_PATH, "data/memory_history.db");

  const useOllamaEmbedder = process.env.MEM0_EMBEDDER?.toLowerCase() === "ollama";
  const ollamaUrl = process.env.MEM0_OLLAMA_URL?.trim() || "http://localhost:11434";
  const ollamaEmbedModel = process.env.MEM0_OLLAMA_EMBED_MODEL?.trim() || "nomic-embed-text";
  const ollamaEmbedDims = 768;

  const embedder = useOllamaEmbedder
    ? {
        provider: "ollama",
        config: {
          url: ollamaUrl,
          model: ollamaEmbedModel,
          embeddingDims: ollamaEmbedDims,
        },
      }
    : {
        provider: "openai",
        config: {
          apiKey,
          baseURL,
          model: process.env.MEM0_EMBEDDING_MODEL ?? "text-embedding-3-small",
          embeddingDims: 1536,
        },
      };

  const dimension = useOllamaEmbedder ? ollamaEmbedDims : 1536;

  return {
    version: "v1.1",
    disableHistory: false,
    embedder,
    vectorStore: {
      provider: "memory",
      config: {
        collectionName: "memories",
        dimension,
        dbPath: vectorDbPath,
      },
    },
    llm: {
      provider: "openai",
      config: {
        apiKey,
        baseURL,
        model: chatModel,
      },
    },
    historyStore: {
      provider: "sqlite",
      config: {
        historyDbPath,
      },
    },
  };
}

async function getMemory(): Promise<MemoryBackend | null> {
  if (memoryBackend !== null) {
    return memoryBackend;
  }

  const mem0ApiKey = process.env.MEM0_API_KEY?.trim();
  if (mem0ApiKey) {
    try {
      const Mem0 = await import("mem0ai");
      const Ctor = (Mem0 as unknown as { MemoryClient?: new (opts: { apiKey: string }) => HostedClient }).MemoryClient;
      if (typeof Ctor === "function") {
        memoryBackend = { type: "hosted", client: new Ctor({ apiKey: mem0ApiKey }) };
        return memoryBackend;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("  ⚠️ [Mem0] 初始化托管 API 失败:", message);
      return null;
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openaiKey) {
    console.log("  ℹ️ [Mem0] 未配置 MEM0_API_KEY 或 OPENAI_API_KEY，记忆层未启用");
    return null;
  }

  try {
    const Oss = await import("mem0ai/oss");
    const MemoryClass = (Oss as { Memory?: new (config?: Record<string, unknown>) => OssMemoryInstance }).Memory;
    if (typeof MemoryClass !== "function") {
      return null;
    }
    const config = buildOssConfig();
    memoryBackend = { type: "oss", client: new MemoryClass(config) as OssMemoryInstance };
    return memoryBackend;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("  ⚠️ [Mem0] 初始化本地 Memory 失败:", message);
    return null;
  }
}

// ============================================================================
// 公开 API
// ============================================================================

const DEFAULT_SEARCH_LIMIT = 5;

/**
 * 检索与当前查询相关的用户历史记忆
 */
export async function searchMemories(
  query: string,
  userId: string,
  limit: number = DEFAULT_SEARCH_LIMIT
): Promise<string[]> {
  const backend = await getMemory();
  if (!backend) {
    return [];
  }

  try {
    if (backend.type === "hosted") {
      const results = await backend.client.search(query, {
        api_version: "v2",
        user_id: userId,
        filters: { AND: [{ user_id: userId }] },
        limit,
      });
      const texts: string[] = [];
      for (const m of results ?? []) {
        const text = m.memory ?? (m.data && "memory" in m.data ? (m.data as { memory?: string }).memory : null);
        if (typeof text === "string" && text.trim()) {
          texts.push(text.trim());
        }
      }
      return texts;
    }
    const result = await backend.client.search(query, { userId, limit });
    const texts: string[] = [];
    for (const m of result.results ?? []) {
      const text = m.memory;
      if (typeof text === "string" && text.trim()) {
        texts.push(text.trim());
      }
    }
    return texts;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("  ⚠️ [Mem0] search 失败:", message);
    return [];
  }
}

/**
 * 将一轮对话写入本地记忆
 */
export async function addMemories(
  messages: Mem0Message[],
  userId: string
): Promise<void> {
  const backend = await getMemory();
  if (!backend) {
    return;
  }

  if (messages.length === 0) {
    return;
  }

  try {
    if (backend.type === "hosted") {
      await backend.client.add(messages, { user_id: userId });
    } else {
      await backend.client.add(messages, { userId });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("  ⚠️ [Mem0] add 失败:", message);
  }
}

/**
 * 是否已启用 Mem0（已配置 MEM0_API_KEY 或 OPENAI_API_KEY）
 */
export function isMem0Enabled(): boolean {
  return Boolean(process.env.MEM0_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
}
