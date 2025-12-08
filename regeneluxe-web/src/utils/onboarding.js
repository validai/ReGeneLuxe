// regeneluxe-web/src/utils/onboarding.js
import { Auth } from "./auth";

// Keyed by email so onboarding is per-user, not global
const key = (email) => {
  const e = (email || Auth.user() || "").trim().toLowerCase();
  return e ? `rl_onboarded:${e}` : "rl_onboarded:_anon";
};

export const Onboarding = {
    isDone(email) {
      if (!email) return false;
      return localStorage.getItem(`rl_onboarded:${email}`) === "1";
    },
    complete(email) {
      if (!email) return;
      localStorage.setItem(`rl_onboarded:${email}`, "1");
    },
    reset(email) {
      if (!email) return;
      localStorage.removeItem(`rl_onboarded:${email}`);
    },
  };