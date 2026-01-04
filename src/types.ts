// 认知层级（教学主轴）
export enum CognitiveLevel {
  IntuitionOnly = 1,      // 有直觉但说不清
  CanDescribe = 2,        // 能描述但结构混乱
  Structured = 3,         // 能用清晰结构表达
  Transferable = 4        // 能迁移、应用、类比
}

// 教学意图
export type TeachingIntent =
  | "elicit_intuition"      // 引导表达直觉
  | "force_clarification"   // 强迫说清楚
  | "introduce_structure"   // 给出结构
  | "test_transfer";        // 测试迁移

// 教学阶段（更精细的状态划分）
export enum TeachingPhase {
  InfoCollection = "info_collection",       // 信息收集："哪门课？什么年级？"
  UnderstandingElicitation = "understanding", // 理解引导："你怎么想的？"
  Clarification = "clarification",          // 澄清边界："如果没有X？"
  Structured = "structured",                // 给出结构
  Transfer = "transfer"                     // 测试迁移
}

// 证据
export interface Evidence {
  source: "user_input" | "assessment";
  content: string;
  timestamp: number;
}

// 认知状态
export interface CognitiveState {
  summary: string;           // 当前理解的概括
  missingParts?: string;     // 关键缺失或模糊点
  misconceptions?: string[]; // 已识别的误解
}

// 学习项（核心抽象）
export interface LearningItem {
  id: string;
  goal: string;                      // 学习目标
  currentLevel: CognitiveLevel;      // 当前认知层级
  cognitiveState: CognitiveState;    // 认知状态描述
  recentEvidence: Evidence[];        // 最近的证据
  nextIntent: TeachingIntent;        // 下一步教学意图
  hasBasicInfo?: boolean;            // 是否已收集基础信息（科目、年级等）
}

// Graph State
export interface GraphState {
  learningItems: Record<string, LearningItem>;
  activeItemId: string | null;
  lastUserInput: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  nextAction: "guide" | "end";
}

