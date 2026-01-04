/**
 * 教学阶段检测器
 *
 * 根据 LearningItem 状态判断当前应该处于哪个教学阶段
 */
import type { LearningItem } from "../types.js";
import { CognitiveLevel, TeachingPhase } from "../types.js";

// ============================================================================
// 常量
// ============================================================================

/**
 * 信息收集阶段的最大证据数
 */
const INFO_COLLECTION_MAX_EVIDENCE = 2;

/**
 * 理解引导阶段的最大证据数
 */
const UNDERSTANDING_MAX_EVIDENCE = 3;

/**
 * 判断目标是否足够具体的最小长度
 */
const SPECIFIC_GOAL_MIN_LENGTH = 20;

// ============================================================================
// 映射表
// ============================================================================

/**
 * 认知层级 -> 教学阶段 映射（基础映射）
 */
const LEVEL_TO_PHASE_MAP: Record<CognitiveLevel, TeachingPhase> = {
  [CognitiveLevel.IntuitionOnly]: TeachingPhase.UnderstandingElicitation,
  [CognitiveLevel.CanDescribe]: TeachingPhase.Structured,
  [CognitiveLevel.Structured]: TeachingPhase.Transfer,
  [CognitiveLevel.Transferable]: TeachingPhase.Transfer,
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检查学习项状态是否表明已收集基础信息
 */
function hasBasicInfoFromStatus(item: LearningItem): boolean {
  switch (item.status.phase) {
    case "awaiting_topic":
      return false;
    case "collecting_info":
    case "learning":
      return item.status.hasBasicInfo;
    default: {
      // 穷尽检查 - 确保所有分支都被处理
      const exhaustiveCheck: never = item.status;
      throw new Error(`Unhandled status: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

/**
 * 判断目标是否足够具体
 */
function isGoalSpecific(goal: string): boolean {
  return (
    goal.length > SPECIFIC_GOAL_MIN_LENGTH &&
    !goal.includes("等待") &&
    (goal.includes("的") || goal.includes("课"))
  );
}

// ============================================================================
// 主函数
// ============================================================================

/**
 * 判断当前应该处于哪个教学阶段
 *
 * @param item - 当前学习项
 * @returns 教学阶段
 */
export function determineTeachingPhase(item: LearningItem): TeachingPhase {
  const evidenceCount = item.recentEvidence.length;

  // 阶段 1: 信息收集（首轮或信息不足）
  if (!hasBasicInfoFromStatus(item) && evidenceCount <= INFO_COLLECTION_MAX_EVIDENCE) {
    return TeachingPhase.InfoCollection;
  }

  // Level 1 特殊处理：根据证据数决定是理解引导还是澄清
  if (item.currentLevel === CognitiveLevel.IntuitionOnly) {
    return evidenceCount <= UNDERSTANDING_MAX_EVIDENCE
      ? TeachingPhase.UnderstandingElicitation
      : TeachingPhase.Clarification;
  }

  // 其他 Level：使用映射表
  return LEVEL_TO_PHASE_MAP[item.currentLevel];
}

/**
 * 检查是否已收集到基础信息
 *
 * @param item - 当前学习项
 * @returns 是否已收集基础信息
 */
export function hasCollectedBasicInfo(item: LearningItem): boolean {
  // 优先使用状态中的标记
  if (hasBasicInfoFromStatus(item)) {
    return true;
  }

  // 启发式判断：如果学习目标很具体且证据数 >= 2，认为已收集
  return isGoalSpecific(item.goal) && item.recentEvidence.length >= 2;
}

