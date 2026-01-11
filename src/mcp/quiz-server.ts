/**
 * 出题 MCP Server
 *
 * 提供出题工具供 Learning Agent 调用
 * 支持静态题库 + LLM 动态生成
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import OpenAI from "openai";

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

// LLM 生成的题目 Schema
const QuestionSchema = z.object({
  type: z.enum(["choice", "fill", "open"]),
  question: z.string(),
  options: z.array(z.string()).optional(),
  answer: z.string(),
  explanation: z.string(),
});

// ============================================================================
// LLM 配置
// ============================================================================

const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3.2";
const DEFAULT_API_BASE = "https://api.siliconflow.cn/v1";

function createLlmClient(): OpenAI {
  let apiBase = process.env.OPENAI_API_BASE ?? DEFAULT_API_BASE;
  // 移除可能的多余路径
  apiBase = apiBase.replace(/\/chat\/completions\/?$/, "").replace(/\/v1\/?$/, "") + "/v1";
  
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: apiBase,
  });
}

// ============================================================================
// 静态题库（作为备用）
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
// LLM 出题函数
// ============================================================================

async function generateQuestionWithLlm(
  topic: string,
  difficulty: "easy" | "medium" | "hard",
  questionType: "choice" | "fill" | "open"
): Promise<Question> {
  const client = createLlmClient();
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  console.error(`[Quiz Server] 使用模型: ${model}`);

  const typeInstructions = {
    choice: `生成一道单选题，包含 4 个选项（A、B、C、D），answer 字段填写正确选项字母。`,
    fill: `生成一道填空题，在题目中用 _____ 表示空白处，answer 字段填写正确答案。`,
    open: `生成一道开放性问题，answer 字段填写参考答案要点。`,
  };

  const difficultyDesc = {
    easy: "基础概念，适合初学者",
    medium: "需要理解原理和应用场景",
    hard: "需要深入理解，涉及边界情况或高级用法",
  };

  const prompt = `你是一位技术教育专家。请根据以下要求生成一道题目：

主题：${topic}
难度：${difficulty}（${difficultyDesc[difficulty]}）
题型：${questionType}

${typeInstructions[questionType]}

请严格以 JSON 格式回复，不要包含其他内容：
{
  "type": "${questionType}",
  "question": "题目内容",
  ${questionType === "choice" ? '"options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],' : ""}
  "answer": "正确答案",
  "explanation": "解析说明"
}`;

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM 返回空内容");
  }

  // 解析 JSON
  const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned);
  const validated = QuestionSchema.parse(parsed);

  return {
    id: `llm-${Date.now()}`,
    topic,
    difficulty,
    ...validated,
  };
}

// ============================================================================
// 创建 MCP Server
// ============================================================================

const server = new McpServer({
  name: "quiz-server",
  version: "1.0.0",
});

// 工具：LLM 生成题目
server.tool(
  "generate_quiz",
  "使用 LLM 根据主题和难度动态生成一道题目",
  {
    topic: z.string().describe("题目主题，如 langgraph, mcp, typescript, react 等"),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium").describe("难度级别"),
    type: z.enum(["choice", "fill", "open"]).default("choice").describe("题型：choice=选择题, fill=填空题, open=开放题"),
  },
  async ({ topic, difficulty, type }) => {
    try {
      const question = await generateQuestionWithLlm(topic, difficulty, type);
      return {
        content: [{ type: "text", text: JSON.stringify(question, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `生成失败: ${message}` }) }],
      };
    }
  }
);

// 工具：从题库获取题目（备用）
server.tool(
  "get_quiz_from_bank",
  "从静态题库获取一道题目（不消耗 LLM 调用）",
  {
    topic: z.string().describe("题目主题"),
    difficulty: z.enum(["easy", "medium", "hard"]).optional().describe("难度级别"),
  },
  async ({ topic, difficulty }) => {
    const topicQuestions = questionBank[topic.toLowerCase()];

    if (!topicQuestions || topicQuestions.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `题库中没有主题 "${topic}" 的题目` }) }],
      };
    }

    let filtered = topicQuestions;
    if (difficulty) {
      filtered = topicQuestions.filter((q) => q.difficulty === difficulty);
      if (filtered.length === 0) filtered = topicQuestions;
    }

    const question = filtered[Math.floor(Math.random() * filtered.length)];
    return {
      content: [{ type: "text", text: JSON.stringify(question, null, 2) }],
    };
  }
);

// 工具：验证答案（支持 LLM 评判开放题）
server.tool(
  "check_answer",
  "验证用户的答案是否正确，开放题使用 LLM 评判",
  {
    question: z.string().describe("原题目内容"),
    correctAnswer: z.string().describe("标准答案"),
    userAnswer: z.string().describe("用户的答案"),
    questionType: z.enum(["choice", "fill", "open"]).default("choice").describe("题型"),
  },
  async ({ question, correctAnswer, userAnswer, questionType }) => {
    // 选择题和填空题：直接比对
    if (questionType === "choice" || questionType === "fill") {
      const isCorrect = userAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              correct: isCorrect,
              correctAnswer,
              feedback: isCorrect ? "回答正确！" : "回答错误，请再想想。",
            }),
          },
        ],
      };
    }

    // 开放题：使用 LLM 评判
    try {
      const client = createLlmClient();
      const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;

      const prompt = `你是一位评分专家。请评判学生的答案。

题目：${question}
参考答案：${correctAnswer}
学生答案：${userAnswer}

请以 JSON 格式回复：
{
  "correct": true/false（答案是否基本正确）,
  "score": 0-100（得分）,
  "feedback": "具体反馈，指出优点和不足"
}`;

      const response = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("LLM 返回空内容");

      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const result = JSON.parse(cleaned);

      return {
        content: [{ type: "text", text: JSON.stringify({ ...result, correctAnswer }) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `评判失败: ${message}` }) }],
      };
    }
  }
);

// 工具：列出题库主题
server.tool("list_topics", "列出静态题库中的可用主题", {}, async () => {
  const topics = Object.keys(questionBank).map((topic) => ({
    topic,
    count: questionBank[topic]?.length ?? 0,
  }));

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          bankTopics: topics,
          note: "使用 generate_quiz 可以生成任意主题的题目（通过 LLM）",
        }, null, 2),
      },
    ],
  };
});

// ============================================================================
// 启动服务
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Quiz MCP Server 已启动（LLM 模式）");
}

main().catch(console.error);
