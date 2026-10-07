/** Closed set for the account appearance preference. */
export const THEME_PREFERENCES = ["dark", "light", "system"];

export const DEFAULT_THEME = "dark";

/** Account settings row. Legacy migration rows used "default". */
export const SETTINGS_RECORD_ID = "app";

export const LEGACY_SETTINGS_RECORD_ID = "default";

/** Preference cache read before React hydrates. */
export const THEME_STORAGE_KEY = "regeneluxe.theme";

/** Resolved paint (dark or light) so the server can render the same color. */
export const THEME_COOKIE = "regeneluxe-theme";

export const THEME_OPTIONS = [
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
];

/**
 * Boot script. Reads only a valid preference from localStorage.
 * Does not invent or overwrite a preference. Updates the resolved cookie
 * so the next server render matches this paint.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");if(p!=="dark"&&p!=="light"&&p!=="system")return;var r=p==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;var el=document.documentElement;el.setAttribute("data-theme",r);el.style.colorScheme=r;document.cookie="${THEME_COOKIE}="+r+"; Path=/; Max-Age=31536000; SameSite=Lax";}catch(e){}})();`;

export function normalizeThemePreference(value) {
  if (typeof value !== "string") return DEFAULT_THEME;
  const theme = value.trim().toLowerCase();
  return THEME_PREFERENCES.includes(theme) ? theme : DEFAULT_THEME;
}

export function explicitThemePreference(value) {
  if (typeof value !== "string") return null;
  const theme = value.trim().toLowerCase();
  return THEME_PREFERENCES.includes(theme) ? theme : null;
}

export function resolveThemePreference(preference, prefersLight = false) {
  const theme = normalizeThemePreference(preference);
  if (theme === "system") return prefersLight ? "light" : "dark";
  return theme;
}

export function readPrefersLight() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-color-scheme: light)").matches === true;
}

/** Server and boot cookie. Only an exact light value paints light. */
export function themeFromCookie(value) {
  return value === "light" ? "light" : "dark";
}

/**
 * One settings object. Prefer the canonical account row. If that row has no
 * valid theme, keep a valid theme from another row instead of inventing one
 * from row order.
 * @param {unknown} rows
 */
export function selectSettingsRecord(rows) {
  const list = (Array.isArray(rows) ? rows : [])
    .filter((row) => row && typeof row === "object" && !Array.isArray(row));
  if (!list.length) return null;

  const canonical = list.find((row) => row.id === SETTINGS_RECORD_ID) || null;
  const themed = list
    .filter((row) => explicitThemePreference(row.theme))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const source = canonical || themed[0] || list[0];
  const theme = explicitThemePreference(canonical?.theme)
    || explicitThemePreference(themed[0]?.theme)
    || DEFAULT_THEME;

  return {
    ...source,
    id: SETTINGS_RECORD_ID,
    theme,
  };
}

export function writeThemePreference(preference) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, normalizeThemePreference(preference));
  } catch {
    /* ignore quota / private mode */
  }
}

export function writeThemeCookie(resolved) {
  if (typeof document === "undefined") return;
  const paint = resolved === "light" ? "light" : "dark";
  document.cookie = `${THEME_COOKIE}=${paint}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
