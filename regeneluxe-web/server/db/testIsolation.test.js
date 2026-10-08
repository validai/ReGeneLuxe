import { afterEach, describe, expect, it } from "vitest";
import { closeDb, getLocalClient, isMemoryMode, resetDbForTests } from "./client.js";
import { dbPath } from "./paths.js";

describe("test database isolation", () => {
  afterEach(async () => {
    process.env.RL_DB_MODE = "memory";
    await resetDbForTests();
  });

  it("keeps automated tests on an isolated memory database", () => {
    expect(process.env.VITEST).toBeTruthy();
    expect(isMemoryMode()).toBe(true);
    expect(dbPath()).toMatch(/\.regeneluxe\/local\.db$/);
  });

  it("refuses the operational database file while tests are running", async () => {
    process.env.RL_DB_MODE = "file";
    await closeDb();
    expect(isMemoryMode()).toBe(false);
    expect(() => getLocalClient()).toThrow(/isolated SQLite database/);
  });
});
