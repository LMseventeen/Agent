/**
 * Learning Agent 交互式会话
 *
 * 提供命令行交互界面，支持实时教学对话
 */
import * as readline from "node:readline";

import { graph, createInitialState } from "./graph.js";
import { loadEnv } from "./utils/env.js";

import type { GraphState, Message, CognitiveLevel, TeachingIntent } from "./types.js";

// ============================================================================
// 常量
// ============================================================================

const EXIT_COMMANDS = ["quit", "exit"];
const STATUS_COMMAND = "status";

// ============================================================================
// 显示名称映射
// ============================================================================

/**
 * 认知层级显示名称
 */
const LEVEL_NAMES: Record<CognitiveLevel, string> = {
  1: "有直觉但说不清",
  2: "能描述但结构混乱",
  3: "能用清晰结构表达",
  4: "能迁移应用",
};

/**
 * 教学意图显示名称
 */
const INTENT_NAMES: Record<TeachingIntent, string> = {
  elicit_intuition: "引导表达",
  force_clarification: "强迫说清",
  introduce_structure: "给出结构",
  test_transfer: "测试迁移",
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取认知层级名称
 */
function getLevelName(level: CognitiveLevel): string {
  return LEVEL_NAMES[level] ?? "未知";
}

/**
 * 获取教学意图名称
 */
function getIntentName(intent: TeachingIntent): string {
  return INTENT_NAMES[intent] ?? intent;
}

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
 * 显示当前学习状态
 */
function displayStatus(state: GraphState): void {
  if (!state.activeItemId) {
    console.log("\n⚠️ 暂无活动的学习项\n");
    return;
  }

  const activeItem = state.learningItems[state.activeItemId];
  if (!activeItem) {
    console.log("\n⚠️ 找不到学习项\n");
    return;
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 当前学习状态");
  console.log("=".repeat(50));
  console.log(`🎯 学习目标: ${activeItem.goal}`);
  console.log(
    `📈 认知层级: Level ${activeItem.currentLevel}/4 - ${getLevelName(activeItem.currentLevel)}`
  );
  console.log(`💭 认知状态: ${activeItem.cognitiveState.summary}`);
  console.log(`❓ 缺失部分: ${activeItem.cognitiveState.missingParts ?? "无"}`);
  console.log(`🎯 下一步意图: ${getIntentName(activeItem.nextIntent)}`);
  console.log(`📝 证据数量: ${activeItem.recentEvidence.length}`);
  console.log("=".repeat(50) + "\n");
}

/**
 * 显示最终总结
 */
function displayFinalSummary(state: GraphState): void {
  if (!state.activeItemId) return;

  const activeItem = state.learningItems[state.activeItemId];
  if (!activeItem) return;

  console.log(
    "📈 最终认知层级:",
    `Level ${activeItem.currentLevel}/4 - ${getLevelName(activeItem.currentLevel)}`
  );
  console.log("💭 最终状态:", activeItem.cognitiveState.summary);
  console.log("📝 交互轮次:", activeItem.recentEvidence.length);
  console.log("\n🎉 感谢参与学习！");
}

/**
 * 显示简化的进度指示
 */
function displayProgress(state: GraphState, round: number): void {
  if (!state.activeItemId) return;

  const activeItem = state.learningItems[state.activeItemId];
  if (!activeItem) return;

  console.log(
    `📊 [轮次 ${round} | Level ${activeItem.currentLevel}/4 | ${getIntentName(activeItem.nextIntent)}]\n`
  );
}

// ============================================================================
// 主函数
// ============================================================================

async function main(): Promise<void> {
  // 加载环境变量
  loadEnv();

  // 创建 readline 接口
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> => {
    return new Promise((resolve) => rl.question(question, resolve));
  };

  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║    🎓 Learning Agent Interactive Session        ║");
  console.log("╚═══════════════════════════════════════════════════╝");
  console.log("\n💡 输入 'quit' 或 'exit' 退出");
  console.log("💡 输入 'status' 查看当前学习状态\n");

  // 初始化
  console.log("⏳ 正在初始化...\n");
  let state: GraphState = await graph.invoke(createInitialState());

  const firstMessage = getLastAssistantMessage(state);
  if (firstMessage) {
    console.log("🤖:", firstMessage);
    console.log("");
  }

  // 交互循环
  let round = 1;
  while (state.nextAction !== "end") {
    const userInput = await ask("👤 你: ");
    console.log(""); // 空行

    // 检查退出命令
    if (EXIT_COMMANDS.includes(userInput.toLowerCase())) {
      console.log("\n👋 再见！学习会话已结束。");
      break;
    }

    // 检查状态命令
    if (userInput.toLowerCase() === STATUS_COMMAND) {
      displayStatus(state);
      continue;
    }

    // 检查空输入
    if (!userInput.trim()) {
      console.log("⚠️  请输入有效内容\n");
      continue;
    }

    // 显示处理进度
    console.log("⏳ 分析中...\n");

    try {
      // 添加用户消息并调用图
      const userMessage: Message = { role: "user", content: userInput };
      state = await graph.invoke({
        ...state,
        lastUserInput: userInput,
        messages: [...state.messages, userMessage],
      });

      const lastMessage = getLastAssistantMessage(state);
      if (lastMessage) {
        console.log("🤖:", lastMessage);
        console.log("");
      }

      // 显示进度
      displayProgress(state, round);
      round++;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("❌ 处理出错:", message);
      console.log("请重试\n");
    }
  }

  // 显示最终总结
  if (state.nextAction === "end") {
    console.log("\n" + "=".repeat(50));
    console.log("✅ 学习会话完成！");
    console.log("=".repeat(50) + "\n");
    displayFinalSummary(state);
  }

  rl.close();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("\n❌ 致命错误:", message);
  console.error("\n请检查：");
  console.error("1. API Key 是否正确配置");
  console.error("2. 网络连接是否正常");
  console.error("3. API 服务是否可用");
  process.exit(1);
});
