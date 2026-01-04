/**
 * LLM 认知评估模块
 *
 * 使用 LLM 评估学生的认知状态，采用结构化输出。
 */
import { z } from "zod";
import OpenAI from "openai";

import type { LearningItem, AssessmentResult, Result } from "../types.js";
import { ok, err } from "../types.js";

// ============================================================================
// Schema 定义
// ============================================================================

/**
 * 评估结果 Schema - 用于验证 LLM 输出
 */
const AssessmentResultSchema = z.object({
  cognitiveState: z.enum([
    "too_vague",
    "intuition_but_unclear",
    "can_describe_with_structure",
    "fully_structured",
    "transferable",
  ]),
  reasoning: z.string().min(1, "reasoning 不能为空"),
});

// ============================================================================
// 常量
// ============================================================================

const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3.2";
const DEFAULT_API_BASE = "https://api.siliconflow.cn/v1";
const ASSESSMENT_TEMPERATURE = 0.3;

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 清理 API Base URL，移除多余的路径后缀
 */
function cleanApiBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/chat\/completions\/?$/, "");
}

/**
 * 构建评估提示词
 */
function buildAssessmentPrompt(answer: string, item: LearningItem): string {
  return `你是一位教学评估专家。请评估学生对以下学习目标的理解程度。

学习目标：${item.goal}

学生回答：
"${answer}"

请判断学生当前的认知状态，从以下选项中选择一个：

1. too_vague - 表述太模糊，无法判断是否理解
2. intuition_but_unclear - 有直觉但说不清（知道大概方向，但表述模糊，未触及核心）
3. can_describe_with_structure - 能用结构化语言描述（能说清楚关键要素、因果关系、边界）
4. fully_structured - 完全结构化（有清晰的概念模型和层次）
5. transferable - 可迁移应用（能类比、举一反三）

请严格以 JSON 格式回复，不要包含其他内容：
{
  "cognitiveState": "选择的状态",
  "reasoning": "简短说明理由（一句话）"
}`;
}

/**
 * 解析 LLM 响应内容
 */
function parseLlmResponse(content: string): Result<AssessmentResult, string> {
  // 移除可能的 markdown 代码块标记
  const cleaned = content
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    const parsed: unknown = JSON.parse(cleaned);
    const validated = AssessmentResultSchema.parse(parsed);
    return ok(validated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return err(`解析失败: ${message}`);
  }
}

// ============================================================================
// 主函数
// ============================================================================

/**
 * 使用 LLM 评估学生的认知状态
 *
 * @param answer - 学生的回答
 * @param item - 当前学习项
 * @returns 评估结果或错误
 */
export async function llmBasedAssessment(
  answer: string,
  item: LearningItem
): Promise<Result<AssessmentResult, string>> {
  const modelName = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const apiBase = cleanApiBaseUrl(
    process.env.OPENAI_API_BASE ?? DEFAULT_API_BASE
  );

  console.log(`  🤖 评估模型: ${modelName}`);

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: apiBase,
  });

  const prompt = buildAssessmentPrompt(answer, item);

  try {
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      temperature: ASSESSMENT_TEMPERATURE,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return err("LLM 返回空内容");
    }

    return parseLlmResponse(content);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ LLM 调用失败: ${message}`);
    return err(`LLM 调用失败: ${message}`);
  }
}
