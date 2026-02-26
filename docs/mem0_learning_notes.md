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

## 7. 参考链接

- [Mem0 官网](https://mem0.ai)
- [GitHub - mem0ai/mem0](https://github.com/mem0ai/mem0)
- [文档首页](https://docs.mem0.ai)
- [Quickstart](https://docs.mem0.ai/quickstart)
- [LangGraph 集成](https://docs.mem0.ai/integrations/langgraph)
- [论文](https://mem0.ai/research)（Building Production-Ready AI Agents with Scalable Long-Term Memory）
