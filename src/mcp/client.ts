/**
 * MCP 客户端
 *
 * 连接 MCP Server 并将工具转换为 LangChain 可用格式
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadMcpTools } from "@langchain/mcp-adapters";

import type { StructuredToolInterface } from "@langchain/core/tools";

// ============================================================================
// 类型定义
// ============================================================================

export interface McpConnection {
  client: Client;
  tools: StructuredToolInterface[];
  cleanup: () => Promise<void>;
}

// ============================================================================
// MCP 客户端管理
// ============================================================================

/**
 * 连接到本地 Quiz MCP Server
 */
export async function connectQuizServer(): Promise<McpConnection> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/mcp/quiz-server.ts"],
  });

  const client = new Client({
    name: "learning-agent",
    version: "1.0.0",
  });

  await client.connect(transport);

  // 转换为 LangChain 工具
  const tools = await loadMcpTools("quiz", client);

  return {
    client,
    tools,
    cleanup: async () => {
      await client.close();
    },
  };
}

/**
 * 直接调用 MCP 工具（不通过 LangChain）
 */
export async function callTool(
  client: Client,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const result = await client.callTool({
    name: toolName,
    arguments: args,
  });

  // 解析返回的文本内容
  const textContent = result.content.find((c) => c.type === "text");
  if (textContent && "text" in textContent) {
    try {
      return JSON.parse(textContent.text);
    } catch {
      return textContent.text;
    }
  }

  return result.content;
}
