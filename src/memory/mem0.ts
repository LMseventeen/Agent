/**
 * Mem0 记忆层封装
 *
 * - 若配置 MEM0_API_KEY：使用 Mem0 托管 API（官方 key），无需本地向量库。
 * - 否则：使用 mem0ai/oss 本地 Memory（需 OPENAI_API_KEY 或 Ollama）。
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

// 托管 API 返回格式（可能带 metadata）
type HostedSearchResult = Array<{
  memory?: string;
  data?: { memory?: string };
  metadata?: Record<string, unknown>;
}>;
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
  add(
    messages: Array<{ role: string; content: string }>,
    options?: {
      user_id?: string;
      metadata?: Record<string, unknown>;
      custom_instructions?: string;
    }
  ): Promise<unknown>;
};

type MemoryBackend = { type: "hosted"; client: HostedClient } | { type: "oss"; client: OssMemoryInstance };

// ============================================================================
// 类型
// ============================================================================

export interface Mem0Message {
  role: "user" | "assistant";
  content: string;
}

/** 写入记忆时的可选参数：metadata 可用于过滤，custom_instructions 可指定摘要语言等 */
export interface AddMemoryOptions {
  metadata?: Record<string, string | number | boolean>;
  custom_instructions?: string;
}

/** 检索记忆时的可选过滤条件 */
export interface SearchMemoryOptions {
  limit?: number;
  metadata?: Record<string, unknown>;
  categories?: string[];
}

/** 单条检索结果：记忆文本与可选 metadata */
export interface SearchMemoryItem {
  text: string;
  metadata?: Record<string, unknown>;
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
 * 构建检索 filters：user_id 必选，可叠加 metadata、categories 等过滤
 */
function buildSearchFilters(
  userId: string,
  options?: SearchMemoryOptions
): Record<string, unknown> {
  const andClauses: Record<string, unknown>[] = [{ user_id: userId }];
  if (options?.metadata && Object.keys(options.metadata).length > 0) {
    andClauses.push({ metadata: options.metadata });
  }
  if (options?.categories && options.categories.length > 0) {
    andClauses.push({ categories: { in: options.categories } });
  }
  return { AND: andClauses };
}

/**
 * 检索与当前查询相关的用户历史记忆
 *
 * @param options - 可选 limit、metadata、categories 等过滤
 * @returns 每条包含 text 与可选 metadata
 */
export async function searchMemories(
  query: string,
  userId: string,
  options?: SearchMemoryOptions | number
): Promise<SearchMemoryItem[]> {
  const limit = typeof options === "number" ? options : options?.limit ?? DEFAULT_SEARCH_LIMIT;
  const opts = typeof options === "number" ? undefined : options;

  const backend = await getMemory();
  if (!backend) {
    return [];
  }

  try {
    if (backend.type === "hosted") {
      const filters = buildSearchFilters(userId, opts);
      const results = await backend.client.search(query, {
        api_version: "v2",
        user_id: userId,
        filters,
        limit,
      });
      const items: SearchMemoryItem[] = [];
      for (const m of results ?? []) {
        const text = m.memory ?? (m.data && "memory" in m.data ? (m.data as { memory?: string }).memory : null);
        if (typeof text === "string" && text.trim()) {
          items.push({
            text: text.trim(),
            metadata: m.metadata as Record<string, unknown> | undefined,
          });
        }
      }
      return items;
    }
    const result = await backend.client.search(query, { userId, limit: limit as number });
    const items: SearchMemoryItem[] = [];
    for (const m of result.results ?? []) {
      const text = m.memory;
      if (typeof text === "string" && text.trim()) {
        items.push({ text: text.trim() });
      }
    }
    return items;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("  ⚠️ [Mem0] search 失败:", message);
    return [];
  }
}

/**
 * 将一轮对话写入记忆
 *
 * @param options - 可选 metadata、custom_instructions（如「用中文总结」）
 *   - 若未传 custom_instructions，会使用环境变量 MEM0_CUSTOM_INSTRUCTIONS（若有）
 */
export async function addMemories(
  messages: Mem0Message[],
  userId: string,
  options?: AddMemoryOptions
): Promise<void> {
  const backend = await getMemory();
  if (!backend) {
    return;
  }

  if (messages.length === 0) {
    return;
  }

  const customInstructions =
    options?.custom_instructions ?? process.env.MEM0_CUSTOM_INSTRUCTIONS?.trim();

  try {
    if (backend.type === "hosted") {
      await backend.client.add(messages, {
        user_id: userId,
        metadata: options?.metadata,
        ...(customInstructions ? { custom_instructions: customInstructions } : {}),
      });
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
