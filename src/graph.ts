/**
 * Learning Agent Graph 定义
 *
 * 构建 LangGraph 状态图，实现认知层级引导的教学流程。
 *
 * 图结构：
 * - selectItemNode → guideNode → [等待用户输入]
 * - [用户输入] → assessNode → decideNode → guideNode | END
 */
import { StateGraph, Annotation, END } from "@langchain/langgraph";

import type { GraphState, Message, NextAction, LearningItem } from "./types.js";
import { selectItemNode } from "./nodes/select.js";
import { guideNode } from "./nodes/guide.js";
import { assessNode } from "./nodes/assess.js";
import { decideNode } from "./nodes/decide.js";

// ============================================================================
// State Annotation 定义
// ============================================================================

/**
 * GraphStateAnnotation - LangGraph 核心状态机制
 *
 * 定义状态的结构和更新规则（reducer）
 */
const GraphStateAnnotation = Annotation.Root({
  learningItems: Annotation<Record<string, LearningItem>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({}),
  }),

  activeItemId: Annotation<string | null>({
    reducer: (_, update) => update ?? null,
    default: () => null,
  }),

  lastUserInput: Annotation<string>({
    reducer: (_, update) => update ?? "",
    default: () => "",
  }),

  messages: Annotation<readonly Message[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  nextAction: Annotation<NextAction>({
    reducer: (_, update) => update ?? "guide",
    default: () => "guide",
  }),
});

// ============================================================================
// 条件边函数
// ============================================================================

/**
 * 入口条件：判断是初始化还是后续轮次
 */
function entryCondition(state: GraphState): "assess" | "select" {
  // 如果有用户输入，说明是后续轮次，进入评估流程
  if (state.lastUserInput && state.lastUserInput.trim()) {
    return "assess";
  }
  // 否则是初始化，进入选择流程
  return "select";
}

/**
 * 决策条件：根据 decideNode 的输出路由
 */
function decisionCondition(state: GraphState): "guide" | "end" {
  return state.nextAction;
}

// ============================================================================
// 构建 StateGraph
// ============================================================================

const workflow = new StateGraph(GraphStateAnnotation)
  // 添加所有节点
  .addNode("selectItem", selectItemNode)
  .addNode("guide", guideNode)
  .addNode("assess", assessNode)
  .addNode("decide", decideNode)

  // 条件边：根据是否有用户输入判断入口
  .addConditionalEdges("__start__", entryCondition, {
    assess: "assess",
    select: "selectItem",
  })

  // 初始流程（首次调用）
  .addEdge("selectItem", "guide")
  .addEdge("guide", END) // 等待用户输入

  // 用户回复后的流程
  .addEdge("assess", "decide")

  // 条件边：根据 decideNode 的输出路由
  .addConditionalEdges("decide", decisionCondition, {
    guide: "guide",
    end: END,
  });

// ============================================================================
// 导出
// ============================================================================

/**
 * 编译后的 Learning Agent Graph
 */
export const graph = workflow.compile();

/**
 * 创建初始状态
 */
export function createInitialState(): GraphState {
  return {
    learningItems: {},
    activeItemId: null,
    lastUserInput: "",
    messages: [],
    nextAction: "guide",
  };
}
