/**
 * decideNode - 决定下一步流向
 *
 * 职责：
 * - 根据 LearningItem 状态决定是继续引导还是结束
 * - 返回 nextAction 供条件边使用
 */

import type { GraphState } from "../types.js";
import { CognitiveLevel } from "../types.js";

// ============================================================================
// 节点函数
// ============================================================================

/**
 * decideNode - 决定下一步流向
 *
 * @param state - 当前图状态
 * @param _config - 可选的运行配置（LangGraph 规范）
 * @returns 更新后的部分状态
 */
export function decideNode(state: GraphState): Partial<GraphState> {
  console.log("🟣 [decideNode] 开始执行");

  const activeItemId = state.activeItemId;
  if (!activeItemId) {
    console.log("⚠️ [decideNode] 没有活动项，结束会话");
    return { nextAction: "end" };
  }

  const activeItem = state.learningItems[activeItemId];
  if (!activeItem) {
    console.log(`⚠️ [decideNode] 找不到学习项: ${activeItemId}，结束会话`);
    return { nextAction: "end" };
  }

  const evidenceCount = activeItem.recentEvidence.length;

  // 结束条件：达到高认知层级
  if (activeItem.currentLevel >= CognitiveLevel.Transferable) {
    console.log("✅ [decideNode] 学生已达到迁移理解，结束会话");
    return { nextAction: "end" };
  }

  // 继续引导
  console.log(
    `✅ [decideNode] 继续引导 (轮次: ${evidenceCount}, Level: ${activeItem.currentLevel})`
  );
  return { nextAction: "guide" };
}
