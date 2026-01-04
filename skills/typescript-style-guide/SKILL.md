---
name: typescript-style-guide
description: TypeScript 代码规范技能，提供类型设计、函数规范、错误处理、控制流、模块组织等最佳实践指导。适用于后端、Agent、LangGraph、React 等 TypeScript 项目的代码审查和编写。
license: MIT
metadata:
  version: "1.0.0"
  language: zh-CN
  tags:
    - typescript
    - code-style
    - best-practices
    - type-safety
triggers:
  globs:
    - "**/*.ts"
    - "**/*.tsx"
    - "**/*.mts"
    - "**/*.cts"
---

# TypeScript 代码规范

> 目标：可读、可维护、可演进、类型可信  
> 适用范围：后端 / Agent / LangGraph / React / 业务逻辑型 TypeScript 项目

## 何时使用此技能

当你需要：
- 编写新的 TypeScript 代码
- 审查 TypeScript 代码质量
- 重构现有 TypeScript 代码
- 设计类型系统和接口
- 处理错误和异常
- 组织模块和导入

---

## 核心设计原则

### 终极判断标准

1. 只看类型是否能理解业务？
2. 类型是在保护你，还是折磨你？
3. 新需求是否让 TS 先报错？

> 好 TypeScript 代码不是炫技，而是让错误更早出现，让修改更便宜

### 核心理念

- 类型用于表达业务含义，而不是兜底
- 非法状态在类型层面不可表示
- 新需求应优先引发 TypeScript 编译错误，而不是运行时错误
- 改动成本应尽量集中在单一位置

---

## 类型设计规范

### 禁止使用 any

- 禁止在业务逻辑中使用 `any`
- 若必须使用，仅允许存在于边界层（IO / 第三方接口）
- 必须在 1～2 层内被消化为具体类型

```typescript
// ❌ 不好
function handle(input: any) {}

// ✅ 好
function parseInput(raw: unknown): ParsedInput {
  if (!isValid(raw)) {
    throw new ValidationError("Invalid input");
  }
  return raw;
}
```

### 优先使用 unknown

```typescript
// ✅ 处理未知类型
function parse(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("Expected string");
  }
  return value.trim();
}

// ✅ 错误处理使用 unknown
try {
  await riskyOperation();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
}
```

### 使用判别联合表示状态

```typescript
// ❌ 不好：状态组合可能产生非法状态
type State = {
  loading: boolean;
  data?: Data;
  error?: string;
};

// ✅ 好：非法状态不可表示
type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: Data }
  | { status: "error"; error: AppError };
```

### 类型命名必须是业务名词

```typescript
// ❌ 不好：含义模糊
type Data = {};
type Info = {};
type Result = {};

// ✅ 好：业务含义清晰
type CognitiveState = {};
type EvaluationResult = {};
type UserProfile = {};
```

### interface vs type 选择

```typescript
// ✅ 对象结构用 interface（可扩展）
interface User {
  id: string;
  name: string;
  email: string;
}

// ✅ 联合类型、交叉类型、工具类型用 type
type Status = "active" | "inactive" | "pending";
type UserWithRole = User & { role: UserRole };
type Nullable<T> = T | null;
```

### 泛型规范

- 泛型参数不超过 2 个
- 不为未来过度设计类型
- 使用描述性名称或单字母大写

```typescript
// ✅ 简单场景用单字母
function identity<T>(value: T): T {
  return value;
}

// ✅ 复杂场景用描述性名称
function transform<TInput, TOutput>(
  input: TInput,
  fn: (item: TInput) => TOutput
): TOutput {
  return fn(input);
}
```

---

## 函数设计规范

### 参数不超过 3 个

```typescript
// ❌ 不好
function evaluate(a: string, b: number, c: boolean, d: string) {}

// ✅ 好
interface EvaluateParams {
  answer: string;
  score: number;
  isFinal: boolean;
  strategy: Strategy;
}

function evaluate(params: EvaluateParams): EvaluationResult {}
```

### 函数签名必须自解释

```typescript
// ❌ 不好：含义模糊
function run(state: State) {}
function process(data: Data) {}

// ✅ 好：一眼看懂
function evaluateUnderstanding(state: CognitiveState): EvaluationResult {}
function validateUserInput(input: unknown): ValidatedInput {}
```

### 一个函数只做一件事

- 函数名包含 And / Then / Or → 拆分
- 超过 30 行 → 高度怀疑需要拆分

```typescript
// ❌ 不好
function validateAndSaveUser(user: User) {}

// ✅ 好
function validateUser(user: User): ValidatedUser {}
function saveUser(user: ValidatedUser): Promise<void> {}
```

### 返回值类型显式标注

```typescript
// ✅ 显式标注返回类型
async function fetchUser(id: string): Promise<User | null> {
  const response = await api.get(`/users/${id}`);
  return response.data;
}

// ✅ 使用 readonly 防止意外修改
function getItems(): readonly Item[] {
  return items;
}
```

---

## 控制流规范

### 禁止嵌套超过 2 层

```typescript
// ❌ 不好：嵌套地狱
if (a) {
  if (b) {
    if (c) {
      doSomething();
    }
  }
}

// ✅ 好：提前返回
if (!a) return;
if (!b) return;
if (!c) return;
doSomething();
```

### 使用映射表代替 if-else 链

```typescript
// ❌ 不好
function handle(phase: Phase) {
  if (phase === "planning") return handlePlanning();
  if (phase === "acting") return handleActing();
  if (phase === "reflecting") return handleReflecting();
}

// ✅ 好
const handlers: Record<Phase, Handler> = {
  planning: handlePlanning,
  acting: handleActing,
  reflecting: handleReflecting,
};

function handle(phase: Phase) {
  return handlers[phase]();
}
```

### switch 必须穷尽

```typescript
// ✅ 使用 never 确保穷尽检查
function handleStatus(status: Status): string {
  switch (status) {
    case "idle":
      return "等待中";
    case "loading":
      return "加载中";
    case "success":
      return "成功";
    case "error":
      return "失败";
    default:
      const _exhaustive: never = status;
      return _exhaustive;
  }
}
```

---

## 错误处理规范

### 禁止 Silent Failure

```typescript
// ❌ 不好：吞掉错误
try {
  run();
} catch (error) {
  console.log(error);
}

// ✅ 好：记录并重新抛出或处理
try {
  run();
} catch (error: unknown) {
  logger.error("Operation failed", { error });
  throw error;
}
```

### 自定义错误类

```typescript
// ✅ 定义业务错误类
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}

class ValidationError extends AppError {
  constructor(message: string, public readonly field: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}
```

### 核心流程推荐 Result 模式

```typescript
// ✅ Result 类型定义
type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// ✅ 使用示例
async function fetchUser(id: string): Promise<Result<User, ApiError>> {
  try {
    const user = await api.getUser(id);
    return { ok: true, value: user };
  } catch (error) {
    return { ok: false, error: ApiError.from(error) };
  }
}

// ✅ 消费 Result
const result = await fetchUser(id);
if (!result.ok) {
  logger.error(result.error);
  return;
}
const user = result.value; // 类型安全
```

---

## 导入与模块规范

### 导入规范

```typescript
// ✅ 类型导入使用 import type
import type { BaseMessage } from "@langchain/core/messages";
import type { ReactNode, FC } from "react";

// ✅ 按来源分组，空行分隔
// 1. Node 内置模块
import path from "node:path";
import fs from "node:fs/promises";

// 2. 外部依赖
import { z } from "zod";
import { useState, useEffect } from "react";

// 3. 内部模块
import { UserService } from "@/services/user";
import { formatDate } from "@/utils/date";

// 4. 类型导入
import type { User, UserRole } from "@/types";
```

### 模块结构

```
agent/
├─ types.ts        # 类型定义
├─ state.ts        # 状态管理
├─ handlers.ts     # 处理函数
├─ transitions.ts  # 状态转换
└─ index.ts        # 统一导出
```

- 一个文件只负责一个概念
- 禁止 `utils.ts` 地狱
- 使用 barrel exports 统一导出

```typescript
// index.ts - 统一导出点
export { UserService } from "./user-service";
export { AuthService } from "./auth-service";
export type { User, AuthToken } from "./types";
```

---

## 命名约定

### 变量与函数

```typescript
// 变量/函数：camelCase
const userName = "alice";
const fetchUserData = async () => {};

// 常量：UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = process.env.API_URL ?? "http://localhost:3000";

// 布尔变量：is/has/can/should 前缀
const isLoading = true;
const hasPermission = false;
const canEdit = user.role === "admin";
```

### 类型与接口

```typescript
// 类/接口/类型：PascalCase
interface UserProfile {}
type RequestStatus = "idle" | "loading" | "success" | "error";
class UserService {}

// 枚举：PascalCase，成员用 PascalCase
enum HttpStatus {
  Ok = 200,
  NotFound = 404,
  InternalError = 500,
}
```

### 文件命名

```
# 规则
- 普通模块：kebab-case.ts（如 user-service.ts）
- ES Module：kebab-case.mts（如 agent.mts）
- React 组件：PascalCase.tsx（如 UserProfile.tsx）
- 类型定义：kebab-case.d.ts（如 global.d.ts）
- 测试文件：*.test.ts 或 *.spec.ts
```

---

## 异步处理规范

### 使用 async/await

```typescript
// ✅ 使用 async/await 而非 Promise 链
async function fetchData(): Promise<Data> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError(`HTTP ${response.status}`, response.status);
  }
  return response.json();
}
```

### 并行与串行

```typescript
// ✅ 无依赖关系时并行执行
const [users, posts] = await Promise.all([
  fetchUsers(),
  fetchPosts(),
]);

// ✅ 部分失败场景用 Promise.allSettled
const results = await Promise.allSettled([task1(), task2(), task3()]);
const successful = results
  .filter((r): r is PromiseFulfilledResult<Data> => r.status === "fulfilled")
  .map((r) => r.value);
```

---

## React 组件规范

### 组件定义

```typescript
// ✅ 函数组件 + 显式 Props 类型
interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  onClick?: () => void;
}

export function Button({
  children,
  variant = "primary",
  disabled = false,
  onClick,
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
```

### 事件处理器类型

```typescript
function Form() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // ...
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### 自定义 Hook

```typescript
// ✅ 命名以 use 开头，返回类型显式标注
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

---

## 注释规范

### JSDoc 注释

```typescript
/**
 * 用户服务 - 处理用户相关的业务逻辑
 *
 * @example
 * const service = new UserService(repository);
 * const user = await service.findById("123");
 */
class UserService {
  /**
   * 根据 ID 查找用户
   * @param id - 用户唯一标识
   * @returns 用户对象，不存在时返回 null
   * @throws {ValidationError} 当 ID 格式无效时
   */
  async findById(id: string): Promise<User | null> {
    // ...
  }
}
```

### 行内注释

```typescript
// ✅ TODO 注释包含责任人和日期
// TODO(alice): 添加缓存支持 - 2024-01-15

// ✅ 复杂逻辑添加说明
// 使用二分查找优化性能，时间复杂度 O(log n)
function binarySearch(arr: number[], target: number): number {
  // ...
}

// ✅ 解释"为什么"而不是"是什么"
// 延迟 100ms 等待动画完成，避免布局抖动
await sleep(100);
```

---

## 工具配置

### tsconfig.json

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### ESLint 推荐规则

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error"
  }
}
```

---

## 快速检查清单

### 类型设计
- [ ] 是否避免了 `any` 类型？
- [ ] 是否使用判别联合表示状态？
- [ ] 类型命名是否是业务名词？

### 函数设计
- [ ] 参数是否不超过 3 个？
- [ ] 函数是否只做一件事？
- [ ] 返回值类型是否显式标注？

### 代码质量
- [ ] 嵌套是否不超过 2 层？
- [ ] 是否使用 `import type` 分离类型导入？
- [ ] 错误处理是否使用 `unknown`？

### 工程规范
- [ ] 常量是否提取并使用 UPPER_SNAKE_CASE？
- [ ] 配置是否使用环境变量？
- [ ] 复杂逻辑是否有注释说明？

