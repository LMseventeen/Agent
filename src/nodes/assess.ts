/**
 * assessNode - 评估学生输入
 *
 * 职责：
 * - 评估用户回答的认知层级
 * - 更新 LearningItem 的认知状态
 * - 决定下一步教学意图
 */
import type {
  GraphState,
  LearningItem,
  CognitiveStateLabel,
  TeachingDecision,
  Evidence,
} from "../types.js";
import {
  CognitiveLevel,
  MAX_EVIDENCE_COUNT,
  AWAITING_TOPIC_GOAL,
} from "../types.js";
import { llmBasedAssessment } from "../assessment/llm.js";
import { extractLearningGoal } from "../utils/goal-extractor.js";
import { hasCollectedBasicInfo } from "../utils/phase-detector.js";

// ============================================================================
// 映射表（代替 if-else 链）
// ============================================================================

/**
 * 认知状态 -> 教学决策 映射
 * 根据当前认知状态和层级决定下一步
 */
const TEACHING_DECISION_MAP: Record<
  CognitiveStateLabel,
  (currentLevel: CognitiveLevel) => TeachingDecision
> = {
  too_vague: () => ({
    nextIntent: "elicit_intuition",
    newLevel: CognitiveLevel.IntuitionOnly,
  }),

  intuition_but_unclear: (currentLevel) => ({
    nextIntent:
      currentLevel === CognitiveLevel.IntuitionOnly
        ? "force_clarification"
        : "elicit_intuition",
    newLevel: CognitiveLevel.IntuitionOnly,
  }),

  can_describe_with_structure: () => ({
    nextIntent: "introduce_structure",
    newLevel: CognitiveLevel.CanDescribe,
  }),

  fully_structured: () => ({
    nextIntent: "test_transfer",
    newLevel: CognitiveLevel.Structured,
  }),

  transferable: () => ({
    nextIntent: "test_transfer",
    newLevel: CognitiveLevel.Transferable,
  }),
};

/**
 * 认知状态 -> 缺失部分 映射
 */
const MISSING_PARTS_MAP: Record<CognitiveStateLabel, string> = {
  too_vague: "需要更具体的表达",
  intuition_but_unclear: "核心概念边界、为什么不可或缺",
  can_describe_with_structure: "具体机制和实现细节",
  fully_structured: "实际应用场景和最佳实践",
  transferable: "无",
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 根据认知状态决定下一步教学决策
 */
function determineTeachingDecision(
  cognitiveState: CognitiveStateLabel,
  currentLevel: CognitiveLevel
): TeachingDecision {
  const decisionFn = TEACHING_DECISION_MAP[cognitiveState];
  return decisionFn(currentLevel);
}

/**
 * 创建新的证据记录
 */
function createEvidence(content: string): Evidence {
  return {
    source: "user_input",
    content,
    timestamp: Date.now(),
  };
}

/**
 * 追加证据并保持数量限制
 */
function appendEvidence(
  existing: readonly Evidence[],
  newEvidence: Evidence
): readonly Evidence[] {
  return [...existing, newEvidence].slice(-MAX_EVIDENCE_COUNT);
}

/**
 * 处理首次输入：提取学习目标
 */
async function handleFirstInput(
  activeItem: LearningItem,
  userAnswer: string
): Promise<Partial<GraphState>> {
  console.log("  🎯 检测到首次输入，提取学习目标...");

  const extractedGoal = await extractLearningGoal(userAnswer);
  console.log(`  ✅ 学习目标: ${extractedGoal}`);

  const updatedItem: LearningItem = {
    ...activeItem,
    goal: extractedGoal,
    cognitiveState: {
      summary: "学生已表达学习意愿，准备开始引导",
      missingParts: "所有核心概念",
    },
    recentEvidence: [createEvidence(userAnswer)],
    nextIntent: "elicit_intuition",
    status: { phase: "collecting_info", hasBasicInfo: false },
  };

  return { learningItems: { [activeItem.id]: updatedItem } };
}

/**
 * 处理后续输入：评估认知状态
 */
async function handleSubsequentInput(
  activeItem: LearningItem,
  userAnswer: string
): Promise<Partial<GraphState>> {
  console.log("  🤖 调用 LLM 评估...");

  const assessmentResult = await llmBasedAssessment(userAnswer, activeItem);

  // 处理评估失败的情况
  if (!assessmentResult.ok) {
    console.error(`  ❌ 评估失败: ${assessmentResult.error}`);
    // 降级处理：保持当前状态，继续引导
    const updatedItem: LearningItem = {
      ...activeItem,
      recentEvidence: appendEvidence(
        activeItem.recentEvidence,
        createEvidence(userAnswer)
      ),
    };
    return { learningItems: { [activeItem.id]: updatedItem } };
  }

  const { cognitiveState, reasoning } = assessmentResult.value;
  console.log(`  ✅ 评估结果: ${cognitiveState} (${reasoning})`);

  // 决定下一步
  const decision = determineTeachingDecision(
    cognitiveState,
    activeItem.currentLevel
  );

  console.log(`  📈 Level: ${activeItem.currentLevel} → ${decision.newLevel}`);
  console.log(`  🎯 Next: ${decision.nextIntent}`);

  // 检查是否已收集基础信息
  const hasBasicInfo = hasCollectedBasicInfo(activeItem);

  const updatedItem: LearningItem = {
    ...activeItem,
    currentLevel: decision.newLevel,
    cognitiveState: {
      summary: cognitiveState,
      missingParts: MISSING_PARTS_MAP[cognitiveState],
    },
    recentEvidence: appendEvidence(
      activeItem.recentEvidence,
      createEvidence(userAnswer)
    ),
    nextIntent: decision.nextIntent,
    status: { phase: "learning", hasBasicInfo },
  };

  return { learningItems: { [activeItem.id]: updatedItem } };
}

// ============================================================================
// 节点函数
// ============================================================================

/**
 * assessNode - 评估学生输入的认知状态
 *
 * @param state - 当前图状态
 * @param _config - 可选的运行配置（LangGraph 规范）
 * @returns 更新后的部分状态
 */
export async function assessNode(
  state: GraphState
): Promise<Partial<GraphState>> {
  console.log("🟡 [assessNode] 开始评估");

  const activeItemId = state.activeItemId;
  if (!activeItemId) {
    console.error("  ❌ 没有活动的学习项");
    return {};
  }

  const activeItem = state.learningItems[activeItemId];
  if (!activeItem) {
    console.error(`  ❌ 找不到学习项: ${activeItemId}`);
    return {};
  }

  const userAnswer = state.lastUserInput;

  // 判断是否是首次输入（目标未设定且无证据）
  const isFirstInput =
    activeItem.goal === AWAITING_TOPIC_GOAL &&
    activeItem.recentEvidence.length === 0;

  if (isFirstInput) {
    return handleFirstInput(activeItem, userAnswer);
  }

  return handleSubsequentInput(activeItem, userAnswer);
}
