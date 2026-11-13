/**
 * Shared helpers for ReGeneLuxe production runtime launcher.
 * Never kill unrelated processes. Fail closed on foreign port ownership.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  CANONICAL_PORT,
  classifyCanonicalPort,
  cwdLooksLikeRegeneluxeWeb,
  isRegeneluxeHealth,
} from "./canonicalDev.js";

export const RUNTIME_DIR = ".regeneluxe";
export const RUNTIME_META_FILE = "runtime.json";
export const RUNTIME_LOG_FILE = "runtime.log";
export const LIFECYCLE_LOG_FILE = "runtime-lifecycle.log";
export const BIND_HOST = "127.0.0.1";
/** Authoritative browser/auth origin (OAuth requires localhost). */
export const AUTHORITATIVE_ORIGIN = "http://localhost:5174";
export const PROBE_ORIGINS = Object.freeze([
  "http://127.0.0.1:5174",
  "http://localhost:5174",
]);

export function runtimeMetaPath(root) {
  return join(root, RUNTIME_DIR, RUNTIME_META_FILE);
}

export function runtimeLogPath(root) {
  return join(root, RUNTIME_DIR, RUNTIME_LOG_FILE);
}

export function ensureRuntimeDir(root) {
  mkdirSync(join(root, RUNTIME_DIR), { recursive: true });
}

export function readRuntimeMeta(root) {
  try {
    const raw = readFileSync(runtimeMetaPath(root), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeRuntimeMeta(root, meta) {
  ensureRuntimeDir(root);
  writeFileSync(runtimeMetaPath(root), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

export function clearRuntimeMeta(root) {
  try {
    unlinkSync(runtimeMetaPath(root));
  } catch {
    // ignore
  }
}

export function productionBuildPresent(root) {
  return existsSync(join(root, ".next", "BUILD_ID"))
    && existsSync(join(root, ".next", "server"));
}

export function classifyStartDecision({ listener, health, cwd, buildPresent }) {
  const port = classifyCanonicalPort({ listener, health, cwd });
  if (port.kind === "regeneluxe") {
    return { action: "reuse", ...port };
  }
  if (port.kind === "unrelated") {
    return { action: "fail_closed", reason: "unrelated_owner", ...port };
  }
  if (port.kind === "stale-or-unhealthy") {
    return { action: "fail_closed", reason: "stale_or_unhealthy", ...port };
  }
  if (!buildPresent) {
    return { action: "fail_closed", reason: "missing_production_build", kind: "free" };
  }
  return { action: "start", kind: "free", canonicalUrl: AUTHORITATIVE_ORIGIN };
}

export function isOwnerVerifiedStopTarget({ listener, cwd, health, meta }) {
  if (!listener?.pid) return { ok: false, reason: "no_listener" };
  if (isRegeneluxeHealth(health)) {
    return { ok: true, pid: listener.pid, via: "health" };
  }
  if (cwdLooksLikeRegeneluxeWeb(cwd) && meta?.pid && Number(meta.pid) === Number(listener.pid)) {
    return { ok: true, pid: listener.pid, via: "meta_cwd" };
  }
  if (cwdLooksLikeRegeneluxeWeb(cwd) && /next/i.test(String(listener.command || ""))) {
    return { ok: true, pid: listener.pid, via: "cwd_command" };
  }
  return { ok: false, reason: "not_regeneluxe_owner", pid: listener.pid };
}

export { CANONICAL_PORT, classifyCanonicalPort, isRegeneluxeHealth, cwdLooksLikeRegeneluxeWeb };
