// MODE 3 SAFETY:
// - Added window guard
// - Added robust localStorage try/catch wrappers
// - Added defensive email normalization
// - Added snapshot() for devTools

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
  return (email || "").trim();
}

export const Auth = {
  isSignedIn() {
    if (!hasStorage()) return false;
    try {
      return window.localStorage.getItem("rl_auth") === "1";
    } catch {
      return false;
    }
  },

  signIn(email) {
    if (!hasStorage()) return;
    const e = normalize(email);
    try {
      window.localStorage.setItem("rl_auth", "1");
      window.localStorage.setItem("rl_user", e);
    } catch (err) {
      console.error("[Auth] signIn error", err);
    }
  },

  signOut() {
    if (!hasStorage()) return;
    try {
      window.localStorage.removeItem("rl_auth");
      window.localStorage.removeItem("rl_user");
    } catch (err) {
      console.error("[Auth] signOut error", err);
    }
  },

  user() {
    if (!hasStorage()) return "";
    try {
      return window.localStorage.getItem("rl_user") || "";
    } catch {
      return "";
    }
  },

  snapshot() {
    return {
      signedIn: this.isSignedIn(),
      email: this.user(),
    };
  },
};
