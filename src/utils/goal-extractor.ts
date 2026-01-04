/**
 * 学习目标提取器
 *
 * 从用户的第一个问题中提取学习目标
 */
import OpenAI from "openai";

import type { Result } from "../types.js";
import { ok, err } from "../types.js";

// ============================================================================
// 常量
// ============================================================================

const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3.2";
const DEFAULT_API_BASE = "https://api.siliconflow.cn/v1";
const EXTRACTION_TEMPERATURE = 0.3;
const DEFAULT_GOAL = "理解用户提出的问题";

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 清理 API Base URL
 */
function cleanApiBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/chat\/completions\/?$/, "");
}

/**
 * 构建提取提示词
 */
function buildExtractionPrompt(userQuestion: string): string {
  return `用户提出了一个问题或表达了学习意愿。请提取出他的核心学习目标。

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
}

/**
 * 清理 LLM 返回的目标字符串
 */
function cleanGoalString(raw: string): string {
  return raw
    .replace(/^["']|["']$/g, "") // 移除首尾引号
    .trim();
}

// ============================================================================
// 主函数
// ============================================================================

/**
 * 从用户的第一个问题中提取学习目标
 *
 * @param userQuestion - 用户的问题或表述
 * @returns 提取的学习目标或错误
 */
export async function extractLearningGoalSafe(
  userQuestion: string
): Promise<Result<string, string>> {
  const modelName = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const apiBase = cleanApiBaseUrl(
    process.env.OPENAI_API_BASE ?? DEFAULT_API_BASE
  );

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: apiBase,
  });

  const prompt = buildExtractionPrompt(userQuestion);

  try {
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      temperature: EXTRACTION_TEMPERATURE,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return err("LLM 返回空内容");
    }

    const goal = cleanGoalString(content);
    return ok(goal);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ 目标提取失败: ${message}`);
    return err(`目标提取失败: ${message}`);
  }
}

/**
 * 从用户的第一个问题中提取学习目标（兼容旧接口）
 *
 * 注意：此函数在失败时返回默认值，不抛出错误
 *
 * @param userQuestion - 用户的问题或表述
 * @returns 提取的学习目标
 */
export async function extractLearningGoal(userQuestion: string): Promise<string> {
  const result = await extractLearningGoalSafe(userQuestion);

  if (result.ok) {
    return result.value;
  }

  console.warn(`⚠️ 使用默认目标: ${result.error}`);
  return DEFAULT_GOAL;
}

