import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-secrets-")), "secrets.json");

const { publicStatus, setAiSecret, getAiSecret } = await import("./secrets.js");

describe("local runtime secrets", () => {
  it("never exposes the API key in public status", () => {
    setAiSecret("openai", "sk-test-do-not-leak");
    const status = publicStatus();
    expect(status.aiConfigured).toBe(true);
    expect(JSON.stringify(status)).not.toContain("sk-test-do-not-leak");
    expect(getAiSecret().apiKey).toBe("sk-test-do-not-leak");
    setAiSecret("none", "");
    expect(publicStatus().aiConfigured).toBe(false);
  });
});
