import { GraphState, CognitiveLevel, TeachingIntent } from "../types.js";
import { llmBasedAssessment } from "../assessment/llm.js";
import { extractLearningGoal } from "../utils/goalExtractor.js";
import { hasCollectedBasicInfo } from "../utils/phaseDetector.js";

/**
 * assessNode - 评估学生输入
 * 
 * 职责：
 * - 评估用户回答的认知层级
 * - 更新 LearningItem 的认知状态
 * - 决定下一步教学意图
 */
export async function assessNode(
  state: GraphState
): Promise<Partial<GraphState>> {
  console.log("🟡 [assessNode] 开始评估");

  const activeItem = state.learningItems[state.activeItemId!];
  const userAnswer = state.lastUserInput;

  // 如果是第一次用户输入且目标未设定，先提取学习目标
  if (activeItem.goal === "等待用户提出学习主题" && activeItem.recentEvidence.length === 0) {
    console.log("  🎯 检测到首次输入，提取学习目标...");
    const extractedGoal = await extractLearningGoal(userAnswer);
    console.log(`  ✅ 学习目标: ${extractedGoal}`);
    
    // 更新 LearningItem 的 goal
    const updatedItem = {
      ...activeItem,
      goal: extractedGoal,
      cognitiveState: {
        summary: "学生已表达学习意愿，准备开始引导",
        missingParts: "所有核心概念",
      },
      recentEvidence: [
        {
          source: "user_input" as const,
          content: userAnswer,
          timestamp: Date.now(),
        },
      ],
      nextIntent: "elicit_intuition" as TeachingIntent,
    };

    return { learningItems: { [activeItem.id]: updatedItem } };
  }

  // 直接使用 LLM 评估（更准确，不受主题限制）
  console.log("  🤖 调用 LLM 评估...");
  const llmResult = await llmBasedAssessment(userAnswer, activeItem);
  const finalCognitiveState = llmResult.cognitiveState;
  const reasoning = llmResult.reasoning;

  console.log(`  ✅ 最终判断: ${finalCognitiveState} (${reasoning})`);

  // 阶段 3: 决定下一步意图和层级
  const { nextIntent, newLevel } = determineNextStep(
    finalCognitiveState,
    activeItem.currentLevel
  );

  console.log(`  📈 Level: ${activeItem.currentLevel} → ${newLevel}`);
  console.log(`  🎯 Next: ${nextIntent}`);

  // 检查是否已收集基础信息
  const hasBasicInfo = hasCollectedBasicInfo(activeItem);

  // 更新 LearningItem
  const updatedItem = {
    ...activeItem,
    currentLevel: newLevel,
    cognitiveState: {
      summary: finalCognitiveState,
      missingParts: extractMissingParts(finalCognitiveState),
    },
    recentEvidence: [
      ...activeItem.recentEvidence,
      {
        source: "user_input" as const,
        content: userAnswer,
        timestamp: Date.now(),
      },
    ].slice(-5), // 只保留最近5条
    nextIntent,
    hasBasicInfo,
  };

  return {
    learningItems: {
      [activeItem.id]: updatedItem,
    },
  };
}

/**
 * 根据认知状态决定下一步意图和层级
 */
function determineNextStep(
  cogState: string,
  currentLevel: CognitiveLevel
): { nextIntent: TeachingIntent; newLevel: CognitiveLevel } {
  if (cogState === "too_vague" || cogState === "intuition_but_unclear") {
    return {
      nextIntent: currentLevel === 1 ? "force_clarification" : "elicit_intuition",
      newLevel: CognitiveLevel.IntuitionOnly,
    };
  }

  if (cogState === "can_describe_with_structure") {
    return {
      nextIntent: "introduce_structure",
      newLevel: CognitiveLevel.CanDescribe,
    };
  }

  if (cogState === "fully_structured") {
    return {
      nextIntent: "test_transfer",
      newLevel: CognitiveLevel.Structured,
    };
  }

  return {
    nextIntent: "introduce_structure",
    newLevel: CognitiveLevel.Transferable,
  };
}

/**
 * 根据认知状态提取缺失部分
 */
function extractMissingParts(cogState: string): string {
  const missingMap: Record<string, string> = {
    too_vague: "需要更具体的表达",
    intuition_but_unclear: "核心概念边界、为什么不可或缺",
    can_describe_with_structure: "State 的具体机制（Annotation、reducer）",
    fully_structured: "实际应用场景和最佳实践",
    transferable: "无",
  };
  return missingMap[cogState] || "待评估";
}

