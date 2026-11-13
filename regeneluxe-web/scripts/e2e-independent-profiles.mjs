#!/usr/bin/env node
/**
 * Independent-profile E2E (3 consecutive runs).
 * Spawns an ephemeral Next server with E2E auth + isolated DB.
 * Does NOT use the operator canonical 5174 runtime.
 */
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.E2E_PORT || 5199);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const E2E_SECRET = process.env.REGENELUXE_E2E_SECRET || `e2e-${randomBytes(8).toString("hex")}`;
const DB_DIR = join(ROOT, ".regeneluxe", "e2e");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const localEnv = loadEnvFile(join(ROOT, ".env.local"));
const AUTH_SECRET = process.env.AUTH_SECRET || localEnv.AUTH_SECRET || createHash("sha256").update("e2e-auth-secret").digest("hex");

function dbPathFor(run) {
  return join(DB_DIR, `independent-run-${run}.db`);
}

class CookieJar {
  constructor() {
    this.map = new Map();
  }
  store(response) {
    const raw = response.headers.getSetCookie?.() || [];
    for (const line of raw) {
      const [pair] = line.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) this.map.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
  }
  header() {
    return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function request(jar, path, { method = "GET", body, headers = {}, redirect = "manual" } = {}) {
  const response = await fetch(`${ORIGIN}${path}`, {
    method,
    redirect,
    headers: {
      ...(jar.header() ? { cookie: jar.header() } : {}),
      ...headers,
    },
    body,
  });
  jar.store(response);
  return response;
}

async function waitReady(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${ORIGIN}/api/e2e/status`);
      if (res.status === 200) {
        const health = await fetch(`${ORIGIN}/api/health`);
        if (health.ok) return;
      }
    } catch {
      // retry
    }
    await sleep(400);
  }
  throw new Error("E2E server did not become ready");
}

async function e2eSignIn(jar, { email, sub, name }) {
  const csrfRes = await request(jar, "/api/auth/csrf");
  const csrfJson = await csrfRes.json();
  const csrfToken = csrfJson.csrfToken;
  const body = new URLSearchParams({
    csrfToken,
    email,
    sub,
    name,
    secret: E2E_SECRET,
    callbackUrl: `${ORIGIN}/`,
    json: "true",
  });
  const res = await request(jar, "/api/auth/callback/e2e-verified", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  // Auth.js may 200 JSON or 302
  if (res.status >= 400) {
    const text = await res.text();
    throw new Error(`E2E sign-in failed status=${res.status} body=${text.slice(0, 200)}`);
  }
  return res;
}

async function createProfile(jar, { displayName, purpose = "TEST" }) {
  const form = new FormData();
  form.set("displayName", displayName);
  form.set("slug", displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  form.set("workspacePurpose", purpose);
  form.set("purpose", purpose);
  form.set("primaryEmail", "");
  form.set("primaryPublicUrl", "");
  form.set("platforms", "Other");
  form.set("timezone", "America/New_York");
  form.set("shortDescription", "E2E disposable");
  form.set("website", "");
  const res = await request(jar, "/api/profiles", { method: "POST", body: form, redirect: "follow" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(`Profile create failed: ${res.status} ${JSON.stringify(json)}`);
  }
  return json.profile;
}

async function signOut(jar) {
  const csrfRes = await request(jar, "/api/auth/csrf");
  const csrfJson = await csrfRes.json();
  await request(jar, "/api/auth/signout", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken: csrfJson.csrfToken, callbackUrl: `${ORIGIN}/signin` }),
  });
  jar.map.clear();
}

async function assertSetupRequired(jar) {
  const res = await request(jar, "/", { redirect: "manual" });
  // middleware may redirect to /setup/profile
  const loc = res.headers.get("location") || "";
  if (res.status === 307 || res.status === 302 || res.status === 303) {
    if (!/setup\/profile/.test(loc)) {
      throw new Error(`Expected setup redirect, got ${res.status} ${loc}`);
    }
    return;
  }
  const setup = await request(jar, "/setup/profile", { redirect: "manual" });
  if (setup.status >= 400) throw new Error(`setup page failed ${setup.status}`);
}

async function assertDashboard(jar, brandNeedle) {
  const res = await request(jar, "/", { redirect: "follow" });
  const html = await res.text();
  if (!res.ok) throw new Error(`dashboard HTTP ${res.status}`);
  if (brandNeedle && !html.includes(brandNeedle)) {
    // Client-rendered apps may not include brand in first HTML; verify session API instead.
    const session = await request(jar, "/api/operator/session");
    const json = await session.json().catch(() => ({}));
    if (!session.ok) throw new Error("operator session unavailable on dashboard assert");
    const name = json?.activeProfile?.displayName || json?.profile?.displayName || "";
    if (name !== brandNeedle) {
      throw new Error(`Expected workspace ${brandNeedle}, got ${name || JSON.stringify(json).slice(0, 180)}`);
    }
  }
}

async function runOnce(runNumber) {
  const jarA = new CookieJar();
  const jarB = new CookieJar();
  const nameA = `E2E Artist A R${runNumber}`;
  const nameB = `E2E Artist B R${runNumber}`;

  await e2eSignIn(jarA, {
    email: "e2e-profile-a@example.invalid",
    sub: `e2e_sub_a_r${runNumber}`,
    name: "E2E A",
  });
  await assertSetupRequired(jarA);
  await createProfile(jarA, { displayName: nameA, purpose: "TEST" });
  await assertDashboard(jarA, nameA);

  await signOut(jarA);
  const jarA2 = new CookieJar();
  await e2eSignIn(jarA2, {
    email: "e2e-profile-a@example.invalid",
    sub: `e2e_sub_a_r${runNumber}`,
    name: "E2E A",
  });
  // Existing profile → home, not setup
  const home = await request(jarA2, "/", { redirect: "manual" });
  const loc = home.headers.get("location") || "";
  if (/setup\/profile/.test(loc)) throw new Error("Existing identity A wrongly sent to setup");
  await assertDashboard(jarA2, nameA);

  await e2eSignIn(jarB, {
    email: "e2e-profile-b@example.invalid",
    sub: `e2e_sub_b_r${runNumber}`,
    name: "E2E B",
  });
  await assertSetupRequired(jarB);
  await createProfile(jarB, { displayName: nameB, purpose: "TEST" });
  await assertDashboard(jarB, nameB);

  // Isolation: A session must not see B name as active profile
  await assertDashboard(jarA2, nameA);
  await assertDashboard(jarB, nameB);

  // cleanup disposable rows
  await request(new CookieJar(), "/api/e2e/cleanup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: E2E_SECRET }),
  });

  return { nameA, nameB };
}

async function main() {
  mkdirSync(DB_DIR, { recursive: true });
  const results = [];

  for (let run = 1; run <= 3; run += 1) {
    const dbFile = dbPathFor(run);
    if (existsSync(dbFile)) rmSync(dbFile, { force: true });

    const env = {
      ...process.env,
      ...localEnv,
      NODE_ENV: "production",
      PORT: String(PORT),
      AUTH_URL: ORIGIN,
      AUTH_SECRET,
      AUTH_TRUST_HOST: "1",
      REGENELUXE_UI_PORT: String(PORT),
      REGENELUXE_ACCESS_MODE: "local",
      REGENELUXE_E2E_AUTH: "1",
      REGENELUXE_E2E_SECRET: E2E_SECRET,
      REGENELUXE_E2E_ALLOW_PRODUCTION: "1",
      REGENELUXE_DB_PATH: dbFile,
      REGENELUXE_ALLOW_LEGACY_ATTACH: "0",
      RL_DISABLE_JOB_TICKER: "1",
      // Ensure managed canonical flag is off
      RL_RUNTIME_MANAGED: "0",
    };

    const nextBin = join(ROOT, "node_modules", "next", "dist", "bin", "next");
    const child = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(PORT)], {
      cwd: ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let logs = "";
    child.stdout.on("data", (d) => { logs += d.toString(); });
    child.stderr.on("data", (d) => { logs += d.toString(); });

    try {
      await waitReady();
      const names = await runOnce(run);
      results.push({ run, ok: true, ...names });
      console.log(`RUN ${run}: PASS (${names.nameA} / ${names.nameB})`);
    } catch (error) {
      results.push({ run, ok: false, error: error.message });
      console.error(`RUN ${run}: FAIL ${error.message}`);
      console.error(logs.slice(-2000));
      try { child.kill("SIGTERM"); } catch { /* ignore */ }
      writeFileSync(join(DB_DIR, "last-failure.json"), JSON.stringify(results, null, 2));
      process.exit(1);
    } finally {
      try { child.kill("SIGTERM"); } catch { /* ignore */ }
      await sleep(500);
      if (existsSync(dbFile)) rmSync(dbFile, { force: true });
    }
  }

  // Negative: canonical runtime must not enable E2E.
  const neg = await fetch("http://127.0.0.1:5174/api/e2e/status", { redirect: "manual" }).catch(() => null);
  if (!neg) {
    console.log("E2E backdoor on 5174: unreachable OK");
  } else {
    const body = await neg.json().catch(() => ({}));
    if (neg.status === 200 && body?.e2e === true) {
      console.error("E2E backdoor negative check failed: 5174 exposed enabled E2E auth");
      process.exit(1);
    }
    if (neg.status !== 404) {
      console.error(`E2E backdoor negative check failed: expected 404, got ${neg.status}`);
      process.exit(1);
    }
    console.log("E2E backdoor on 5174: 404 OK");
  }
  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
