/**
 * Append-only runtime lifecycle events (no secrets).
 * File: .regeneluxe/runtime-lifecycle.log
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const RUNTIME_DIR = ".regeneluxe";
const LOG_NAME = "runtime-lifecycle.log";

function sanitize(value) {
  const text = String(value ?? "");
  return text.slice(0, 500).replace(/(sk-|Bearer\s+|api[_-]?key[=:]\s*)\S+/gi, "[redacted]");
}

export function runtimeLifecyclePath(root = process.cwd()) {
  return join(root, RUNTIME_DIR, LOG_NAME);
}

export function appendLifecycleEvent(event, root = process.cwd()) {
  try {
    const dir = join(root, RUNTIME_DIR);
    mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      pid: process.pid,
      ...Object.fromEntries(
        Object.entries(event || {}).map(([k, v]) => [k, typeof v === "string" ? sanitize(v) : v]),
      ),
    });
    appendFileSync(runtimeLifecyclePath(root), `${line}\n`, "utf8");
  } catch {
    // Never throw from diagnostics.
  }
}
