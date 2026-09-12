"use server";

import { setAiSecret } from "../../server/secrets.js";

/**
 * Sprint 96 — server-only AI secret save.
 * Prefer this from Settings (or other server forms) instead of posting the key
 * through a client-constructed fetch when a Server Action is available.
 */
export async function saveAiSecret(provider: string, value: string) {
  return setAiSecret(provider, value);
}
