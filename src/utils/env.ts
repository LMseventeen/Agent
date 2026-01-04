import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * 简单的 .env 文件加载器
 * 不依赖 dotenv 包
 */
export function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  
  if (!existsSync(envPath)) {
    console.log('⚠️  未找到 .env 文件，使用系统环境变量');
    return;
  }

  try {
    const envContent = readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      
      // 跳过注释和空行
      if (!trimmed || trimmed.startsWith('#')) continue;

      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();

      if (key && value) {
        // 移除引号
        const cleanValue = value.replace(/^["']|["']$/g, '');
        process.env[key.trim()] = cleanValue;
      }
    }

    console.log('✅ 已加载 .env 文件');
  } catch (error) {
    console.error('❌ 加载 .env 文件失败:', error);
  }
}

