import OpenAI from "openai";

/**
 * 从用户的第一个问题中提取学习目标
 */
export async function extractLearningGoal(userQuestion: string): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: (process.env.OPENAI_API_BASE || "https://api.siliconflow.cn/v1").replace(/\/chat\/completions\/?$/, ""),
  });

  const prompt = `用户提出了一个问题或表达了学习意愿。请提取出他的核心学习目标。

用户输入："${userQuestion}"

要求：
1. 如果是明确的疑问（如"什么是X"），提取为"理解 X 的概念和作用"
2. 如果是模糊表述（如"想学Y"），提取为"掌握 Y 的基础知识"
3. 学习目标要具体、可评估
4. 直接回复目标，不要加任何前缀或解释

格式示例：
- "理解 LangGraph 的核心概念和应用场景"
- "掌握 React Hooks 的使用方法和最佳实践"
- "学会使用 TypeScript 进行类型安全开发"`;

  const response = await client.chat.completions.create({
    model: "deepseek-ai/DeepSeek-V3.2",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  const goal = response.choices[0]?.message?.content?.trim() || "理解用户提出的问题";
  
  // 清理可能的引号或多余格式
  return goal.replace(/^["']|["']$/g, '').trim();
}

