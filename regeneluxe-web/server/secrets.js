import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Secrets file is always under ./server relative to package cwd (Next + Vite). */
const secretsDir = join(process.cwd(), "server");
const file = process.env.RL_SECRETS_PATH || join(secretsDir, ".secrets.json");

function emptySecrets() {
  return {
    ai: { provider: "none", apiKey: "" },
    providers: {},
  };
}

export function readSecrets() {
  if (!existsSync(/* turbopackIgnore: true */ file)) return emptySecrets();
  try {
    const parsed = JSON.parse(readFileSync(/* turbopackIgnore: true */ file, "utf8"));
    return { ...emptySecrets(), ...parsed, ai: { ...emptySecrets().ai, ...(parsed.ai || {}) } };
  } catch {
    return emptySecrets();
  }
}

export function writeSecrets(next) {
  mkdirSync(/* turbopackIgnore: true */ dirname(file), { recursive: true });
  writeFileSync(/* turbopackIgnore: true */ file, JSON.stringify(next, null, 2));
  return true;
}

export function publicStatus() {
  const secrets = readSecrets();
  return {
    running: true,
    aiConfigured: Boolean(secrets.ai?.apiKey && secrets.ai.provider && secrets.ai.provider !== "none"),
    provider: secrets.ai?.apiKey ? secrets.ai.provider : null,
    connectedProviders: Object.entries(secrets.providers || {})
      .filter(([, value]) => value?.accessToken)
      .map(([name]) => name),
  };
}

export function setAiSecret(provider, apiKey) {
  const current = readSecrets();
  current.ai = { provider: provider || "none", apiKey: apiKey || "" };
  writeSecrets(current);
  return publicStatus();
}

export function getAiSecret() {
  const { ai } = readSecrets();
  return ai;
}
