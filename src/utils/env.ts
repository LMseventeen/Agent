/**
 * 环境变量加载器
 *
 * 简单的 .env 文件加载器，不依赖 dotenv 包
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// 类型定义
// ============================================================================

interface EnvLoadResult {
  readonly loaded: boolean;
  readonly count: number;
}

// ============================================================================
// 常量
// ============================================================================

const ENV_FILE_NAME = ".env";

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 解析单行环境变量
 *
 * @returns [key, value] 或 null（如果行无效）
 */
function parseLine(line: string): [string, string] | null {
  const trimmed = line.trim();

  // 跳过注释和空行
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const equalIndex = trimmed.indexOf("=");
  if (equalIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, equalIndex).trim();
  const rawValue = trimmed.slice(equalIndex + 1).trim();

  if (!key) {
    return null;
  }

  // 移除引号
  const value = rawValue.replace(/^["']|["']$/g, "");

  return [key, value];
}

// ============================================================================
// 主函数
// ============================================================================

/**
 * 加载 .env 文件中的环境变量
 *
 * @returns 加载结果
 */
export function loadEnv(): EnvLoadResult {
  const envPath = join(process.cwd(), ENV_FILE_NAME);

  if (!existsSync(envPath)) {
    console.log("⚠️  未找到 .env 文件，使用系统环境变量");
    return { loaded: false, count: 0 };
  }

  try {
    const envContent = readFileSync(envPath, "utf-8");
    const lines = envContent.split("\n");
    let count = 0;

    for (const line of lines) {
      const parsed = parseLine(line);
      if (parsed) {
        const [key, value] = parsed;
        process.env[key] = value;
        count++;
      }
    }

    console.log(`✅ 已加载 .env 文件 (${count} 个变量)`);
    return { loaded: true, count };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ 加载 .env 文件失败: ${message}`);
    return { loaded: false, count: 0 };
  }
}
