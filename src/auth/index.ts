/**
 * 认证模块入口
 *
 * 导出类型与登录/注册/验证 API
 */
export type {
  User,
  UserPublic,
  LoginInput,
  RegisterInput,
  AuthResult,
  AuthSession,
} from "./types.js";
export {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "./types.js";
export { register, login, verifyToken } from "./auth-service.js";
export { findByUsername, findById } from "./user-store.js";
