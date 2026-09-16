import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_BACKEND } from "./data/access.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const NATIVE_PAGES = [
  "app/(workspace)/page.tsx",
  "app/(workspace)/calendar/page.tsx",
  "app/(workspace)/content/page.tsx",
  "app/(workspace)/content/new/page.tsx",
  "app/(workspace)/content/[contentId]/page.tsx",
  "app/(workspace)/campaigns/page.tsx",
  "app/(workspace)/campaigns/[campaignId]/page.tsx",
  "app/(workspace)/inbox/page.tsx",
  "app/(workspace)/analytics/page.tsx",
  "app/(workspace)/accounts/page.tsx",
  "app/(workspace)/settings/page.tsx",
  "app/(workspace)/settings/profile/page.tsx",
  "app/(workspace)/queue/page.tsx",
  "app/signin/page.tsx",
  "app/access-not-authorized/page.tsx",
  "app/setup/profile/page.tsx",
];

describe("native App Router peel", () => {
  it("exposes native page modules for every product route", () => {
    for (const rel of NATIVE_PAGES) {
      expect(existsSync(path.join(root, rel)), rel).toBe(true);
    }
  });

  it("does not ship the SPA bridge entrypoints", () => {
    expect(existsSync(path.join(root, "app/SpaBridge.tsx"))).toBe(false);
    expect(existsSync(path.join(root, "app/ClientSpa.tsx"))).toBe(false);
    expect(existsSync(path.join(root, "app/[...slug]/page.tsx"))).toBe(false);
  });

  it("keeps workspace layout + providers for shell persistence", () => {
    const layout = readFileSync(path.join(root, "app/(workspace)/layout.tsx"), "utf8");
    expect(layout).toContain("WorkspaceProviders");
    expect(existsSync(path.join(root, "src/components/app/WorkspaceProviders.jsx"))).toBe(true);
  });

  it("defaults shared nav to the Next runtime", () => {
    const index = readFileSync(path.join(root, "src/nav/index.js"), "utf8");
    expect(index).toContain("./next.jsx");
    expect(index).not.toContain("./vite.jsx");
  });

  it("declares sqlite as the durable data backend", () => {
    expect(DATA_BACKEND).toBe("sqlite");
  });

  it("keeps same-origin API route handlers", () => {
    const apiDir = path.join(root, "app/api");
    const routes = readdirSync(apiDir);
    expect(routes).toEqual(expect.arrayContaining(["health", "status", "secrets", "ai", "auth"]));
  });
});
