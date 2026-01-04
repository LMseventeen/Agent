import * as readline from "readline";
import { graph } from "./graph.js";
import { loadEnv } from "./utils/env.js";
import type { GraphState } from "./types.js";

// 加载环境变量
loadEnv();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║    🎓 Learning Agent Interactive Session        ║");
  console.log("╚═══════════════════════════════════════════════════╝");
  console.log("\n💡 输入 'quit' 或 'exit' 退出");
  console.log("💡 输入 'status' 查看当前学习状态\n");

  // 初始化
  console.log("⏳ 正在初始化...\n");
  let state: GraphState = await graph.invoke({
    learningItems: {},
    activeItemId: null,
    lastUserInput: "",
    messages: [],
    nextAction: "guide",
  });

  console.log("🤖:", state.messages[state.messages.length - 1].content);
  console.log("");

  // 交互循环
  let round = 1;
  while (state.nextAction !== "end") {
    const userInput = await ask("👤 你: ");
    console.log(""); // 空行

    if (userInput.toLowerCase() === "quit" || userInput.toLowerCase() === "exit") {
      console.log("\n👋 再见！学习会话已结束。");
      break;
    }

    if (userInput.toLowerCase() === "status") {
      displayStatus(state);
      continue;
    }

    if (!userInput.trim()) {
      console.log("⚠️  请输入有效内容\n");
      continue;
    }

    // 显示处理进度
    console.log("⏳ 分析中...\n");

    try {
      // 调用图处理用户输入
      state = await graph.invoke({
        ...state,
        lastUserInput: userInput,
        messages: [
          ...state.messages,
          { role: "user", content: userInput },
        ],
      });

      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage && lastMessage.role === "assistant") {
        console.log("🤖:", lastMessage.content);
        console.log("");
      }

      // 显示简化的学习状态
      const activeItem = state.learningItems[state.activeItemId!];
      console.log(`📊 [轮次 ${round} | Level ${activeItem.currentLevel}/4 | ${getIntentName(activeItem.nextIntent)}]\n`);
      
      round++;
    } catch (error: any) {
      console.error("❌ 处理出错:", error.message);
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

/**
 * 显示当前学习状态
 */
function displayStatus(state: GraphState) {
  const activeItem = state.learningItems[state.activeItemId!];
  
  console.log("\n" + "=".repeat(50));
  console.log("📊 当前学习状态");
  console.log("=".repeat(50));
  console.log(`🎯 学习目标: ${activeItem.goal}`);
  console.log(`📈 认知层级: Level ${activeItem.currentLevel}/4 - ${getLevelName(activeItem.currentLevel)}`);
  console.log(`💭 认知状态: ${activeItem.cognitiveState.summary}`);
  console.log(`❓ 缺失部分: ${activeItem.cognitiveState.missingParts || "无"}`);
  console.log(`🎯 下一步意图: ${getIntentName(activeItem.nextIntent)}`);
  console.log(`📝 证据数量: ${activeItem.recentEvidence.length}`);
  console.log("=".repeat(50) + "\n");
}

/**
 * 显示最终总结
 */
function displayFinalSummary(state: GraphState) {
  const activeItem = state.learningItems[state.activeItemId!];
  
  console.log("📈 最终认知层级:", `Level ${activeItem.currentLevel}/4 - ${getLevelName(activeItem.currentLevel)}`);
  console.log("💭 最终状态:", activeItem.cognitiveState.summary);
  console.log("📝 交互轮次:", activeItem.recentEvidence.length);
  console.log("\n🎉 感谢参与学习！");
}

/**
 * 获取认知层级名称
 */
function getLevelName(level: number): string {
  const names: Record<number, string> = {
    1: "有直觉但说不清",
    2: "能描述但结构混乱",
    3: "能用清晰结构表达",
    4: "能迁移应用",
  };
  return names[level] || "未知";
}

/**
 * 获取教学意图名称
 */
function getIntentName(intent: string): string {
  const names: Record<string, string> = {
    elicit_intuition: "引导表达",
    force_clarification: "强迫说清",
    introduce_structure: "给出结构",
    test_transfer: "测试迁移",
  };
  return names[intent] || intent;
}

main().catch((error) => {
  console.error("\n❌ 致命错误:", error.message);
  console.error("\n请检查：");
  console.error("1. API Key 是否正确配置");
  console.error("2. 网络连接是否正常");
  console.error("3. API 服务是否可用");
  process.exit(1);
});

