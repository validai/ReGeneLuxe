// FILE: src/utils/onboarding.js
export const Onboarding = {
  key(email) {
    return `rl_onboarded:${(email || "").trim().toLowerCase()}`;
  },

  // Helper to check both normalized and legacy (non-normalized) keys
  _getValue(email) {
    if (!email) return null;

    const normalized = (email || "").trim().toLowerCase();
    const normalizedKey = this.key(email);
    const value = localStorage.getItem(normalizedKey);

    // If found with normalized key, return it
    if (value !== null) return value;

    // Backward compatibility: check legacy non-normalized key
    const legacyKey = `rl_onboarded:${email}`;
    const legacyValue = localStorage.getItem(legacyKey);

    // If legacy key exists, migrate it to normalized key
    if (legacyValue !== null) {
      localStorage.setItem(normalizedKey, legacyValue);
      localStorage.removeItem(legacyKey);
      console.log("[Onboarding] migrated legacy key:", legacyKey, "→", normalizedKey);
      return legacyValue;
    }

    return null;
  },

  isDone(email) {
    if (!email) return false;
    return this._getValue(email) === "1";
  },

  complete(email) {
    if (!email) {
      console.warn("[Onboarding.complete] called with empty email");
      return;
    }
    localStorage.setItem(this.key(email), "1");
  },

  reset(email) {
    if (!email) return;

    const normalizedKey = this.key(email);
    const legacyKey = `rl_onboarded:${email}`;

    // Remove both normalized and legacy keys for safety
    localStorage.removeItem(normalizedKey);
    localStorage.removeItem(legacyKey);
  },
};
  