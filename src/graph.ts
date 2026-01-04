import { StateGraph, Annotation, END } from "@langchain/langgraph";
import { GraphState } from "./types.js";
import { selectItemNode } from "./nodes/select.js";
import { guideNode } from "./nodes/guide.js";
import { assessNode } from "./nodes/assess.js";
import { decideNode } from "./nodes/decide.js";

// 定义 State Annotation（LangGraph 核心机制）
const GraphStateAnnotation = Annotation.Root({
  learningItems: Annotation<GraphState["learningItems"]>({
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
  messages: Annotation<GraphState["messages"]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
  nextAction: Annotation<"guide" | "end">({
    reducer: (_, update) => update ?? "guide",
    default: () => "guide",
  }),
});

// 构建 StateGraph
const workflow = new StateGraph(GraphStateAnnotation)
  // 添加所有节点
  .addNode("selectItem", selectItemNode)
  .addNode("guide", guideNode)
  .addNode("assess", assessNode)
  .addNode("decide", decideNode)
  
  // 条件边：根据是否有用户输入判断入口
  .addConditionalEdges(
    "__start__",
    (state) => {
      // 如果有用户输入，说明是后续轮次，进入评估流程
      if (state.lastUserInput && state.lastUserInput.trim()) {
        return "assess";
      }
      // 否则是初始化，进入选择流程
      return "select";
    },
    {
      assess: "assess",
      select: "selectItem",
    }
  )
  
  // 初始流程（首次调用）
  .addEdge("selectItem", "guide")
  .addEdge("guide", END)  // 等待用户输入
  
  // 用户回复后的流程
  .addEdge("assess", "decide")
  
  // 条件边：根据 decideNode 的输出路由
  .addConditionalEdges(
    "decide",
    (state) => state.nextAction,
    {
      guide: "guide",
      end: END,
    }
  );

// 编译图
export const graph = workflow.compile();

