import { describe, expect, it } from "vitest";
import { getSidebarCollapsed, setSidebarCollapsed } from "./uiPrefs.js";

describe("sidebar UI preference", () => {
  it("persists compact state in regeneluxe.sidebarCollapsed only", () => {
    setSidebarCollapsed(true);
    expect(localStorage.getItem("regeneluxe.sidebarCollapsed")).toBe("1");
    expect(getSidebarCollapsed()).toBe(true);
    setSidebarCollapsed(false);
    expect(localStorage.getItem("regeneluxe.sidebarCollapsed")).toBe("0");
    expect(getSidebarCollapsed()).toBe(false);
  });

  it("migrates the legacy localStorage key", () => {
    localStorage.setItem("rl_sidebar_collapsed", "1");
    expect(getSidebarCollapsed()).toBe(true);
  });
});
