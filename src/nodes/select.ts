/**
 * selectItemNode - 选择或创建 LearningItem
 *
 * 职责：
 * - 如果已有 activeItem，直接返回
 * - 否则创建新的 LearningItem
 */
import type { GraphState, LearningItem } from "../types.js";
import { CognitiveLevel, AWAITING_TOPIC_GOAL } from "../types.js";

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 生成唯一的学习项 ID
 */
function generateItemId(): string {
  return `item_${Date.now()}`;
}

/**
 * 创建新的 LearningItem
 */
function createNewLearningItem(id: string): LearningItem {
  return {
    id,
    goal: AWAITING_TOPIC_GOAL,
    currentLevel: CognitiveLevel.IntuitionOnly,
    cognitiveState: {
      summary: "尚未开始评估",
      missingParts: "所有内容",
    },
    recentEvidence: [],
    nextIntent: "elicit_intuition",
    status: { phase: "awaiting_topic" },
  };
}

// ============================================================================
// 节点函数
// ============================================================================

/**
 * selectItemNode - 选择或创建 LearningItem
 *
 * @param state - 当前图状态
 * @param _config - 可选的运行配置（LangGraph 规范）
 * @returns 更新后的部分状态
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

  // 创建新的 LearningItem
  const newItemId = generateItemId();
  const newItem = createNewLearningItem(newItemId);

  console.log(`✅ [selectItemNode] 创建新项: ${newItemId}`);

  return {
    activeItemId: newItemId,
    learningItems: { [newItemId]: newItem },
  };
}
