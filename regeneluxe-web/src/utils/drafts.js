// FILE: src/utils/drafts.js

const KEY = "rl_start_draft_v1";

function hasWindow() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function normalizeEmail(email) {
  const trimmed = (email || "").trim().toLowerCase();
  return trimmed || null;
}

export const Drafts = {
  load() {
    if (!hasWindow()) return null;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      return data;
    } catch (e) {
      console.error("[Drafts.load] error", e);
      return null;
    }
  },

  save(email, form, step) {
    if (!hasWindow()) return;
    const normalized = normalizeEmail(email);
    if (!normalized) return;

    try {
      const payload = {
        email: normalized,
        form: form || {},
        step: typeof step === "number" ? step : 0,
        ts: new Date().toISOString(),
      };
      window.localStorage.setItem(KEY, JSON.stringify(payload));
    } catch (e) {
      console.error("[Drafts.save] error", e);
    }
  },

  clear(email) {
    if (!hasWindow()) return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      const storedEmail = normalizeEmail(data?.email);
      const normalized = normalizeEmail(email);

      // If we know the email and it doesn't match, keep the draft
      if (normalized && storedEmail && normalized !== storedEmail) return;

      window.localStorage.removeItem(KEY);
    } catch (e) {
      console.error("[Drafts.clear] error", e);
    }
  },
};
