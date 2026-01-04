# Learning Agent 设计说明文档

## 1. 设计背景（Why）

### 1.1 教学问题本质
在真实教学与学习系统中，常见的失败模式不是“学生没听”，而是：
- 学生**不知道自己在学什么**；
- 学生只能“感觉好像懂了”，但**说不清、抓不住**；
- 知识始终依附在教师或讲解者身上，**没有进入学生自己的认知系统**。

这会导致：
- 学习无法迁移；
- 评估只能靠“对/错”，而不是理解状态；
- 系统无法判断“下一步该怎么教”。

### 1.2 核心教学目标
本 Agent 的目标不是“讲清楚知识”，而是：

> **让学生知道自己在学什么，并在认知中形成一个可抓住的概念锚点。**

为此，系统必须：
1. 把学生的“感觉”转化为**清晰、可结构化的认知状态**；
2. 明确概念边界，消除模糊区；
3. 让知识从“教师话语”中脱离，进入**学生可表达、可操作的认知结构**。

---

## 2. 总体设计思想（How）

### 2.1 LangGraph 中 State 的地位

在 LangGraph 中：
- **State 是系统唯一拥有长期、结构化思考能力的地方**；
- 如果 State 为空或无结构：
  - 节点无法基于历史认知作判断；
  - 图将退化为“多轮对话模型”；
  - Agent 无法真正“教”。

因此：
> **所有与学习相关的关键信息，必须进入 State。**

### 2.2 LearningItem：认知的最小结构单元

为了解决“系统如何感知学生正在学什么、学到哪一步”，我们引入一个核心抽象：

> **LearningItem = 围绕一个学习目标，系统对学生认知状态的结构化记录。**

它不是题目、不是知识点列表，而是：
- 一个明确的**学习目标**；
- 学生当前所处的**认知层级**；
- 系统对学生认知状态的判断与证据；
- 系统下一步的教学意图。

LearningItem 是：
- 可复用的；
- 可被多个 Agent / Graph 使用的；
- 教学决策的最小依据单位。

---

## 3. LearningItem 结构设计

### 3.1 LearningItem 字段定义

```ts
interface LearningItem {
  id: string;                    // 唯一标识
  goal: string;                  // 学习目标（学生应该“知道/能做什么”）

  currentLevel: CognitiveLevel;  // 当前认知层级
  cognitiveState: CognitiveState;// 认知状态描述（系统判断）

  recentEvidence: Evidence[];    // 最近的语言/行为证据
  nextIntent: TeachingIntent;    // 下一步教学意图
}
```

### 3.2 认知层级（CognitiveLevel）

这是教学推进的“主轴”，而不是难度等级。

```ts
enum CognitiveLevel {
  IntuitionOnly = 1,   // 有直觉但说不清
  CanDescribe = 2,    // 能描述但结构混乱
  Structured = 3,     // 能用清晰结构表达
  Transferable = 4    // 能迁移、应用、类比
}
```

**关键原则**：
- 不允许跳级教学；
- 教学动作必须与当前 Level 匹配。

### 3.3 CognitiveState（关键认知状态）

```ts
interface CognitiveState {
  summary: string;        // 当前理解的自然语言概括
  missingParts?: string; // 关键缺失或模糊点
  misconceptions?: string[]; // 已识别的误解
}
```

### 3.4 Evidence（证据）

```ts
interface Evidence {
  source: "user_input" | "assessment";
  content: string;       // 原始表达
  timestamp: number;
}
```

### 3.5 TeachingIntent（下一步意图）

```ts
type TeachingIntent =
  | "elicit_intuition"   // 引导表达直觉
  | "force_clarification"// 强迫说清楚
  | "introduce_structure"// 给出结构
  | "test_transfer";    // 测试迁移
```

---

## 4. 教学策略核心原则

### 4.1 为什么 Level 1 不能直接解释

当学生处于：

> **“有直觉但说不清”（Level 1）**

此时直接解释会：
- 覆盖学生尚未暴露的模糊点；
- 制造“听懂错觉”；
- 让系统误判理解已经发生。

因此，这是**坏教学**。

### 4.2 Level 1 的唯一正确动作

> **引导学生先说——不管对不对。**

典型提示：
> “你先不用管对不对，按你现在的理解，说说这个东西是怎么回事。”

目标不是正确性，而是：
- 暴露认知形状；
- 为评估节点提供真实证据。

---

## 5. Agent 能力边界（What it can do）

该 Learning Agent 具备以下能力：

1. **识别学生当前认知层级**；
2. 基于语言证据更新 LearningItem；
3. 决定“下一步该引导，还是该评估，还是该讲结构”；
4. 在 State 中持续累积认知轨迹；
5. 避免退化为单纯聊天模型。

它**不做**：
- 一次性讲完整知识；
- 只基于对错评分；
- 无状态的问答循环。

---

## 6. LangGraph 图结构设计

### 6.1 全局 State 定义

```ts
interface GraphState {
  learningItems: Record<string, LearningItem>;
  activeItemId: string | null;
  lastUserInput?: string;
}
```

### 6.2 节点总览

| 节点名 | 作用 |
|------|----|
| selectItemNode | 确定当前 LearningItem |
| guideNode | 根据 nextIntent 引导学生 |
| assessNode | 评估学生输入，更新认知状态 |
| decideNode | 决定下一条边 |

---

## 7. 节点设计详解

### 7.1 selectItemNode

**职责**：
- 若无 activeItem，新建 LearningItem；
- 或选择当前正在学习的目标。

输出：更新 `activeItemId`。

---

### 7.2 guideNode（引导节点）

**输入依据**：
- LearningItem.currentLevel
- LearningItem.nextIntent

**行为原则**：
- guide ≠ explain
- 只负责“促使学生表达或操作”。

示例：
- Level 1 + elicit_intuition → 开放式描述问题
- Level 2 + force_clarification → 要求定义 / 对比

---

### 7.3 assessNode（LLM + 规则混合评估）

#### 7.3.1 输入
- lastUserInput
- 当前 LearningItem

#### 7.3.2 评估机制

**规则层（Hard Rules）**：
- 是否出现关键概念词；
- 是否存在因果 / 结构语言；
- 是否仍停留在比喻、感觉描述。

**LLM 层（Soft Judgment）**：
- 总体理解形状判断；
- 是否“像是懂了但说不清”；
- 是否存在稳定结构。

#### 7.3.3 输出
- 更新 currentLevel
- 更新 cognitiveState
- 写入 recentEvidence
- 生成 nextIntent

---

### 7.4 decideNode

**作用**：
- 根据 LearningItem 状态选择下一条边。

示例逻辑：
- 若 level 未提升 → 回到 guideNode
- 若达到 Structured → introduce_structure
- 若达到 Transferable → test_transfer 或结束

---

## 8. 边（Edges）定义

```text
selectItemNode → guideNode

guideNode → assessNode

assessNode → decideNode

decideNode → guideNode | END
```

这是一个**认知闭环**，而不是线性流程。

---

## 9. 关键总结

- State 决定了 Agent 是否真的在“教”；
- LearningItem 是教学系统的认知锚点；
- 不同认知层级，对应完全不同的教学动作；
- LangGraph 负责流程控制，LearningItem 负责“理解学生”；
- assessNode 是系统智能的核心，不是附属组件。

> **这个 Agent 的本质不是“回答问题”，而是“推动认知状态发生变化”。**


---

## 示例：一次完整的教学评估与引导流程（Worked Example）

本节通过一个**真实交互示例**，演示本 Learning Agent 如何：
- 感知学生的认知状态
- 在 *rule + LLM* 混合评估下做出判断
- 更新 State
- 决定下一步教学动作

### 示例背景

- **LearningItem.goal**：
  > 理解「LangGraph 中 State 的作用，以及为什么 State 是图中不可或缺的一部分」

- **当前教学目标**：
  让学生形成一个清晰的概念锚点：
  > *State 是 LangGraph 中唯一承载长期、结构化思考与决策信息的地方*。

---

### Step 1：学生的原始回答（用户表现）

> “State 是用来记录图的状态信息的。”

这是一个**典型的‘有直觉但说不清’回答**：
- 方向正确
- 表述抽象、泛化
- 没有触及「为什么不能没有 State」这一关键边界

---

### Step 2：规则评估（Rule-based Assessment）

```ts
ruleBasedAssessment(answer)
```

结果：
```ts
{
  confidence: "low",
  signal: "normal"
}
```

解释：
- 文本非空
- 长度正常
- 规则无法给出强判断 → 进入 LLM 评估

---

### Step 3：LLM 认知评估（LLM-based Assessment）

LLM 接收到的信息：

- **学习目标**：理解 State 在 LangGraph 中的本质作用
- **学生回答**："State 是用来记录图的状态信息的"

LLM 输出（离散标签）：

```text
intuition_but_unclear
```

含义：
- 学生知道“State 是核心概念”
- 但尚未能解释其不可替代性
- 概念边界仍然模糊

---

### Step 4：融合判断（Merge Assessment）

```ts
mergeAssessment(ruleResult, llmResult)
```

最终 cognitiveState：

```ts
"intuition_but_unclear"
```

该状态被写入 LearningItem：

```ts
learningItem.cognitiveState = "intuition_but_unclear";
learningItem.recentEvidence = answer;
```

---

### Step 5：教学意图决策（Next Intent Decision）

根据教学规则映射：

```ts
if (cognitiveState === "intuition_but_unclear") {
  nextIntent = "elicit_explanation";
}
```

**系统决定不直接讲解**，而是进入“引导外化认知”的阶段。

---

### Step 6：生成引导型教学行为

Agent 给出的引导式回应示例：

> “你先不用管对不对，按你现在的理解，说说：
> 如果 LangGraph 里什么都不放进 State，会发生什么？”

这一行为的教学意义是：
- 强迫学生尝试用自己的语言补全概念
- 暴露认知边界
- 为后续结构化讲解创造条件

---

### Step 7：State 的关键变化总结

在这一次交互后，State 中发生的**本质变化**是：

- LearningItem 被显式标记为：
  - `cognitiveState = intuition_but_unclear`
- 系统知道：
  - 该知识点**尚未进入讲解阶段**
  - 下一步应继续引导，而不是灌输

---

### 这一示例说明了什么？

1. Agent 并不是在“回答问题”，而是在**调控学习进程**
2. State 让系统拥有了**跨轮次的一致教学判断**
3. LearningItem 是教学决策的最小语义单元
4. assessNode 是整个系统的“认知感知器”，而不是评分器

这一模式可以被复用到：
- 编程概念教学
- 系统设计理解
- 抽象原理学习
- Onboarding / 培训型智能体

---

