/**
 * Learning Agent 核心类型定义
 *
 * 设计原则：
 * - 类型表达业务含义
 * - 非法状态不可表示（使用判别联合）
 * - 新需求应优先引发 TypeScript 编译错误
 */

// ============================================================================
// 认知层级（教学主轴）
// ============================================================================

/**
 * 认知层级 - 表示学生对知识的掌握程度
 * 不允许跳级教学，教学动作必须与当前 Level 匹配
 */
export enum CognitiveLevel {
  IntuitionOnly = 1,  // 有直觉但说不清
  CanDescribe = 2,    // 能描述但结构混乱
  Structured = 3,     // 能用清晰结构表达
  Transferable = 4,   // 能迁移、应用、类比
}

/**
 * 认知状态标签 - LLM 评估的离散输出
 */
export type CognitiveStateLabel =
  | "too_vague"                   // 表述太模糊
  | "intuition_but_unclear"       // 有直觉但说不清
  | "can_describe_with_structure" // 能用结构化语言描述
  | "fully_structured"            // 完全结构化
  | "transferable";               // 可迁移应用

// ============================================================================
// 教学意图与阶段
// ============================================================================

/**
 * 教学意图 - 系统下一步的教学动作
 */
export type TeachingIntent =
  | "elicit_intuition"     // 引导表达直觉
  | "force_clarification"  // 强迫说清楚
  | "introduce_structure"  // 给出结构
  | "test_transfer";       // 测试迁移

/**
 * 教学阶段 - 更精细的状态划分
 */
export enum TeachingPhase {
  InfoCollection = "info_collection",        // 信息收集
  UnderstandingElicitation = "understanding", // 理解引导
  Clarification = "clarification",           // 澄清边界
  Structured = "structured",                 // 给出结构
  Transfer = "transfer",                     // 测试迁移
}

// ============================================================================
// 证据与认知状态
// ============================================================================

/**
 * 证据来源
 */
export type EvidenceSource = "user_input" | "assessment";

/**
 * 证据 - 用于评估学生认知状态的原始数据
 */
export interface Evidence {
  readonly source: EvidenceSource;
  readonly content: string;
  readonly timestamp: number;
}

/**
 * 认知状态 - 系统对学生当前理解的判断
 */
export interface CognitiveState {
  readonly summary: string;              // 当前理解的概括
  readonly missingParts?: string;        // 关键缺失或模糊点
  readonly misconceptions?: readonly string[]; // 已识别的误解
}

// ============================================================================
// 学习项（核心抽象）
// ============================================================================

/**
 * 学习项状态 - 使用判别联合确保状态合法性
 */
export type LearningItemStatus =
  | { phase: "awaiting_topic" }                           // 等待用户提出主题
  | { phase: "collecting_info"; hasBasicInfo: boolean }   // 收集基础信息
  | { phase: "learning"; hasBasicInfo: boolean };         // 正在学习

/**
 * 学习项 - 围绕一个学习目标的结构化记录
 *
 * 这是教学决策的最小依据单位，用于：
 * - 明确学习目标
 * - 跟踪认知层级
 * - 积累证据
 * - 决定下一步教学意图
 */
export interface LearningItem {
  readonly id: string;
  readonly goal: string;                        // 学习目标
  readonly currentLevel: CognitiveLevel;        // 当前认知层级
  readonly cognitiveState: CognitiveState;      // 认知状态描述
  readonly recentEvidence: readonly Evidence[]; // 最近的证据
  readonly nextIntent: TeachingIntent;          // 下一步教学意图
  readonly status: LearningItemStatus;          // 学习项状态
}

// ============================================================================
// 消息
// ============================================================================

/**
 * 消息角色
 */
export type MessageRole = "user" | "assistant";

/**
 * 对话消息
 */
export interface Message {
  readonly role: MessageRole;
  readonly content: string;
}

// ============================================================================
// Graph State
// ============================================================================

/**
 * 下一步动作
 */
export type NextAction = "guide" | "end";

/**
 * Graph State - LangGraph 的核心状态
 *
 * 在 LangGraph 中，State 是系统唯一拥有长期、结构化思考能力的地方。
 * 所有与学习相关的关键信息，必须进入 State。
 */
export interface GraphState {
  readonly learningItems: Record<string, LearningItem>;
  readonly activeItemId: string | null;
  readonly lastUserInput: string;
  readonly messages: readonly Message[];
  readonly nextAction: NextAction;
}

// ============================================================================
// 评估结果
// ============================================================================

/**
 * LLM 评估结果
 */
export interface AssessmentResult {
  readonly cognitiveState: CognitiveStateLabel;
  readonly reasoning: string;
}

/**
 * 教学决策结果
 */
export interface TeachingDecision {
  readonly nextIntent: TeachingIntent;
  readonly newLevel: CognitiveLevel;
}

// ============================================================================
// Result 模式（用于错误处理）
// ============================================================================

/**
 * Result 类型 - 用于可预期错误的处理
 */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * 创建成功结果
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * 创建失败结果
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ============================================================================
// 常量
// ============================================================================

/**
 * 最大证据保留数量
 */
export const MAX_EVIDENCE_COUNT = 5;

/**
 * 默认学习目标（等待用户输入时使用）
 */
export const AWAITING_TOPIC_GOAL = "等待用户提出学习主题";
