import { describe, expect, it } from "vitest";
import { isMemoryMode } from "./client.js";
import { dbPath } from "./paths.js";

describe("test database isolation", () => {
  it("keeps automated tests on an isolated memory database", () => {
    expect(process.env.VITEST).toBeTruthy();
    expect(isMemoryMode()).toBe(true);
    expect(dbPath()).toMatch(/\.regeneluxe\/local\.db$/);
  });
});
