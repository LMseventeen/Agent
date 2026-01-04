import { LearningItem, CognitiveLevel, TeachingPhase } from "../types.js";

/**
 * 判断当前应该处于哪个教学阶段
 */
export function determineTeachingPhase(item: LearningItem): TeachingPhase {
  const evidenceCount = item.recentEvidence.length;
  
  // 阶段 1: 信息收集（首轮或信息不足）
  if (!item.hasBasicInfo && evidenceCount <= 2) {
    return TeachingPhase.InfoCollection;
  }
  
  // 阶段 2-5: 根据认知层级决定
  switch (item.currentLevel) {
    case CognitiveLevel.IntuitionOnly:
      // Level 1: 理解引导或澄清
      return evidenceCount <= 3 
        ? TeachingPhase.UnderstandingElicitation 
        : TeachingPhase.Clarification;
    
    case CognitiveLevel.CanDescribe:
      return TeachingPhase.Structured;
    
    case CognitiveLevel.Structured:
      return TeachingPhase.Transfer;
    
    case CognitiveLevel.Transferable:
      return TeachingPhase.Transfer;
    
    default:
      return TeachingPhase.UnderstandingElicitation;
  }
}

/**
 * 检查是否已收集到基础信息
 */
export function hasCollectedBasicInfo(item: LearningItem): boolean {
  if (item.hasBasicInfo) return true;
  
  // 启发式判断：如果学习目标很具体且证据数 >= 2，认为已收集
  const goalIsSpecific = item.goal.length > 20 && 
                         !item.goal.includes("等待") &&
                         (item.goal.includes("的") || item.goal.includes("课"));
  
  return goalIsSpecific && item.recentEvidence.length >= 2;
}

