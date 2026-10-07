import { beforeEach, describe, expect, it } from "vitest";
import { emptySettings } from "./models.js";
import { applyTheme, getSettings, updateSettings } from "./settingsRepository.js";
import {
  normalizeThemePreference,
  selectSettingsRecord,
  themeFromCookie,
  THEME_COOKIE,
  THEME_STORAGE_KEY,
} from "./theme.js";

describe("theme preference", () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = "";
    document.documentElement.style.colorScheme = "";
    document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0`;
  });

  it("accepts only dark, light, and system", () => {
    expect(normalizeThemePreference("light")).toBe("light");
    expect(normalizeThemePreference(" System ")).toBe("system");
    expect(normalizeThemePreference("LIGHT")).toBe("light");
    expect(normalizeThemePreference("white")).toBe("dark");
    expect(normalizeThemePreference("")).toBe("dark");
    expect(normalizeThemePreference(null)).toBe("dark");
    expect(emptySettings({ theme: "nope" }).theme).toBe("dark");
    expect(emptySettings({ theme: "light" }).theme).toBe("light");
  });

  it("keeps the canonical account row ahead of a newer legacy row", () => {
    const selected = selectSettingsRecord([
      { id: "default", theme: "light", updatedAt: "2026-10-07T22:00:00.000Z" },
      { id: "app", theme: "dark", updatedAt: "2026-10-01T00:00:00.000Z" },
    ]);
    expect(selected).toMatchObject({ id: "app", theme: "dark" });
  });

  it("uses a valid legacy theme when the account row has none", () => {
    const selected = selectSettingsRecord([
      { id: "app", updatedAt: "2026-10-07T22:00:00.000Z" },
      { id: "default", theme: "light", updatedAt: "2026-09-01T00:00:00.000Z" },
    ]);
    expect(selected).toMatchObject({ id: "app", theme: "light" });
  });

  it("paints light when that is the saved preference", () => {
    expect(applyTheme("light", { persist: true })).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.cookie).toContain(`${THEME_COOKIE}=light`);
  });

  it("stores system as the preference and the resolved color in the cookie", () => {
    const previous = window.matchMedia;
    window.matchMedia = (query) => ({
      matches: String(query).includes("light"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    });
    expect(applyTheme("system", { persist: true })).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    expect(document.cookie).toContain(`${THEME_COOKIE}=light`);
    expect(themeFromCookie("light")).toBe("light");
    expect(themeFromCookie("system")).toBe("dark");
    window.matchMedia = previous;
  });

  it("saves the chosen theme instead of replacing it", () => {
    updateSettings({ theme: "light" });
    expect(getSettings().theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
