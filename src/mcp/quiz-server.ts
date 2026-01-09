/**
 * 出题 MCP Server
 *
 * 提供出题工具供 Learning Agent 调用
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ============================================================================
// 题目类型定义
// ============================================================================

interface Question {
  id: string;
  type: "choice" | "fill" | "open";
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
}

// ============================================================================
// 题库（示例数据，实际可接入数据库或 LLM 生成）
// ============================================================================

const questionBank: Record<string, Question[]> = {
  langgraph: [
    {
      id: "lg-001",
      type: "choice",
      topic: "langgraph",
      difficulty: "easy",
      question: "LangGraph 中的 State 主要用于什么？",
      options: ["A. 存储图的状态信息", "B. 定义 UI 样式", "C. 管理数据库连接", "D. 处理网络请求"],
      answer: "A",
      explanation: "State 是 LangGraph 的核心概念，用于在图的各个节点之间传递和维护状态信息。",
    },
    {
      id: "lg-002",
      type: "choice",
      topic: "langgraph",
      difficulty: "medium",
      question: "LangGraph 中 Annotation 的 reducer 函数的作用是？",
      options: ["A. 减少代码量", "B. 定义状态如何更新合并", "C. 压缩数据", "D. 过滤无效状态"],
      answer: "B",
      explanation: "reducer 定义了当状态更新时，新旧值如何合并。比如数组可以用 concat，对象可以用 spread。",
    },
    {
      id: "lg-003",
      type: "fill",
      topic: "langgraph",
      difficulty: "medium",
      question: "在 LangGraph 中，使用 _____ 来定义条件分支路由。",
      answer: "addConditionalEdges",
      explanation: "addConditionalEdges 允许根据状态动态决定下一个执行的节点。",
    },
  ],
  mcp: [
    {
      id: "mcp-001",
      type: "choice",
      topic: "mcp",
      difficulty: "easy",
      question: "MCP 的全称是什么？",
      options: ["A. Model Control Protocol", "B. Model Context Protocol", "C. Machine Control Program", "D. Multi Channel Protocol"],
      answer: "B",
      explanation: "MCP 是 Model Context Protocol，一种让 AI 模型访问外部工具和数据的标准协议。",
    },
  ],
};

// ============================================================================
// 创建 MCP Server
// ============================================================================

const server = new McpServer({
  name: "quiz-server",
  version: "1.0.0",
});

// 工具：生成题目
server.tool(
  "generate_quiz",
  "根据主题和难度生成一道题目",
  {
    topic: z.string().describe("题目主题，如 langgraph, mcp"),
    difficulty: z.enum(["easy", "medium", "hard"]).optional().describe("难度级别"),
  },
  async ({ topic, difficulty }) => {
    const topicQuestions = questionBank[topic.toLowerCase()];

    if (!topicQuestions || topicQuestions.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `没有找到主题 "${topic}" 的题目` }) }],
      };
    }

    // 按难度筛选
    let filtered = topicQuestions;
    if (difficulty) {
      filtered = topicQuestions.filter((q) => q.difficulty === difficulty);
    }

    if (filtered.length === 0) {
      filtered = topicQuestions; // 如果没有匹配难度的，返回所有
    }

    // 随机选一道
    const question = filtered[Math.floor(Math.random() * filtered.length)];

    return {
      content: [{ type: "text", text: JSON.stringify(question, null, 2) }],
    };
  }
);

// 工具：验证答案
server.tool(
  "check_answer",
  "验证用户的答案是否正确",
  {
    questionId: z.string().describe("题目 ID"),
    userAnswer: z.string().describe("用户的答案"),
  },
  async ({ questionId, userAnswer }) => {
    // 在所有题库中查找
    for (const questions of Object.values(questionBank)) {
      const question = questions.find((q) => q.id === questionId);
      if (question) {
        const isCorrect = userAnswer.trim().toUpperCase() === question.answer.toUpperCase();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                correct: isCorrect,
                correctAnswer: question.answer,
                explanation: question.explanation,
              }),
            },
          ],
        };
      }
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ error: `未找到题目 ${questionId}` }) }],
    };
  }
);

// 工具：列出可用主题
server.tool("list_topics", "列出所有可用的题目主题", {}, async () => {
  const topics = Object.keys(questionBank).map((topic) => ({
    topic,
    count: questionBank[topic]?.length ?? 0,
  }));

  return {
    content: [{ type: "text", text: JSON.stringify(topics, null, 2) }],
  };
});

// ============================================================================
// 启动服务
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Quiz MCP Server 已启动");
}

main().catch(console.error);
