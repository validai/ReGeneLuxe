#!/usr/bin/env node
/**
 * Canonical ReGeneLuxe dev entry.
 *   npm run dev         → reuse http://127.0.0.1:5174 if healthy, else start one Next server
 *   npm run dev:status  → report who owns 5174
 */
import { execFileSync, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_HEALTH_URL,
  CANONICAL_ORIGIN,
  CANONICAL_PORT,
  classifyCanonicalPort,
  parseCwdFields,
  parseListenFields,
} from "./canonicalDev.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const statusOnly = process.argv.includes("--status");

function runLsof(args) {
  try {
    return execFileSync("lsof", args, { encoding: "utf8" });
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

async function readHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(CANONICAL_HEALTH_URL, { signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    return { httpStatus: response.status, body };
  } catch (error) {
    return { httpStatus: 0, body: null, error: error?.message || String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function printStatus(result, health) {
  const lines = [
    `Canonical URL: ${CANONICAL_ORIGIN}`,
    `Port ${CANONICAL_PORT}: ${result.kind}`,
  ];
  if (result.pid) lines.push(`PID: ${result.pid}`);
  if (result.command) lines.push(`Command: ${result.command}`);
  if (result.cwd) lines.push(`cwd: ${result.cwd}`);
  if (health?.body?.app) {
    lines.push(`Health: ${health.httpStatus} app=${health.body.app} framework=${health.body.framework} uiPort=${health.body.uiPort}`);
  } else if (health?.error) {
    lines.push(`Health: unavailable (${health.error})`);
  } else {
    lines.push("Health: no listener");
  }
  if (result.kind === "regeneluxe") {
    lines.push("Reuse this instance. Do not start a second ReGeneLuxe server.");
  } else if (result.kind === "free") {
    lines.push("No server on 5174. Start with npm run dev.");
  } else if (result.kind === "unrelated") {
    lines.push("Unrelated process owns 5174. Do not kill it automatically.");
  } else if (result.kind === "stale-or-unhealthy") {
    lines.push("Same-repo Next process is on 5174 but /api/health is not a healthy ReGeneLuxe identity.");
  }
  console.log(lines.join("\n"));
}

async function main() {
  const { listener, cwd } = inspectListener();
  const health = listener ? await readHealth() : { httpStatus: 0, body: null };
  const result = classifyCanonicalPort({ listener, health: health.body, cwd });

  if (statusOnly) {
    printStatus(result, health);
    if (result.kind === "unrelated") process.exit(1);
    process.exit(0);
  }

  if (result.kind === "regeneluxe") {
    printStatus(result, health);
    console.log(`- Local:         ${CANONICAL_ORIGIN}`);
    console.log("✓ Ready (reused existing ReGeneLuxe server)");
    process.exit(0);
  }

  if (result.kind === "unrelated") {
    printStatus(result, health);
    console.error("Refusing to start a second server or change the canonical port.");
    process.exit(1);
  }

  if (result.kind === "stale-or-unhealthy") {
    printStatus(result, health);
    console.error("Port 5174 is occupied by a same-repo process that is not healthy. Inspect that PID before starting another server.");
    process.exit(1);
  }

  const nextBin = join(ROOT, "node_modules", ".bin", "next");
  const child = spawn(nextBin, ["dev", "-H", "127.0.0.1", "-p", String(CANONICAL_PORT)], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
