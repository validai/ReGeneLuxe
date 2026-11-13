#!/usr/bin/env node
/**
 * Canonical ReGeneLuxe production runtime launcher.
 *
 *   npm run start:canonical          → reuse healthy owner, else start ONE detached next start
 *   npm run start:canonical -- --status
 *   npm run start:canonical -- --stop   (owner-verified only)
 *   npm run start:canonical -- --foreground  (optional; inherits shell lifecycle)
 *
 * Ownership rules:
 * - Verify cwd + command + /api/health before acting on 5174
 * - Unrelated owner → FAIL CLOSED (never kill)
 * - No endless restart loops; child exit is logged
 * - Detached by default so Cursor/agent shells cannot silently SIGTERM the runtime
 */
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, openSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  AUTHORITATIVE_ORIGIN,
  BIND_HOST,
  CANONICAL_PORT,
  PROBE_ORIGINS,
  classifyStartDecision,
  clearRuntimeMeta,
  ensureRuntimeDir,
  isOwnerVerifiedStopTarget,
  productionBuildPresent,
  readRuntimeMeta,
  runtimeLogPath,
  writeRuntimeMeta,
} from "./canonicalStart.js";
import { parseCwdFields, parseListenFields } from "./canonicalDev.js";
import { appendLifecycleEvent } from "../server/runtime/lifecycleLog.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const args = new Set(process.argv.slice(2));
const statusOnly = args.has("--status");
const stopOnly = args.has("--stop");
const foreground = args.has("--foreground");

function runLsof(lsofArgs) {
  try {
    return execFileSync("lsof", lsofArgs, { encoding: "utf8" });
  } catch (error) {
    if (error?.status === 1) return "";
    throw error;
  }
}

function inspectListener() {
  const listenOut = runLsof(["-nP", `-iTCP:${CANONICAL_PORT}`, "-sTCP:LISTEN", "-Fpc"]);
  const listener = parseListenFields(listenOut);
  if (!listener) return { listener: null, cwd: "" };
  const cwdOut = runLsof(["-a", "-p", String(listener.pid), "-d", "cwd", "-Fn"]);
  return { listener, cwd: parseCwdFields(cwdOut) };
}

function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function buildId() {
  try {
    return readFileSync(join(ROOT, ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    return null;
  }
}

async function readHealth(origin = PROBE_ORIGINS[0]) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(`${origin}/api/health`, { signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    return { httpStatus: response.status, body, origin };
  } catch (error) {
    return { httpStatus: 0, body: null, origin, error: error?.message || String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function readBestHealth() {
  for (const origin of PROBE_ORIGINS) {
    const health = await readHealth(origin);
    if (health.httpStatus === 200 && health.body?.app === "ReGeneLuxe") return health;
  }
  return readHealth(PROBE_ORIGINS[0]);
}

async function probeReadyTwice() {
  const first = await readBestHealth();
  if (first.httpStatus !== 200 || first.body?.app !== "ReGeneLuxe") {
    return { ok: false, first, second: null, rootOk: false };
  }
  await new Promise((r) => setTimeout(r, 400));
  const second = await readBestHealth();
  if (second.httpStatus !== 200 || second.body?.app !== "ReGeneLuxe") {
    return { ok: false, first, second, rootOk: false };
  }
  let rootOk = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${first.origin || AUTHORITATIVE_ORIGIN}/`, {
      signal: controller.signal,
      redirect: "manual",
    });
    clearTimeout(timer);
    rootOk = res.status > 0 && res.status < 500;
  } catch {
    rootOk = false;
  }
  return { ok: rootOk, first, second, rootOk };
}

function printStatus(decision, health, meta) {
  const lines = [
    `Authoritative origin: ${AUTHORITATIVE_ORIGIN}`,
    `Bind: ${BIND_HOST}:${CANONICAL_PORT}`,
    `Decision: ${decision.action}${decision.reason ? ` (${decision.reason})` : ""}`,
  ];
  if (decision.pid) lines.push(`PID: ${decision.pid}`);
  if (decision.command) lines.push(`Command: ${decision.command}`);
  if (decision.cwd) lines.push(`cwd: ${decision.cwd}`);
  if (meta?.pid) lines.push(`Runtime meta PID: ${meta.pid} startedAt=${meta.startedAt || "?"}`);
  if (health?.body?.app) {
    lines.push(
      `Health: ${health.httpStatus} app=${health.body.app} status=${health.body.status || "?"} uiPort=${health.body.uiPort} gitSha=${health.body.gitSha || "?"}`,
    );
  } else if (health?.error) {
    lines.push(`Health: unavailable (${health.error})`);
  } else {
    lines.push("Health: no listener");
  }
  console.log(lines.join("\n"));
}

async function stopOwnerVerified() {
  const { listener, cwd } = inspectListener();
  const health = listener ? await readBestHealth() : { httpStatus: 0, body: null };
  const meta = readRuntimeMeta(ROOT);
  const check = isOwnerVerifiedStopTarget({
    listener,
    cwd,
    health: health.body,
    meta,
  });
  if (!check.ok) {
    console.error(`Refusing stop: ${check.reason}${check.pid ? ` (pid ${check.pid})` : ""}`);
    process.exit(1);
  }
  appendLifecycleEvent({ type: "canonical_stop_requested", targetPid: check.pid, via: check.via }, ROOT);
  try {
    process.kill(check.pid, "SIGTERM");
  } catch (error) {
    console.error(`Failed to signal PID ${check.pid}: ${error.message}`);
    process.exit(1);
  }
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const { listener: still } = inspectListener();
    if (!still || Number(still.pid) !== Number(check.pid)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  const { listener: after } = inspectListener();
  if (after && Number(after.pid) === Number(check.pid)) {
    console.error(`PID ${check.pid} still listening after SIGTERM. Inspect manually; refusing SIGKILL.`);
    process.exit(1);
  }
  clearRuntimeMeta(ROOT);
  appendLifecycleEvent({ type: "canonical_stop_complete", targetPid: check.pid }, ROOT);
  console.log(`Stopped owner-verified ReGeneLuxe PID ${check.pid}`);
  process.exit(0);
}

function nextCliArgs() {
  // Prefer the JS CLI under node so detached children are not shell wrappers
  // that die when an agent/Cursor terminal session ends.
  const jsCli = join(ROOT, "node_modules", "next", "dist", "bin", "next");
  return {
    cmd: process.execPath,
    args: [jsCli, "start", "-H", BIND_HOST, "-p", String(CANONICAL_PORT)],
  };
}

function spawnDetachedNext(sha) {
  ensureRuntimeDir(ROOT);
  const logPath = runtimeLogPath(ROOT);
  const logFd = openSync(logPath, "a");
  const { cmd, args } = nextCliArgs();
  const child = spawn(cmd, args, {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(CANONICAL_PORT),
      REGENELUXE_UI_PORT: String(CANONICAL_PORT),
      RL_RUNTIME_GIT_SHA: sha || "",
      RL_RUNTIME_MANAGED: "1",
    },
  });
  child.unref();
  return child;
}

function spawnForegroundNext(sha) {
  const { cmd, args } = nextCliArgs();
  const child = spawn(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(CANONICAL_PORT),
      REGENELUXE_UI_PORT: String(CANONICAL_PORT),
      RL_RUNTIME_GIT_SHA: sha || "",
      RL_RUNTIME_MANAGED: "1",
    },
  });
  const forward = (signal) => {
    appendLifecycleEvent({ type: "launcher_forward_signal", signal, childPid: child.pid }, ROOT);
    try {
      child.kill(signal);
    } catch {
      // ignore
    }
  };
  process.on("SIGTERM", () => forward("SIGTERM"));
  process.on("SIGINT", () => forward("SIGINT"));
  child.on("exit", (code, signal) => {
    appendLifecycleEvent({
      type: "child_exit",
      childPid: child.pid,
      exitCode: code,
      signal,
    }, ROOT);
    console.error(`[regeneluxe-canonical-start] child exit code=${code} signal=${signal || "none"}`);
    if (signal) {
      try {
        process.kill(process.pid, signal);
      } catch {
        process.exit(code ?? 1);
      }
      return;
    }
    process.exit(code ?? 1);
  });
  return child;
}

async function waitForReady(pid, sha) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const { listener, cwd } = inspectListener();
    if (listener) {
      const probes = await probeReadyTwice();
      if (probes.ok) {
        writeRuntimeMeta(ROOT, {
          pid: listener.pid,
          launcherPid: pid,
          startedAt: new Date().toISOString(),
          gitSha: sha,
          buildId: buildId(),
          version: pkg.version,
          bind: `${BIND_HOST}:${CANONICAL_PORT}`,
          authoritativeOrigin: AUTHORITATIVE_ORIGIN,
          cwd: cwd || ROOT,
          managed: true,
        });
        appendLifecycleEvent({
          type: "canonical_ready",
          pid: listener.pid,
          gitSha: sha,
          buildId: buildId(),
        }, ROOT);
        return { ok: true, listener, probes };
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { ok: false };
}

async function main() {
  if (!cwdLooksLikeRoot()) {
    console.error(`Refusing: cwd must be regeneluxe-web (got ${ROOT})`);
    process.exit(1);
  }

  if (stopOnly) {
    await stopOwnerVerified();
    return;
  }

  const { listener, cwd } = inspectListener();
  const health = listener ? await readBestHealth() : { httpStatus: 0, body: null };
  const meta = readRuntimeMeta(ROOT);
  const buildPresent = productionBuildPresent(ROOT);
  const decision = classifyStartDecision({
    listener,
    health: health.body,
    cwd,
    buildPresent,
  });

  if (statusOnly) {
    printStatus(decision, health, meta);
    process.exit(decision.action === "fail_closed" && decision.reason === "unrelated_owner" ? 1 : 0);
  }

  if (decision.action === "reuse") {
    printStatus(decision, health, meta);
    const probes = await probeReadyTwice();
    if (!probes.ok) {
      console.error("Existing listener did not pass dual health + root probe. Inspect before reuse claims.");
      process.exit(1);
    }
    console.log(`✓ Ready (reused) ${AUTHORITATIVE_ORIGIN}`);
    console.log("Browser: refresh after this line. Do not open before dual health succeeds.");
    process.exit(0);
  }

  if (decision.action === "fail_closed") {
    printStatus(decision, health, meta);
    if (decision.reason === "missing_production_build") {
      console.error("Missing .next production build. Run: npm run build");
    } else if (decision.reason === "unrelated_owner") {
      console.error("Unrelated process owns 5174. FAIL CLOSED — will not kill or rebind.");
    } else {
      console.error("Port 5174 is occupied by a same-repo process that is not healthy. Inspect PID before acting.");
    }
    process.exit(1);
  }

  const sha = gitSha();
  appendLifecycleEvent({ type: "canonical_start_begin", gitSha: sha, foreground }, ROOT);
  ensureRuntimeDir(ROOT);
  appendFileSync(runtimeLogPath(ROOT), `\n---- start ${new Date().toISOString()} sha=${sha} ----\n`, "utf8");

  if (foreground) {
    console.log(`Starting foreground ReGeneLuxe on ${BIND_HOST}:${CANONICAL_PORT}…`);
    const child = spawnForegroundNext(sha);
    writeRuntimeMeta(ROOT, {
      pid: child.pid,
      launcherPid: process.pid,
      startedAt: new Date().toISOString(),
      gitSha: sha,
      buildId: buildId(),
      version: pkg.version,
      bind: `${BIND_HOST}:${CANONICAL_PORT}`,
      authoritativeOrigin: AUTHORITATIVE_ORIGIN,
      cwd: ROOT,
      managed: true,
      foreground: true,
    });
    return;
  }

  console.log(`Starting detached ReGeneLuxe on ${BIND_HOST}:${CANONICAL_PORT}…`);
  const child = spawnDetachedNext(sha);
  appendLifecycleEvent({ type: "canonical_spawned", childPid: child.pid, gitSha: sha }, ROOT);

  child.on("exit", (code, signal) => {
    appendLifecycleEvent({
      type: "child_exit_early",
      childPid: child.pid,
      exitCode: code,
      signal,
    }, ROOT);
  });

  const ready = await waitForReady(child.pid, sha);
  if (!ready.ok) {
    console.error("Started process but dual health / root probe failed within timeout. See .regeneluxe/runtime.log");
    process.exit(1);
  }

  printStatus(
    { action: "start", kind: "regeneluxe", pid: ready.listener.pid, cwd: ROOT, command: "next-server" },
    ready.probes.second,
    readRuntimeMeta(ROOT),
  );
  console.log(`✓ Ready ${AUTHORITATIVE_ORIGIN}`);
  console.log(`PID ${ready.listener.pid} (detached). Refresh the browser now.`);
  process.exit(0);
}

function cwdLooksLikeRoot() {
  return ROOT.endsWith("/regeneluxe-web") || ROOT.endsWith("\\regeneluxe-web");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
