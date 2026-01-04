import { GraphState, CognitiveLevel } from "../types.js";

/**
 * decideNode - 决定下一步流向
 * 
 * 职责：
 * - 根据 LearningItem 状态决定是继续引导还是结束
 * - 返回 nextAction 供条件边使用
 */
export function decideNode(
  state: GraphState
): Partial<GraphState> {
  console.log("🟣 [decideNode] 开始执行");

  const activeItem = state.learningItems[state.activeItemId!];
  const evidenceCount = activeItem.recentEvidence.length;

  // 结束条件 : 达到高认知层级
  if (activeItem.currentLevel >= CognitiveLevel.Transferable) {
    console.log("✅ [decideNode] 学生已达到迁移理解，结束会话");
    return { nextAction: "end" };
  }

  // 继续引导
  console.log(`✅ [decideNode] 继续引导 (轮次: ${evidenceCount}, Level: ${activeItem.currentLevel})`);
  return { nextAction: "guide" };
}

