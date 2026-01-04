import { LearningItem, GraphState, CognitiveLevel } from "../types.js";

/**
 * selectItemNode - 选择或创建 LearningItem
 * 
 * 职责：
 * - 如果已有 activeItem，直接返回
 * - 否则创建新的 LearningItem
 */
export async function selectItemNode(
  state: GraphState
): Promise<Partial<GraphState>> {
  console.log("🔵 [selectItemNode] 开始执行");

  // 如果已有 activeItem，直接返回
  if (state.activeItemId && state.learningItems[state.activeItemId]) {
    console.log("✅ [selectItemNode] 已有活动项，跳过创建");
    return {};
  }

  // 创建新的 LearningItem（初始 goal 为通用提示，待用户输入后动态设置）
  const newItemId = `item_${Date.now()}`;
  const newItem: LearningItem = {
    id: newItemId,
    goal: "等待用户提出学习主题",
    currentLevel: CognitiveLevel.IntuitionOnly,
    cognitiveState: {
      summary: "尚未开始评估",
      missingParts: "所有内容",
    },
    recentEvidence: [],
    nextIntent: "elicit_intuition",
  };

  console.log(`✅ [selectItemNode] 创建新项: ${newItemId}`);

  return {
    activeItemId: newItemId,
    learningItems: { [newItemId]: newItem },
  };
}

