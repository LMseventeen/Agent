/**
 * 用户存储
 *
 * 内存 + 可选文件持久化，便于后续替换为数据库
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import type { User } from "./types.js";

// ============================================================================
// 常量
// ============================================================================

const DATA_DIR = "data";
const USERS_FILE = "users.json";

// ============================================================================
// 存储实现
// ============================================================================

const memory = new Map<string, User>();

/**
 * 生成简单唯一 ID（仅用于本地存储）
 */
function generateId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 获取数据文件路径
 */
function getDataPath(): string {
  return join(process.cwd(), DATA_DIR, USERS_FILE);
}

/**
 * 从文件加载用户到内存
 */
function loadFromFile(): void {
  const path = getDataPath();
  if (!existsSync(path)) {
    return;
  }

  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as { users: User[] };
    if (Array.isArray(data.users)) {
      for (const u of data.users) {
        memory.set(u.username.toLowerCase(), u);
      }
    }
  } catch {
    // 文件损坏或格式错误时忽略，保留内存状态
  }
}

/**
 * 将内存中的用户写入文件
 */
function saveToFile(): void {
  const path = getDataPath();
  const dir = join(process.cwd(), DATA_DIR);
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  } catch {
    return;
  }

  const users = Array.from(memory.values());
  try {
    writeFileSync(path, JSON.stringify({ users }, null, 2), "utf-8");
  } catch {
    // 写入失败不影响内存
  }
}

// 启动时加载
loadFromFile();

// ============================================================================
// 公开 API
// ============================================================================

/**
 * 按用户名查找用户（不区分大小写）
 */
export function findByUsername(username: string): User | null {
  return memory.get(username.toLowerCase()) ?? null;
}

/**
 * 按 ID 查找用户
 */
export function findById(id: string): User | null {
  for (const u of memory.values()) {
    if (u.id === id) return u;
  }
  return null;
}

/**
 * 创建用户并持久化
 *
 * @param username - 用户名
 * @param passwordHash - 已哈希的密码
 * @returns 新用户，或 null（用户名已存在）
 */
export function createUser(username: string, passwordHash: string): User | null {
  const normalized = username.trim().toLowerCase();
  if (memory.has(normalized)) {
    return null;
  }

  const user: User = {
    id: generateId(),
    username: normalized,
    passwordHash,
    createdAt: Date.now(),
  };

  memory.set(normalized, user);
  saveToFile();
  return user;
}
