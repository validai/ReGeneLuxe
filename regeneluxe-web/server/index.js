import { createServer } from "node:http";
import { publicStatus, setAiSecret } from "./secrets.js";
import { complete } from "./ai.js";
import { apiPort, apiBaseUrl, SERVICE_NAME, runtimeIdentity } from "./config.js";

const GLOBAL_KEY = "__regeneluxeRuntimeServer";

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(body));
}

function healthPayload(port) {
  const status = publicStatus();
  return {
    ok: true,
    ...runtimeIdentity(port),
    state: status.aiConfigured ? "RUNNING" : "AI_NOT_CONFIGURED",
    running: true,
    aiConfigured: status.aiConfigured,
    provider: status.provider,
    connectedProviders: status.connectedProviders || [],
    socialConnectionError: false,
    timestamp: new Date().toISOString(),
  };
}

async function handleRequest(request, response, port) {
  if (request.method === "OPTIONS") {
    json(response, 204, {});
    return;
  }

  const url = new URL(request.url, `http://127.0.0.1:${port}`);

  if (request.method === "GET" && (url.pathname === "/api/health" || url.pathname === "/health")) {
    json(response, 200, healthPayload(port));
    return;
  }

  if (request.method === "GET" && (url.pathname === "/api/status" || url.pathname === "/status")) {
    json(response, 200, { ...publicStatus(), service: SERVICE_NAME });
    return;
  }

  if (request.method === "POST" && (url.pathname === "/api/secrets" || url.pathname === "/secrets")) {
    const body = await readBody(request);
    if (body.kind !== "ai") {
      json(response, 400, { ok: false, error: "Unsupported secret kind" });
      return;
    }
    json(response, 200, { ok: true, ...setAiSecret(body.provider, body.value) });
    return;
  }

  if (request.method === "POST" && (url.pathname === "/api/ai/complete" || url.pathname === "/ai/complete")) {
    const body = await readBody(request);
    const result = await complete(body);
    json(response, result.status, result.body);
    return;
  }

  json(response, 404, { ok: false, error: "Not found" });
}

function readBody(request) {
  return new Promise((resolve) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

export async function probeRuntime(port = apiPort()) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 400);
  try {
    const response = await fetch(`${apiBaseUrl(port)}/api/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return { ok: false, reason: "occupied", status: response.status };
    const body = await response.json().catch(() => ({}));
    if (body?.service === SERVICE_NAME) return { ok: true, reason: "regeneluxe", body };
    return { ok: false, reason: "foreign", body };
  } catch (error) {
    clearTimeout(timer);
    return { ok: false, reason: "empty", error: error?.message };
  }
}

function setStoredServer(server, port) {
  globalThis[GLOBAL_KEY] = server ? { server, port } : null;
  return server;
}

function getStoredHandle() {
  return globalThis[GLOBAL_KEY] || null;
}

function listenOnce(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve(server);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

/**
 * Start the local runtime exactly once for this process.
 * Reuse an existing ReGeneLuxe listener; fail clearly for foreign occupancy.
 */
export async function ensureRuntime(port = apiPort()) {
  const handle = getStoredHandle();
  if (handle?.server?.listening && handle.port === port) {
    return { ok: true, reused: true, mode: "in-process", port, server: handle.server };
  }

  const probe = await probeRuntime(port);
  if (probe.ok && probe.reason === "regeneluxe") {
    return { ok: true, reused: true, mode: "external", port, health: probe.body };
  }
  if (probe.reason === "foreign" || probe.reason === "occupied") {
    return {
      ok: false,
      port,
      error: `Port ${port} is already in use by another process. Set REGENELUXE_API_PORT or stop the conflicting process.`,
    };
  }

  if (handle?.server?.listening && handle.port !== port) {
    await stopRuntime();
  }

  const server = createServer((request, response) => {
    handleRequest(request, response, port).catch((error) => {
      json(response, 500, { ok: false, error: error.message || "Runtime error" });
    });
  });

  try {
    await listenOnce(server, port);
    setStoredServer(server, port);
    return { ok: true, reused: false, mode: "started", port, server };
  } catch (error) {
    if (error?.code === "EADDRINUSE") {
      const again = await probeRuntime(port);
      if (again.ok && again.reason === "regeneluxe") {
        return { ok: true, reused: true, mode: "race-reuse", port, health: again.body };
      }
      return {
        ok: false,
        port,
        error: `Port ${port} is already in use by another process. Set REGENELUXE_API_PORT or stop the conflicting process.`,
      };
    }
    return { ok: false, port, error: error?.message || "Failed to start local runtime" };
  }
}

/** @deprecated Prefer ensureRuntime */
export function startRuntime(port = apiPort()) {
  const handle = getStoredHandle();
  if (handle?.server?.listening && handle.port === port) return handle.server;
  ensureRuntime(port).then((result) => {
    if (!result.ok) console.error(`[regeneluxe-runtime] ${result.error}`);
    else if (!result.reused) console.log(`[regeneluxe-runtime] http://127.0.0.1:${result.port}`);
  });
  return getStoredHandle()?.server || null;
}

export async function stopRuntime() {
  const handle = getStoredHandle();
  if (!handle?.server) {
    setStoredServer(null);
    return true;
  }
  await new Promise((resolve) => {
    handle.server.close(() => resolve());
  });
  setStoredServer(null);
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = apiPort();
  const result = await ensureRuntime(port);
  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }
  console.log(`[regeneluxe-runtime] http://127.0.0.1:${port} (${result.mode})`);
}
