/**
 * 认证服务：登录、注册、JWT 签发与验证
 */
import * as jose from "jose";

import { hashPassword, verifyPassword } from "./password.js";
import { findByUsername, findById, createUser } from "./user-store.js";
import type {
  User,
  UserPublic,
  LoginInput,
  RegisterInput,
  AuthResult,
  AuthSession,
} from "./types.js";
import {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "./types.js";

// ============================================================================
// 常量
// ============================================================================

const JWT_ISSUER = "learning-agent";
const JWT_AUDIENCE = "learning-agent";
const JWT_EXPIRES_IN = "7d";
const DEFAULT_JWT_SECRET = "dev-secret-change-in-production";

// ============================================================================
// 辅助
// ============================================================================

function toPublic(user: User): UserPublic {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
  };
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET;
}

async function getSecretKey(): Promise<Uint8Array> {
  const secret = getJwtSecret();
  return new TextEncoder().encode(secret);
}

// ============================================================================
// 校验
// ============================================================================

function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return `用户名至少 ${USERNAME_MIN_LENGTH} 个字符`;
  }
  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return `用户名最多 ${USERNAME_MAX_LENGTH} 个字符`;
  }
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(trimmed)) {
    return "用户名仅允许字母、数字、下划线和中文";
  }
  return null;
}

function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `密码至少 ${PASSWORD_MIN_LENGTH} 个字符`;
  }
  return null;
}

// ============================================================================
// 公开 API
// ============================================================================

/**
 * 注册新用户
 */
export async function register(input: RegisterInput): Promise<AuthResult> {
  const usernameError = validateUsername(input.username);
  if (usernameError) {
    return { ok: false, error: usernameError };
  }

  const passwordError = validatePassword(input.password);
  if (passwordError) {
    return { ok: false, error: passwordError };
  }

  const existing = findByUsername(input.username);
  if (existing) {
    return { ok: false, error: "用户名已被使用" };
  }

  const passwordHash = hashPassword(input.password);
  const user = createUser(input.username.trim(), passwordHash);
  if (!user) {
    return { ok: false, error: "注册失败" };
  }

  const token = await signToken(user);
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;

  const session: AuthSession = {
    user: toPublic(user),
    token,
    expiresAt,
  };
  return { ok: true, session };
}

/**
 * 登录
 */
export async function login(input: LoginInput): Promise<AuthResult> {
  const usernameError = validateUsername(input.username);
  if (usernameError) {
    return { ok: false, error: usernameError };
  }

  const user = findByUsername(input.username);
  if (!user) {
    return { ok: false, error: "用户名或密码错误" };
  }

  const valid = verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: "用户名或密码错误" };
  }

  const token = await signToken(user);
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;

  const session: AuthSession = {
    user: toPublic(user),
    token,
    expiresAt,
  };
  return { ok: true, session };
}

/**
 * 验证 JWT，返回用户公开信息；无效则返回 null
 */
export async function verifyToken(token: string): Promise<UserPublic | null> {
  try {
    const key = await getSecretKey();
    const { payload } = await jose.jwtVerify(token, key, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    const sub = payload.sub;
    if (typeof sub !== "string" || !sub) {
      return null;
    }

    const user = findById(sub);
    if (!user) {
      return null;
    }

    return toPublic(user);
  } catch {
    return null;
  }
}

/**
 * 签发 JWT
 */
async function signToken(user: User): Promise<string> {
  const key = await getSecretKey();
  return await new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(key);
}
