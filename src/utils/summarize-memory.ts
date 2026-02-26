/**
 * 将 Mem0 检索到的原始记忆文本总结为一句简短、友好的中文，用于欢迎语展示
 */
import OpenAI from "openai";

const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3.2";
const DEFAULT_API_BASE = "https://api.siliconflow.cn/v1";

function cleanApiBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/chat\/completions\/?$/, "");
}

/**
 * 把原始记忆内容（可能为英文或冗长）总结成一句简短自然的中文，用于「上次你在学：xxx」
 *
 * @param rawMemoryText - Mem0 返回的记忆原文
 * @returns 一句简短中文概括；失败时返回原文或默认文案
 */
export async function summarizeMemoryForDisplay(
  rawMemoryText: string
): Promise<string> {
  const trimmed = rawMemoryText.trim();
  if (trimmed.length === 0) return "你上次的学习内容";

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) return trimmed;

  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const baseURL = cleanApiBaseUrl(
    process.env.OPENAI_API_BASE ?? DEFAULT_API_BASE
  );

  const client = new OpenAI({ apiKey, baseURL });

  const systemPrompt = `你是一个助手。用户会给出一条来自系统的「学习记录」（可能是英文或较长描述）。
请用一句简短、自然的中文概括「用户当时在学什么」，用于欢迎语展示。
要求：只输出这一句话，不要加引号、不要加「用户在学习」等前缀，不要换行。`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `学习记录：\n${trimmed}` },
      ],
      temperature: 0.3,
      max_tokens: 80,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (content && content.length > 0) {
      return content;
    }
  } catch {
    // 失败时退回原文
  }

  return trimmed;
}
