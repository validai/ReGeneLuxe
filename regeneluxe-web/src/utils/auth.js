// FILE: src/utils/auth.js
export const Auth = {
  isSignedIn() {
    return localStorage.getItem("rl_auth") === "1";
  },
  signIn(email) {
    console.log("[Auth] signIn", email);
    localStorage.setItem("rl_auth", "1");
    localStorage.setItem("rl_user", (email || "").trim());
  },
  signOut() {
    console.log("[Auth] signOut");
    localStorage.removeItem("rl_auth");
    localStorage.removeItem("rl_user");
  },
  user() {
    return localStorage.getItem("rl_user") || "";
  },
};
