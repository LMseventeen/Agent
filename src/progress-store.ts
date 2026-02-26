/**
 * 用户学习进度存储
 *
 * 按用户持久化「上次学习目标 + 认知层级」，用于再次登录时正确恢复 level，
 * 避免仅依赖 Mem0 时只能恢复为 level 1 的问题。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// 类型
// ============================================================================

export interface UserProgress {
  goal: string;
  level: number;
  updatedAt: number;
}

const DATA_DIR = "data";
const PROGRESS_FILE = "user_progress.json";
const MIN_LEVEL = 1;
const MAX_LEVEL = 4;

function getFilePath(): string {
  return join(process.cwd(), DATA_DIR, PROGRESS_FILE);
}

function ensureDataDir(): void {
  const dir = join(process.cwd(), DATA_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function clampLevel(level: number): number {
  if (Number.isNaN(level) || level < MIN_LEVEL) return MIN_LEVEL;
  if (level > MAX_LEVEL) return MAX_LEVEL;
  return Math.floor(level);
}

/**
 * 读取该用户上次保存的学习进度
 */
export function getProgress(userId: string): UserProgress | null {
  const path = getFilePath();
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as Record<string, UserProgress>;
    const entry = data[userId];
    if (
      !entry ||
      typeof entry.goal !== "string" ||
      typeof entry.level !== "number"
    ) {
      return null;
    }
    const goal = entry.goal.trim();
    if (goal.length === 0) return null;
    return {
      goal,
      level: clampLevel(entry.level),
      updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

/**
 * 保存该用户当前学习进度（目标 + 层级），会话中每次有进展时调用
 */
export function saveProgress(
  userId: string,
  progress: { goal: string; level: number }
): void {
  const goal = progress.goal.trim();
  if (goal.length === 0) return;

  ensureDataDir();
  const path = getFilePath();
  let data: Record<string, UserProgress> = {};
  if (existsSync(path)) {
    try {
      const raw = readFileSync(path, "utf-8");
      data = JSON.parse(raw) as Record<string, UserProgress>;
    } catch {
      // 忽略损坏文件
    }
  }

  data[userId] = {
    goal,
    level: clampLevel(progress.level),
    updatedAt: Date.now(),
  };

  try {
    writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // 写入失败静默忽略
  }
}
