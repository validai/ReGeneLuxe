import { describe, expect, it } from "vitest";
import {
  CANONICAL_ORIGIN,
  CANONICAL_PORT,
  classifyCanonicalPort,
  cwdLooksLikeRegeneluxeWeb,
  isRegeneluxeHealth,
  parseCwdFields,
  parseListenFields,
} from "./canonicalDev.js";

const healthy = {
  ok: true,
  app: "ReGeneLuxe",
  service: "regeneluxe",
  framework: "next",
  uiPort: 5174,
};

describe("canonical dev port classifier", () => {
  it("treats an empty port as free", () => {
    expect(classifyCanonicalPort({}).kind).toBe("free");
    expect(CANONICAL_ORIGIN).toBe("http://127.0.0.1:5174");
    expect(CANONICAL_PORT).toBe(5174);
  });

  it("reuses a healthy ReGeneLuxe Next listener on 5174", () => {
    const result = classifyCanonicalPort({
      listener: { pid: 25439, command: "next-server" },
      health: healthy,
      cwd: "/Users/eric/Desktop/ReGeneLuxe/regeneluxe-web",
    });
    expect(result.kind).toBe("regeneluxe");
    expect(result.reuse).toBe(true);
    expect(result.pid).toBe(25439);
  });

  it("does not treat a foreign health payload as ReGeneLuxe", () => {
    expect(isRegeneluxeHealth({ ok: true, app: "Investools", framework: "next", uiPort: 5174 })).toBe(false);
    const result = classifyCanonicalPort({
      listener: { pid: 9, command: "node" },
      health: { ok: true, app: "Investools", service: "other", framework: "next", uiPort: 5174 },
      cwd: "/Users/eric/Desktop/Investools",
    });
    expect(result.kind).toBe("unrelated");
    expect(result.reuse).toBe(false);
  });

  it("flags a same-repo Next process that is not healthy", () => {
    expect(cwdLooksLikeRegeneluxeWeb("/Users/eric/Desktop/ReGeneLuxe/regeneluxe-web")).toBe(true);
    const result = classifyCanonicalPort({
      listener: { pid: 11, command: "next-server" },
      health: null,
      cwd: "/Users/eric/Desktop/ReGeneLuxe/regeneluxe-web",
    });
    expect(result.kind).toBe("stale-or-unhealthy");
    expect(result.sameRepo).toBe(true);
  });

  it("parses lsof -F fields", () => {
    const listener = parseListenFields("p25439\ncnext-server\n");
    expect(listener).toEqual({ pid: 25439, command: "next-server" });
    expect(parseCwdFields("p25439\nfcwd\nn/Users/eric/Desktop/ReGeneLuxe/regeneluxe-web\n")).toBe(
      "/Users/eric/Desktop/ReGeneLuxe/regeneluxe-web",
    );
  });
});
