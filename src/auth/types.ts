/**
 * 认证模块类型定义
 *
 * 用户、登录输入、会话、认证结果等
 */

// ============================================================================
// 用户
// ============================================================================

/**
 * 用户 - 存储层实体（不含密码明文）
 */
export interface User {
  readonly id: string;
  readonly username: string;
  readonly passwordHash: string;
  readonly createdAt: number;
}

/**
 * 用户公开信息 - 返回给客户端，不含敏感字段
 */
export interface UserPublic {
  readonly id: string;
  readonly username: string;
  readonly createdAt: number;
}

// ============================================================================
// 登录 / 注册输入
// ============================================================================

/**
 * 登录请求体
 */
export interface LoginInput {
  readonly username: string;
  readonly password: string;
}

/**
 * 注册请求体
 */
export interface RegisterInput {
  readonly username: string;
  readonly password: string;
}

// ============================================================================
// 认证结果（Result 模式）
// ============================================================================

/**
 * 登录成功载荷
 */
export interface AuthSession {
  readonly user: UserPublic;
  readonly token: string;
  readonly expiresAt: number;
}

/**
 * 认证结果 - 成功返回会话，失败返回错误信息
 */
export type AuthResult =
  | { readonly ok: true; readonly session: AuthSession }
  | { readonly ok: false; readonly error: string };

// ============================================================================
// 常量
// ============================================================================

/** 用户名最小长度 */
export const USERNAME_MIN_LENGTH = 2;

/** 用户名最大长度 */
export const USERNAME_MAX_LENGTH = 32;

/** 密码最小长度 */
export const PASSWORD_MIN_LENGTH = 6;
