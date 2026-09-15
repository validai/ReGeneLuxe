export function isPublicPath(pathname) {
  const path = String(pathname || "").split("?")[0];
  if (path.startsWith("/_next")) return true;
  if (path === "/signin" || path.startsWith("/signin/")) return true;
  if (path === "/access-not-authorized" || path.startsWith("/access-not-authorized/")) return true;
  if (path.startsWith("/api/auth")) return true;
  if (path === "/api/health") return true;
  if (path === "/api/status") return true;
  if (path.startsWith("/api/oauth/")) return true;
  if (path === "/favicon.ico" || path === "/icon" || path === "/icon.svg" || path === "/apple-icon") return true;
  if (path === "/site.webmanifest") return true;
  return false;
}

export function shouldRedirectToSignIn(pathname, isAuthenticated) {
  if (isAuthenticated) return false;
  return !isPublicPath(pathname);
}
