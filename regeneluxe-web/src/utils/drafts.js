// MODE 3 SAFETY:
// - Added stable normalization
// - Storage guard
// - Fail-soft parse
// - Defensive draft clearing rules

const KEY = "rl_start_draft_v2";

function hasStorage() {
  try {
    if (typeof window === "undefined") return false;
    const t = "__rl_test__";
    window.localStorage.setItem(t, "1");
    window.localStorage.removeItem(t);
    return true;
  } catch {
    return false;
  }
}

function normalize(email) {
  return (email || "").trim().toLowerCase();
}

export const Drafts = {
  load(email) {
    if (!hasStorage()) return null;
    let raw;
    try {
      raw = window.localStorage.getItem(KEY);
    } catch {
      return null;
    }
    if (!raw) return null;

    try {
      const data = JSON.parse(raw);
      if (typeof data !== "object") return null;
      const stored = normalize(data.email);
      if (stored !== normalize(email)) return null;
      return data;
    } catch {
      return null;
    }
  },

  save(email, form, step) {
    if (!hasStorage()) return;
    try {
      const payload = {
        email: normalize(email),
        form: form || {},
        step: typeof step === "number" ? step : 0,
      };
      window.localStorage.setItem(KEY, JSON.stringify(payload));
    } catch (err) {
      console.error("[Drafts.save] error", err);
    }
  },

  clear(email) {
    if (!hasStorage()) return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data) return;

      const stored = normalize(data.email);
      if (stored !== normalize(email)) return;

      window.localStorage.removeItem(KEY);
    } catch (err) {
      console.error("[Drafts.clear] error", err);
    }
  },
};
