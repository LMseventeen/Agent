# Mem0 记忆层学习笔记

> 参考：[mem0ai/mem0](https://github.com/mem0ai/mem0) · [Mem0 文档](https://docs.mem0.ai) · [LangGraph 集成](https://docs.mem0.ai/integrations/langgraph)

## 1. 是什么

**Mem0**（读作 "mem-zero"）是为 AI 助手/Agent 提供的**智能记忆层**：

- 记住用户偏好、适应个体需求、随时间持续学习
- 适合：客服聊天机器人、AI 助手、自主系统
- 官方数据（LOCOMO 基准）：相对 OpenAI Memory **+26% 准确率**、**91% 更快**、**90% 更少 token**

### 核心能力

| 能力 | 说明 |
|------|------|
| **多级记忆** | User、Session、Agent 状态，支持个性化 |
| **开发友好** | 直观 API、多平台 SDK（Python / Node）、托管服务可选 |

---

## 2. 两种使用方式

### 2.1 托管平台（Mem0 Platform）

- 注册 [app.mem0.ai](https://app.mem0.ai)，获取 API Key
- 通过 SDK 或 REST API 接入，自动更新、分析、企业级安全

### 2.2 自托管（开源）

- **Python**：`pip install mem0ai`
- **Node/TypeScript**：`npm install mem0ai`

---

## 3. 基本用法

### 3.1 托管 API（MemoryClient）

需要 `MEM0_API_KEY`，面向 Mem0 云服务。

**Python：**

```python
from mem0 import MemoryClient

client = MemoryClient(api_key="your-api-key")

# 写入记忆（从对话中提炼）
messages = [
    {"role": "user", "content": "我是素食者，对坚果过敏。"},
    {"role": "assistant", "content": "好的，我会记住你的饮食偏好。"}
]
client.add(messages, user_id="user123")

# 检索相关记忆
results = client.search("我的饮食限制是什么？", filters={"user_id": "user123"})
```

**JavaScript/TypeScript：**

```ts
import MemoryClient from "mem0ai";

const client = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });

const messages = [
  { role: "user", content: "我是素食者，对坚果过敏。" },
  { role: "assistant", content: "好的，我会记住你的饮食偏好。" },
];
await client.add(messages, { user_id: "user123" });

const results = await client.search("我的饮食限制是什么？", {
  filters: { user_id: "user123" },
});
```

### 3.2 开源/自托管（Memory）

使用本地或自建向量库，需配置 LLM（默认 `gpt-4.1-nano-2025-04-14`）。

**Python：**

```python
from mem0 import Memory

memory = Memory()

# 检索 → 拼进 prompt → 生成回复 → 再写入
relevant = memory.search(query=message, user_id=user_id, limit=3)
# ...
memory.add(messages, user_id=user_id)
```

**TypeScript（OSS）：**

```ts
import { Memory } from "mem0ai/oss";

const memory = new Memory();

await memory.add(messages, {
  userId: "alice",
  metadata: { category: "movie_recommendations" },
});

const results = await memory.search("你了解我什么？", { userId: "alice" });
```

---

## 4. 与 LangGraph 的集成思路

官方示例是「客服 Agent」：用 LangGraph 管对话流，用 Mem0 做长期记忆。

1. **State 里带 `mem0_user_id`**（或等效的用户标识）
2. **节点内**：先 `mem0.search(当前用户消息, user_id)`，把检索到的记忆拼进 system/context
3. **LLM 生成回复后**：把 `[user, assistant]` 的 messages 传给 `mem0.add(..., user_id)`，让 Mem0 自动提炼并存储
4. **图结构**：例如 `START → chatbot → chatbot` 的循环，每次请求都先查记忆再生成再写入

要点：

- 记忆的**键**是 `user_id`（和可选的 `metadata`），检索按 query 语义 + 过滤条件
- 写入的是**原始 messages**，由 Mem0 内部用 LLM 做摘要/提炼，无需自己写“记忆句子”

---

## 5. 与本项目（Learning Agent）的关系

当前设计（见 `learning_agent.md`）强调：

- **State 是唯一长期、结构化思维的载体**
- **LearningItem** 表示「围绕一个学习目标的认知状态」
- 所有与学习相关的关键信息都应进入 State

Mem0 可以与之**并存**、分工明确：

| 层次 | 更适合的载体 | 说明 |
|------|--------------|------|
| **会话内 / 当前学习目标** | LangGraph State + LearningItem | 当前认知层级、证据、下一步教学意图，强结构、强类型 |
| **跨会话 / 长期偏好与历史** | Mem0 | 例如“该学生偏好先看例子”“容易在某某概念上卡住”，非结构化或半结构化 |

可以这样用 Mem0：

- 用 **user_id = 学生 ID**，把每轮或每个 LearningItem 结束后的对话摘要/结果交给 Mem0 写入
- 在 **assess / guide 等节点**里，用 `memory.search(当前目标或学生输入, user_id)` 拉取与该学生相关的历史记忆，作为 prompt 的补充上下文
- 不在 Mem0 里替代 LearningItem，而是用 Mem0 做「学生长期记忆层」，State + LearningItem 做「当前教学状态机」

---

## 6. API 速查（Node/TypeScript）

- **托管**：`MemoryClient`，构造时 `{ apiKey }`，方法通常为 `add(messages, { user_id })`、`search(query, { filters })`
- **开源**：`mem0ai/oss` 的 `Memory`，`add(messages, { userId, metadata })`、`search(query, { userId })`
- 其他：`get`、`getAll`、`update`、`delete`、`deleteAll`、`history`、`reset` 等见 [API Reference](https://docs.mem0.ai/api-reference)

---

## 7. 本项目已集成说明

项目支持两种模式（**二选一**即可启用记忆层）：

- **托管**：配置 `MEM0_API_KEY`（Mem0 官方 key），记忆存云端，无需本地向量库。
- **本地 OSS**：不配 `MEM0_API_KEY` 时，使用 mem0ai/oss 本地 Memory（需 `OPENAI_API_KEY` 或 Ollama）。

### 启用方式

**方式 A：Mem0 托管（推荐，用官方 key）**

1. 在 [Mem0 Platform](https://app.mem0.ai) 获取 API Key，在 `.env` 中配置：
   ```bash
   MEM0_API_KEY=m0-xxxxxxxx
   ```
   配置后即启用记忆层，无需再配 OPENAI 相关变量给 Mem0。

**方式 B：本地 OSS**

1. 不配置 `MEM0_API_KEY`，与教学 Agent 共用 LLM 配置，在 `.env` 中：
   ```bash
   OPENAI_API_KEY=你的密钥
   OPENAI_API_BASE=https://api.xxx.com/v1   # 可选
   OPENAI_MODEL=gpt-4o-mini
   ```
2. 可选：记忆专用 embedding 模型（默认 `text-embedding-3-small`）：
   ```bash
   MEM0_EMBEDDING_MODEL=text-embedding-3-small
   ```
3. 可选：向量库与历史库路径（默认在项目下 `data/`）：
   ```bash
   MEM0_VECTOR_DB_PATH=data/vector_store.db
   MEM0_HISTORY_DB_PATH=data/memory_history.db
   ```
4. 可选：`MEM0_CUSTOM_INSTRUCTIONS`（如 `用中文总结并存储`）可引导 Mem0 抽取记忆时的表述方式。
5. **若出现 401（API key 错误）**：mem0ai 自带的 OpenAI embedder 不会使用 `OPENAI_API_BASE`，请求会发往 `api.openai.com`，用第三方 key（如 SiliconFlow）会报 401。可用**本地 Ollama** 做 embedding，仅摘要用你的 API：
   ```bash
   MEM0_EMBEDDER=ollama
   MEM0_OLLAMA_URL=http://localhost:11434
   MEM0_OLLAMA_EMBED_MODEL=nomic-embed-text
   ```
   需本机已安装并运行 Ollama，且拉取过 `nomic-embed-text`（`ollama pull nomic-embed-text`）。不配置则使用默认 `data/` 下路径。未配置 `OPENAI_API_KEY` 时：记忆层不启用。

### 行为说明

| 位置 | 行为 |
|------|------|
| **assess 节点** | 若 `config.configurable.userId` 存在，用当前用户输入/学习目标做 `memory.search`，将检索到的历史记忆拼入评估 LLM 的 prompt。 |
| **guide 节点** | 若存在 `userId` 且本轮有用户输入，在生成引导语后，将本轮 `[user, assistant]` 调用 `memory.add` 写入 Mem0（不写 metadata，由 Mem0 按内容抽取记忆）。 |
| **交互式 CLI** | 登录后若有本地进度或 Mem0 学习记录，会问「还想继续吗？」；每轮对话结束将当前 goal + level 写入本地进度（`data/user_progress.json`），再次登录时优先用该进度恢复**正确的 level**。 |

### 再次登录与「欢迎回来」

- **优先用本地进度**：`src/progress-store.ts` 按用户持久化「上次学习目标 + 认知层级」到 `data/user_progress.json`。再次登录时先读该进度；若有，则用其中的 goal 与 **level** 做恢复，避免错误地回到 level 1。
- **无本地进度时**：若 Mem0 已启用，则 `searchMemories("用户学习目标 当前学习", userId)` 取第一条记忆文本作为 goal，level 固定为 1。
- 提示语：「欢迎回来，{用户名}！上次你在学「{goal}」，当时到了 Level {level}。还想继续吗？(回车继续 / 输入 n 开新话题)」。
- 用户选继续：`selectItemNode` 根据 `config.configurable.resumeGoal` 与 `resumeLevel`（来自进度或 1）创建恢复项；`guideNode` 首条消息使用「欢迎回来」专用 Prompt。

### 代码入口

- 记忆封装：`src/memory/mem0.ts`（`searchMemories`、`addMemories`、`isMem0Enabled`）
- 用户进度（欢迎回来 level）：`src/progress-store.ts`（`getProgress`、`saveProgress`），每轮有实质学习目标时由 interactive 写入
- 评估侧：`src/assessment/llm.ts` 的 `llmBasedAssessment(..., options?.memoryContext)`
- 节点：`src/nodes/assess.ts`、`src/nodes/guide.ts` 中读取 `config?.configurable?.userId` 并调用 memory 模块

---

## 8. 参考链接

- [Mem0 官网](https://mem0.ai)
- [GitHub - mem0ai/mem0](https://github.com/mem0ai/mem0)
- [文档首页](https://docs.mem0.ai)
- [Quickstart](https://docs.mem0.ai/quickstart)
- [LangGraph 集成](https://docs.mem0.ai/integrations/langgraph)
- [论文](https://mem0.ai/research)（Building Production-Ready AI Agents with Scalable Long-Term Memory）
