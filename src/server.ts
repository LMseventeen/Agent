/**
 * HTTP 服务：用户登录 / 注册 API
 *
 * 提供 POST /auth/register、POST /auth/login，返回 JWT
 */
import { createServer } from "node:http";

import { loadEnv } from "./utils/env.js";
import { register, login } from "./auth/index.js";

loadEnv();

// ============================================================================
// 常量
// ============================================================================

const PORT = Number(process.env.PORT) || 3000;

// ============================================================================
// 辅助
// ============================================================================

function parseUrl(pathname: string): { path: string; query: Record<string, string> } {
  const [path, queryStr] = pathname.split("?");
  const query: Record<string, string> = {};
  if (queryStr) {
    for (const part of queryStr.split("&")) {
      const [k, v] = part.split("=");
      if (k && v !== undefined) {
        query[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
      }
    }
  }
  return { path: path ?? "/", query };
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function sendJson(
  res: import("node:http").ServerResponse,
  status: number,
  data: object
): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
}

function sendCors(res: import("node:http").ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ============================================================================
// 路由处理
// ============================================================================

async function handlePostAuthRegister(body: string): Promise<{ status: number; data: object }> {
  let json: { username?: string; password?: string };
  try {
    json = JSON.parse(body) as { username?: string; password?: string };
  } catch {
    return { status: 400, data: { ok: false, error: "无效的 JSON" } };
  }

  const username = typeof json.username === "string" ? json.username : "";
  const password = typeof json.password === "string" ? json.password : "";

  const result = await register({ username, password });
  if (result.ok) {
    return { status: 201, data: { ok: true, session: result.session } };
  }
  return { status: 400, data: { ok: false, error: result.error } };
}

async function handlePostAuthLogin(body: string): Promise<{ status: number; data: object }> {
  let json: { username?: string; password?: string };
  try {
    json = JSON.parse(body) as { username?: string; password?: string };
  } catch {
    return { status: 400, data: { ok: false, error: "无效的 JSON" } };
  }

  const username = typeof json.username === "string" ? json.username : "";
  const password = typeof json.password === "string" ? json.password : "";

  const result = await login({ username, password });
  if (result.ok) {
    return { status: 200, data: { ok: true, session: result.session } };
  }
  return { status: 401, data: { ok: false, error: result.error } };
}

// ============================================================================
// 主服务
// ============================================================================

const server = createServer(async (req, res) => {
  sendCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url ?? "/";
  const { path } = parseUrl(url);

  if (path === "/auth/register" && req.method === "POST") {
    const body = await readBody(req);
    const { status, data } = await handlePostAuthRegister(body);
    sendJson(res, status, data);
    return;
  }

  if (path === "/auth/login" && req.method === "POST") {
    const body = await readBody(req);
    const { status, data } = await handlePostAuthLogin(body);
    sendJson(res, status, data);
    return;
  }

  if (path === "/health" && req.method === "GET") {
    sendJson(res, 200, { ok: true, service: "learning-agent" });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not Found" });
});

server.listen(PORT, () => {
  console.log(`✅ 服务已启动 http://localhost:${PORT}`);
  console.log("   POST /auth/register  - 注册");
  console.log("   POST /auth/login     - 登录");
  console.log("   GET  /health         - 健康检查");
});
