/**
 * Shared identity / port helpers for ReGeneLuxe.
 *
 * Canonical (cutover complete):
 *   npm run dev → Next.js UI + API at http://127.0.0.1:5174/
 *   /api is served by Next Route Handlers on the same origin.
 *
 * Vite is not a product runtime. Vitest may still use Vite as a test runner only.
 * Client calls relative /api — never hardcode ports in the browser.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const SERVICE_NAME = "regeneluxe";
export const APP_NAME = "ReGeneLuxe";
export const FRAMEWORK = "next";

const STARTED_AT = new Date().toISOString();

/** Canonical app port (Next hosts UI + API). */
export function uiPort() {
  const raw = process.env.REGENELUXE_UI_PORT || process.env.RL_UI_PORT || "5174";
  const port = Number(raw);
  return Number.isFinite(port) && port > 0 ? port : 5174;
}

/**
 * Optional standalone Node API port for server unit tests / rare tooling.
 * Not used by canonical `npm run dev`.
 */
export function apiPort() {
  const raw = process.env.REGENELUXE_API_PORT || process.env.RL_RUNTIME_PORT || String(uiPort());
  const port = Number(raw);
  return Number.isFinite(port) && port > 0 ? port : uiPort();
}

export function apiBaseUrl(port = apiPort()) {
  return `http://127.0.0.1:${port}`;
}

export function uiBaseUrl(port = uiPort()) {
  return `http://127.0.0.1:${port}`;
}

function readPackageVersion() {
  try {
    const root = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(root, "..", "package.json"), "utf8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function readGitShortSha() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: join(dirname(fileURLToPath(import.meta.url)), ".."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/** Public identity for /api/health — no secrets. */
export function runtimeIdentity(port = apiPort()) {
  const ui = uiPort();
  return {
    app: APP_NAME,
    service: SERVICE_NAME,
    framework: FRAMEWORK,
    version: readPackageVersion(),
    gitSha: readGitShortSha(),
    startedAt: STARTED_AT,
    uiPort: ui,
    apiPort: port || ui,
    canonicalUiUrl: uiBaseUrl(ui),
    apiUrl: apiBaseUrl(port || ui),
    healthUrl: `${uiBaseUrl(ui)}/api/health`,
  };
}
