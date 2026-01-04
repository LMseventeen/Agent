import { graph } from "./graph.js";
import { loadEnv } from "./utils/env.js";

// 加载环境变量
loadEnv();

async function main() {
  console.log("🚀 Learning Agent 启动\n");

  // Round 1: 初始化
  console.log("=== Round 1: 初始化 ===");
  let state = await graph.invoke({
    learningItems: {},
    activeItemId: null,
    lastUserInput: "",
    messages: [],
    nextAction: "guide",
  });

  console.log("\n📤 Agent:", state.messages[state.messages.length - 1].content);
  console.log("\n当前 State:", {
    activeItemId: state.activeItemId,
    itemCount: Object.keys(state.learningItems).length,
  });

  // Round 2: 模拟用户回答
  console.log("\n\n=== Round 2: 用户回答 ===");
  const userInput1 = "State 是用来记录图的状态信息的";
  console.log("👤 User:", userInput1);

  // 重要：需要手动进入 assess 节点处理用户输入
  // 因为 graph 在 guide 后会结束等待用户输入
  // 这里我们需要重新调用，但从 assess 开始
  
  // 方式1：直接调用 assess 节点（手动）
  const { assessNode } = await import("./nodes/assess.js");
  const { decideNode } = await import("./nodes/decide.js");
  
  // 更新 state
  state = {
    ...state,
    lastUserInput: userInput1,
    messages: [
      ...state.messages,
      { role: "user", content: userInput1 },
    ],
  };

  // 执行 assess
  const assessUpdate = await assessNode(state);
  state = { ...state, ...assessUpdate };

  // 执行 decide
  const decideUpdate = decideNode(state);
  state = { ...state, ...decideUpdate };

  // 如果需要继续引导，执行 guide
  if (state.nextAction === "guide") {
    const { guideNode } = await import("./nodes/guide.js");
    const guideUpdate = await guideNode(state);
    state = { ...state, ...guideUpdate };
    
    console.log("\n📤 Agent:", state.messages[state.messages.length - 1].content);
  }

  console.log("\n当前认知状态:");
  const activeItem = state.learningItems[state.activeItemId!];
  console.log(`  Level: ${activeItem.currentLevel}`);
  console.log(`  Next Intent: ${activeItem.nextIntent}`);
  console.log(`  Evidence Count: ${activeItem.recentEvidence.length}`);
}

main().catch(console.error);

