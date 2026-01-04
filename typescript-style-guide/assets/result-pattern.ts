/**
 * Result 模式示例代码
 * 用于替代 try-catch 的函数式错误处理
 */

// ============================================
// 1. 基础 Result 类型定义
// ============================================

type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// ============================================
// 2. 工厂函数
// ============================================

const Ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

const Err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

// ============================================
// 3. 实际使用示例
// ============================================

interface User {
  id: string;
  name: string;
  email: string;
}

class UserNotFoundError extends Error {
  constructor(public readonly userId: string) {
    super(`User not found: ${userId}`);
    this.name = "UserNotFoundError";
  }
}

class ValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

type FetchUserError = UserNotFoundError | ValidationError;

async function fetchUser(id: string): Promise<Result<User, FetchUserError>> {
  // 验证输入
  if (!id || id.length === 0) {
    return Err(new ValidationError("id", "User ID cannot be empty"));
  }

  try {
    // 模拟 API 调用
    const response = await fetch(`/api/users/${id}`);

    if (response.status === 404) {
      return Err(new UserNotFoundError(id));
    }

    const user: User = await response.json();
    return Ok(user);
  } catch (error) {
    return Err(new ValidationError("network", "Network error occurred"));
  }
}

// ============================================
// 4. 消费 Result
// ============================================

async function displayUser(userId: string): Promise<void> {
  const result = await fetchUser(userId);

  if (!result.ok) {
    // 类型安全的错误处理
    const error = result.error;

    if (error instanceof UserNotFoundError) {
      console.log(`User ${error.userId} does not exist`);
      return;
    }

    if (error instanceof ValidationError) {
      console.log(`Validation failed on ${error.field}: ${error.message}`);
      return;
    }

    // 穷尽检查
    const _exhaustive: never = error;
    return _exhaustive;
  }

  // result.value 的类型是 User
  const user = result.value;
  console.log(`Hello, ${user.name}!`);
}

// ============================================
// 5. 链式操作辅助函数
// ============================================

function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (!result.ok) {
    return result;
  }
  return Ok(fn(result.value));
}

function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (!result.ok) {
    return result;
  }
  return fn(result.value);
}

function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (!result.ok) {
    return defaultValue;
  }
  return result.value;
}

// 使用示例
async function getUserDisplayName(userId: string): Promise<string> {
  const result = await fetchUser(userId);
  const nameResult = map(result, (user) => user.name);
  return unwrapOr(nameResult, "Anonymous");
}

export {
  Result,
  Ok,
  Err,
  map,
  flatMap,
  unwrapOr,
  fetchUser,
  displayUser,
  getUserDisplayName,
};

