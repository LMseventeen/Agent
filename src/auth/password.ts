/**
 * 密码哈希与验证
 *
 * 使用 Node crypto.scrypt，无额外依赖
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// ============================================================================
// 常量
// ============================================================================

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;

// ============================================================================
// API
// ============================================================================

/**
 * 对明文密码做 scrypt 哈希
 *
 * @param plainPassword - 明文密码
 * @returns 格式为 "salt.hexKey" 的字符串，便于存储与验证
 */
export function hashPassword(plainPassword: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(plainPassword, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
  });
  return `${salt.toString("hex")}.${key.toString("hex")}`;
}

/**
 * 验证密码是否与存储的哈希匹配
 *
 * @param plainPassword - 用户输入的明文密码
 * @param storedHash - 存储的 "salt.hexKey" 字符串
 * @returns 是否匹配
 */
export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  const parts = storedHash.split(".");
  if (parts.length !== 2) {
    return false;
  }

  const [saltHex, keyHex] = parts;
  if (!saltHex || !keyHex) {
    return false;
  }

  let salt: Buffer;
  let storedKey: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    storedKey = Buffer.from(keyHex, "hex");
  } catch {
    return false;
  }

  if (salt.length !== SALT_LENGTH || storedKey.length !== KEY_LENGTH) {
    return false;
  }

  const derivedKey = scryptSync(plainPassword, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
  });

  return timingSafeEqual(storedKey, derivedKey);
}
