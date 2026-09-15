import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const KEY_PATH = process.env.RL_SECRETS_KEY_PATH
  || join(process.cwd(), "server", ".secrets.key");

/**
 * Encryption key is server-only: RL_TOKEN_ENCRYPTION_KEY env (hex/base64/utf8)
 * or a local key file under server/. Never shipped to the client.
 */
export function getEncryptionKey() {
  const fromEnv = process.env.RL_TOKEN_ENCRYPTION_KEY || process.env.RL_SECRETS_KEY;
  if (fromEnv) {
    return normalizeKeyMaterial(fromEnv);
  }
  if (!existsSync(/* turbopackIgnore: true */ KEY_PATH)) {
    mkdirSync(/* turbopackIgnore: true */ dirname(KEY_PATH), { recursive: true });
    const generated = randomBytes(32);
    writeFileSync(/* turbopackIgnore: true */ KEY_PATH, generated.toString("hex"), { mode: 0o600 });
    return generated;
  }
  const raw = readFileSync(/* turbopackIgnore: true */ KEY_PATH, "utf8").trim();
  return normalizeKeyMaterial(raw);
}

function normalizeKeyMaterial(raw) {
  const text = String(raw).trim();
  if (/^[0-9a-fA-F]{64}$/.test(text)) return Buffer.from(text, "hex");
  try {
    const b64 = Buffer.from(text, "base64");
    if (b64.length === 32) return b64;
  } catch {
    // fall through
  }
  return createHash("sha256").update(text).digest();
}

export function encryptSecret(plaintext) {
  if (plaintext == null || plaintext === "") return null;
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload) {
  if (!payload) return null;
  if (!String(payload).startsWith("v1:")) {
    // Legacy plaintext (should not exist for tokens) — refuse to echo into clients.
    return String(payload);
  }
  const [, ivB64, tagB64, dataB64] = String(payload).split(":");
  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}
