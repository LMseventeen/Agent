/**
 * MCP 工具调用演示
 *
 * 展示如何连接 Quiz MCP Server 并调用出题工具
 */
import { connectQuizServer, callTool } from "./mcp/index.js";
import { loadEnv } from "./utils/env.js";

loadEnv();

async function main() {
  console.log("🔌 连接 Quiz MCP Server...\n");

  const { client, tools, cleanup } = await connectQuizServer();

  try {
    // 显示可用工具
    console.log("📦 可用工具:");
    tools.forEach((tool) => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    // 方式一：直接调用 MCP 工具
    console.log("\n\n=== 方式一：直接调用 MCP ===\n");

    // 列出主题
    const topics = await callTool(client, "list_topics", {});
    console.log("📚 可用主题:", topics);

    // 生成一道题
    const question = await callTool(client, "generate_quiz", {
      topic: "langgraph",
      difficulty: "easy",
    });
    console.log("\n📝 生成的题目:", question);

    // 验证答案
    if (question && typeof question === "object" && "id" in question) {
      const result = await callTool(client, "check_answer", {
        questionId: (question as { id: string }).id,
        userAnswer: "A",
      });
      console.log("\n✅ 答案验证:", result);
    }

    // 方式二：通过 LangChain 工具调用
    console.log("\n\n=== 方式二：通过 LangChain 工具 ===\n");

    const listTopicsTool = tools.find((t) => t.name === "quiz_list_topics");
    if (listTopicsTool) {
      const result = await listTopicsTool.invoke({});
      console.log("📚 LangChain 调用结果:", result);
    }

    const generateQuizTool = tools.find((t) => t.name === "quiz_generate_quiz");
    if (generateQuizTool) {
      const result = await generateQuizTool.invoke({
        topic: "mcp",
        difficulty: "easy",
      });
      console.log("\n📝 LangChain 生成题目:", result);
    }
  } finally {
    await cleanup();
    console.log("\n\n🔌 已断开连接");
  }
}

main().catch(console.error);
