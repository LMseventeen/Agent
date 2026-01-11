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

    // 列出主题
    console.log("\n\n=== 列出可用主题 ===\n");
    const topics = await callTool(client, "list_topics", {});
    console.log("📚 主题信息:", topics);

    // LLM 生成选择题
    console.log("\n\n=== LLM 生成选择题 ===\n");
    const choiceQ = await callTool(client, "generate_quiz", {
      topic: "TypeScript 泛型",
      difficulty: "medium",
      type: "choice",
    });
    console.log("📝 生成的选择题:", choiceQ);

    // LLM 生成填空题
    console.log("\n\n=== LLM 生成填空题 ===\n");
    const fillQ = await callTool(client, "generate_quiz", {
      topic: "React Hooks",
      difficulty: "easy",
      type: "fill",
    });
    console.log("📝 生成的填空题:", fillQ);

    // 验证选择题答案
    if (choiceQ && typeof choiceQ === "object" && "question" in choiceQ) {
      console.log("\n\n=== 验证答案 ===\n");
      const q = choiceQ as { question: string; answer: string };
      const result = await callTool(client, "check_answer", {
        question: q.question,
        correctAnswer: q.answer,
        userAnswer: "A",
        questionType: "choice",
      });
      console.log("✅ 答案验证:", result);
    }

  } finally {
    await cleanup();
    console.log("\n\n🔌 已断开连接");
  }
}

main().catch(console.error);
