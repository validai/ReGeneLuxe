// MODE 3 SAFETY:
// - Window guard
// - Storage guard
// - Soft failure on exceptions

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

function key(email) {
  return "rl_onboarded:" + (email || "").trim();
}

export const Onboarding = {
  isDone(email) {
    if (!hasStorage()) return false;
    try {
      return window.localStorage.getItem(key(email)) === "1";
    } catch {
      return false;
    }
  },

  complete(email) {
    if (!hasStorage()) return;
    try {
      window.localStorage.setItem(key(email), "1");
    } catch (err) {
      console.error("[Onboarding.complete] error", err);
    }
  },

  reset(email) {
    if (!hasStorage()) return;
    try {
      window.localStorage.removeItem(key(email));
    } catch (err) {
      console.error("[Onboarding.reset] error", err);
    }
  },
};