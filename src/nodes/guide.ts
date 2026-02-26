/**
 * guideNode - 生成引导语
 *
 * 职责：
 * - 根据 currentLevel + nextIntent 生成引导消息
 * - 使用 LLM 生成动态、有针对性的引导语
 * - 当 config.configurable.userId 存在时，将本轮对话写入 Mem0 长期记忆
 */
import type { RunnableConfig } from "@langchain/core/runnables";
import OpenAI from "openai";

import type { GraphState, LearningItem, Message } from "../types.js";
import { TeachingPhase, AWAITING_TOPIC_GOAL } from "../types.js";
import { determineTeachingPhase } from "../utils/phase-detector.js";
import { addMemories } from "../memory/index.js";

// ============================================================================
// 常量
// ============================================================================

const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3.2";
const DEFAULT_API_BASE = "https://api.siliconflow.cn/v1";
const INITIAL_TEMPERATURE = 0.9;
const NORMAL_TEMPERATURE = 0.8;
const MAX_CONTEXT_MESSAGES = 4;

// ============================================================================
// Prompt 构建器（使用映射表）
// ============================================================================

/**
 * 初始欢迎 Prompt
 */
const INITIAL_PROMPT = `你是一位教学专家。请生成一个友好的欢迎消息，包含 3 个预设学习选项。

**要求**：
1. 生成 3 个不同类型的学习场景（每次要有变化，不要重复）
2. 涵盖不同领域：概念解释、作业辅导、技能学习、知识探索等
3. 使用 emoji 和友好的格式
4. 最后提示用户也可以直接说出需求

**输出格式（严格遵守）**：

我们先从哪里开始呢？

[emoji] **[标题]**
（简短说明或举例）

[emoji] **[标题]**
（简短说明或举例）

[emoji] **[标题]**
（简短说明或举例）

---
当然，你也可以直接告诉我你想学什么 😊

**示例参考（不要完全照搬，要生成不同的）**：
- 🔬 探索科学现象
- 📖 分析文学作品  
- 🧮 解决数学难题
- 💻 学习编程技能
- 🌍 了解历史文化
- 🎨 创意写作指导

直接输出内容，不要有任何前置说明或元指令。`;

/**
 * 教学阶段 -> Prompt 生成器 映射
 */
const PHASE_PROMPT_BUILDERS: Record<
  TeachingPhase,
  (item: LearningItem) => string
> = {
  [TeachingPhase.InfoCollection]: (_item) => `
**当前阶段：信息收集**

**你的任务**：
1. 明确说明你会"一步步引导，而不是直接给答案"
2. 问一个具体的、可选择式的问题（如科目、年级、具体主题）
3. 给出选项示例帮助学生快速回答
4. 使用友好的 emoji 和格式（**加粗**、👉）
5. 结尾说"你先回答这个，我们再继续"

**强约束**：
❌ 禁止讲解任何知识点
❌ 禁止开放式提问（如"你怎么想的"）
✅ 必须问具体的、可选择的问题
✅ 必须给出选项示例

示例风格：
"当然可以 😊 在开始前，我需要先了解一下具体情况。

**第一个问题：**
👉 这是哪一门课的作业？（比如：数学、语文、英语、物理等）

你先回答这个，我们再继续。"

保持具体、聚焦、有选项的风格。一次只问一个明确问题。`,

  [TeachingPhase.UnderstandingElicitation]: (_item) => `
**当前阶段：理解引导**

**你的任务**：引导学生用自己的话表达初步理解。
**禁止**：直接解释、给答案、讲概念。
**必须**：用开放式问题，让学生"先说说看"。

示例风格：
"好的！在我帮你之前，你能先说说你对这个问题的理解吗？不用担心对错，说说你现在的想法就好。"

保持简短、友好、鼓励性。`,

  [TeachingPhase.Clarification]: (_item) => `
**当前阶段：边界澄清**

**你的任务**：学生已有模糊直觉，现在要强迫他们思考边界。
**策略**：让学生想象"如果没有 X，会怎样？"
**禁止**：直接补全答案。

示例风格：
"你提到了X，那我们想一个问题：如果没有X，会发生什么？"

引导他们思考**反例、边界、必要性**。`,

  [TeachingPhase.Structured]: (_item) => `
**当前阶段：结构化讲解**

**你的任务**：学生已理解核心，现在可以给结构化框架。
**策略**：
1. 先肯定学生的理解
2. 给出清晰的知识结构（分点、层次）
3. 引入具体机制和细节

保持简洁，一次只讲一个核心点。语气专业但友好。`,

  [TeachingPhase.Transfer]: (_item) => `
**当前阶段：迁移测试**

**你的任务**：测试学生能否将知识迁移到新场景。
**策略**：给出一个实际场景，让学生应用所学。

示例：
"现在假设有一个类似的情况...你会怎么处理？"

鼓励他们类比、举一反三。`,
};

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
 * 根据 LearningItem 构建 System Prompt
 */
function buildSystemPrompt(item: LearningItem): string {
  // 如果还没有明确学习目标，返回初始 Prompt
  if (item.goal === AWAITING_TOPIC_GOAL) {
    return INITIAL_PROMPT;
  }

  // 确定当前教学阶段
  const phase = determineTeachingPhase(item);
  const phasePrompt = PHASE_PROMPT_BUILDERS[phase](item);

  return `你是一位教学专家。你的目标不是直接讲解知识，而是引导学生自己构建理解。

当前学习目标：${item.goal}
当前认知状态：${item.cognitiveState.summary}
缺失部分：${item.cognitiveState.missingParts ?? "未知"}
${phasePrompt}`;
}

/**
 * 将内部消息转换为 OpenAI 消息格式
 */
function convertToOpenAIMessages(
  messages: readonly Message[]
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages.slice(-MAX_CONTEXT_MESSAGES).map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));
}

// ============================================================================
// 节点函数
// ============================================================================

/**
 * 从 config 中安全取出 userId（用于 Mem0）
 */
function getUserIdFromConfig(config?: RunnableConfig): string | undefined {
  const id = config?.configurable?.userId;
  return typeof id === "string" && id.trim() ? id : undefined;
}

/**
 * guideNode - 生成引导语
 *
 * @param state - 当前图状态
 * @param config - 可选的运行配置；config.configurable.userId 存在时会将本轮对话写入 Mem0
 * @returns 更新后的部分状态
 */
export async function guideNode(
  state: GraphState,
  config?: RunnableConfig
): Promise<Partial<GraphState>> {
  console.log("🟢 [guideNode] 开始生成引导");

  const activeItemId = state.activeItemId;
  if (!activeItemId) {
    console.error("  ❌ 没有活动的学习项");
    return {};
  }

  const activeItem = state.learningItems[activeItemId];
  if (!activeItem) {
    console.error(`  ❌ 找不到学习项: ${activeItemId}`);
    return {};
  }

  // 构建 System Prompt
  const systemPrompt = buildSystemPrompt(activeItem);

  const modelName = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const apiBase = cleanApiBaseUrl(
    process.env.OPENAI_API_BASE ?? DEFAULT_API_BASE
  );

  console.log(`  🤖 使用模型: ${modelName}`);

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: apiBase,
  });

  // 构建 messages
  const contextMessages = convertToOpenAIMessages(state.messages);
  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [{ role: "system", content: systemPrompt }, ...contextMessages];

  // 如果是初始引导，提高温度增加随机性
  const isInitialPrompt = activeItem.goal === AWAITING_TOPIC_GOAL;
  const temperature = isInitialPrompt ? INITIAL_TEMPERATURE : NORMAL_TEMPERATURE;

  try {
    const response = await client.chat.completions.create({
      model: modelName,
      messages,
      temperature,
    });

    const guideMessage = response.choices[0]?.message?.content ?? "";
    console.log(`✅ [guideNode] 生成完成: ${guideMessage.substring(0, 50)}...`);

    const newMessage: Message = { role: "assistant", content: guideMessage };

    // Mem0：若有 userId 且本轮有用户输入，将本轮对话写入长期记忆
    const userId = getUserIdFromConfig(config);
    if (userId && state.lastUserInput.trim()) {
      await addMemories(
        [
          { role: "user", content: state.lastUserInput },
          { role: "assistant", content: guideMessage },
        ],
        userId
      );
    }

    return {
      messages: [...state.messages, newMessage],
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ [guideNode] LLM 调用失败: ${message}`);

    // 降级处理：返回默认消息
    const fallbackMessage: Message = {
      role: "assistant",
      content: "抱歉，我遇到了一些问题。请稍后再试。",
    };

    return {
      messages: [...state.messages, fallbackMessage],
    };
  }
}
