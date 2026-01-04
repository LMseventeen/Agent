import OpenAI from "openai";
import { LearningItem } from "../types.js";

export async function llmBasedAssessment(
  answer: string,
  item: LearningItem
): Promise<{ cognitiveState: string; reasoning: string }> {
  const modelName = "deepseek-ai/DeepSeek-V3.2";
  // 清理 baseURL（移除多余的 /chat/completions 后缀）
  let apiBase = process.env.OPENAI_API_BASE || "https://api.siliconflow.cn/v1";
  apiBase = apiBase.replace(/\/chat\/completions\/?$/, "");
  
  console.log(`  🤖 评估模型: ${modelName}`);
  console.log(`  🌐 API Base: ${apiBase}`);
  
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: apiBase,
  });

  const prompt = `你是一位教学评估专家。请评估学生对以下学习目标的理解程度。

学习目标：${item.goal}

学生回答：
"${answer}"

请判断学生当前的认知状态，从以下选项中选择一个：

1. intuition_but_unclear - 有直觉但说不清（知道大概方向，但表述模糊，未触及核心）
2. can_describe_with_structure - 能用结构化语言描述（能说清楚关键要素、因果关系、边界）
3. fully_structured - 完全结构化（有清晰的概念模型和层次）
4. transferable - 可迁移应用（能类比、举一反三）

请以 JSON 格式回复：
{
  "cognitiveState": "选择的状态",
  "reasoning": "简短说明理由（一句话）"
}`;

  const response = await client.chat.completions.create({
    model: modelName,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });
  
  try {
    let content = response.choices[0]?.message?.content || "";
    // 移除可能的 markdown 代码块标记
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const result = JSON.parse(content);
    return result;
  } catch (e) {
    console.error("❌ LLM 返回格式错误:", response.choices[0]?.message?.content);
    return {
      cognitiveState: "intuition_but_unclear",
      reasoning: "解析失败，默认判断",
    };
  }
}

