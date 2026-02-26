/**
 * selectItemNode - 选择或创建 LearningItem
 *
 * 职责：
 * - 如果已有 activeItem，直接返回
 * - 若 config 中有 resumeGoal（再次登录继续学习），则创建带目标与层级的恢复项
 * - 否则创建新的 LearningItem（等待用户选主题）
 */
import type { RunnableConfig } from "@langchain/core/runnables";

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
 * 创建新的 LearningItem（等待用户提出主题）
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

/** 将 resumeLevel 规范到 1–4 */
function clampLevel(v: unknown): CognitiveLevel {
  if (typeof v !== "number" || Number.isNaN(v)) return CognitiveLevel.IntuitionOnly;
  if (v <= 1) return CognitiveLevel.IntuitionOnly;
  if (v >= 4) return CognitiveLevel.Transferable;
  return v as CognitiveLevel;
}

/**
 * 创建「继续学习」的 LearningItem（从 Mem0 恢复）
 */
function createResumedLearningItem(id: string, goal: string, level: CognitiveLevel): LearningItem {
  return {
    id,
    goal,
    currentLevel: level,
    cognitiveState: {
      summary: "从上次进度恢复，继续引导",
      missingParts: "待根据对话更新",
    },
    recentEvidence: [],
    nextIntent: "elicit_intuition",
    status: { phase: "learning", hasBasicInfo: true },
  };
}

// ============================================================================
// 节点函数
// ============================================================================

/**
 * selectItemNode - 选择或创建 LearningItem
 *
 * @param state - 当前图状态
 * @param config - 可选的运行配置；config.configurable.resumeGoal / resumeLevel 用于再次登录继续学习
 * @returns 更新后的部分状态
 */
export async function selectItemNode(
  state: GraphState,
  config?: RunnableConfig
): Promise<Partial<GraphState>> {
  console.log("🔵 [selectItemNode] 开始执行");

  // 如果已有 activeItem，直接返回
  if (state.activeItemId && state.learningItems[state.activeItemId]) {
    console.log("✅ [selectItemNode] 已有活动项，跳过创建");
    return {};
  }

  const resumeGoal = config?.configurable?.resumeGoal;
  const hasResumeGoal = typeof resumeGoal === "string" && resumeGoal.trim().length > 0;

  if (hasResumeGoal) {
    const newItemId = generateItemId();
    const level = clampLevel(config?.configurable?.resumeLevel);
    const newItem = createResumedLearningItem(newItemId, resumeGoal.trim(), level);
    console.log(`✅ [selectItemNode] 恢复学习项: ${newItemId}（目标: ${resumeGoal.trim().slice(0, 30)}…, Level ${level}）`);
    return {
      activeItemId: newItemId,
      learningItems: { [newItemId]: newItem },
    };
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
