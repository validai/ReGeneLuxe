/**
 * One ReGeneLuxe dev server. One canonical port: 127.0.0.1:5174.
 * Never fall back to 5175. Never kill unrelated processes.
 */

export const CANONICAL_PORT = 5174;
export const CANONICAL_ORIGIN = "http://127.0.0.1:5174";
export const CANONICAL_HEALTH_URL = `${CANONICAL_ORIGIN}/api/health`;
export const REPO_WEB_DIR_SUFFIX = "/regeneluxe-web";

export function isRegeneluxeHealth(body) {
  if (!body || typeof body !== "object") return false;
  return body.ok === true
    && body.app === "ReGeneLuxe"
    && body.service === "regeneluxe"
    && body.framework === "next"
    && Number(body.uiPort) === CANONICAL_PORT;
}

export function cwdLooksLikeRegeneluxeWeb(cwd) {
  const path = String(cwd || "").replace(/\/$/, "");
  return path.endsWith(REPO_WEB_DIR_SUFFIX);
}

export function classifyCanonicalPort({ listener, health, cwd } = {}) {
  if (!listener) {
    return { kind: "free", reuse: false, canonicalUrl: CANONICAL_ORIGIN };
  }

  if (isRegeneluxeHealth(health)) {
    return {
      kind: "regeneluxe",
      reuse: true,
      pid: listener.pid,
      command: listener.command,
      cwd,
      canonicalUrl: CANONICAL_ORIGIN,
    };
  }

  const sameRepo = cwdLooksLikeRegeneluxeWeb(cwd)
    && /next/i.test(String(listener.command || ""));
  if (sameRepo) {
    return {
      kind: "stale-or-unhealthy",
      reuse: false,
      sameRepo: true,
      pid: listener.pid,
      command: listener.command,
      cwd,
      canonicalUrl: CANONICAL_ORIGIN,
    };
  }

  return {
    kind: "unrelated",
    reuse: false,
    pid: listener.pid,
    command: listener.command,
    cwd,
    canonicalUrl: CANONICAL_ORIGIN,
  };
}

function parseLsofFields(output) {
  const records = [];
  let current = {};
  for (const line of String(output || "").split("\n")) {
    if (!line) continue;
    const code = line[0];
    const value = line.slice(1);
    if (code === "p") {
      if (current.pid) records.push(current);
      current = { pid: Number(value) };
    } else if (code === "c") current.command = value;
    else if (code === "n" && !current.cwd) current.cwd = value;
  }
  if (current.pid) records.push(current);
  return records;
}

export function parseListenFields(output) {
  return parseLsofFields(output)[0] || null;
}

export function parseCwdFields(output) {
  const rec = parseLsofFields(output);
  return rec.find((row) => row.cwd)?.cwd || rec[0]?.cwd || "";
}
