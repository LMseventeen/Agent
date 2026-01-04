/**
 * Learning Agent 入口文件
 *
 * 演示基本的教学流程
 */
import { graph, createInitialState } from "./graph.js";
import { loadEnv } from "./utils/env.js";

import type { GraphState, Message } from "./types.js";

// 加载环境变量
loadEnv();

// ============================================================================
// 常量
// ============================================================================

const DEMO_USER_INPUT = "State 是用来记录图的状态信息的";

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取最后一条助手消息
 */
function getLastAssistantMessage(state: GraphState): string | null {
  const messages = state.messages;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg && msg.role === "assistant") {
      return msg.content;
    }
  }
  return null;
}

/**
 * 显示状态摘要
 */
function displayStateSummary(state: GraphState): void {
  console.log("\n当前 State:", {
    activeItemId: state.activeItemId,
    itemCount: Object.keys(state.learningItems).length,
  });
}

/**
 * 显示认知状态
 */
function displayCognitiveState(state: GraphState): void {
  if (!state.activeItemId) return;

  const activeItem = state.learningItems[state.activeItemId];
  if (!activeItem) return;

  console.log("\n当前认知状态:");
  console.log(`  Level: ${activeItem.currentLevel}`);
  console.log(`  Next Intent: ${activeItem.nextIntent}`);
  console.log(`  Evidence Count: ${activeItem.recentEvidence.length}`);
}

// ============================================================================
// 主函数
// ============================================================================

async function main(): Promise<void> {
  console.log("🚀 Learning Agent 启动\n");

  // Round 1: 初始化
  console.log("=== Round 1: 初始化 ===");
  let state = await graph.invoke(createInitialState());

  const firstMessage = getLastAssistantMessage(state);
  if (firstMessage) {
    console.log("\n📤 Agent:", firstMessage);
  }
  displayStateSummary(state);

  // Round 2: 模拟用户回答
  console.log("\n\n=== Round 2: 用户回答 ===");
  console.log("👤 User:", DEMO_USER_INPUT);

  // 添加用户消息并重新调用图
  const userMessage: Message = { role: "user", content: DEMO_USER_INPUT };
  state = await graph.invoke({
    ...state,
    lastUserInput: DEMO_USER_INPUT,
    messages: [...state.messages, userMessage],
  });

  const secondMessage = getLastAssistantMessage(state);
  if (secondMessage) {
    console.log("\n📤 Agent:", secondMessage);
  }
  displayCognitiveState(state);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("❌ 致命错误:", message);
  process.exit(1);
});
