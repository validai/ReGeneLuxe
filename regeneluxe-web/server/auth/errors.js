export function authErrorMessage(code) {
  const key = String(code || "").trim();
  switch (key) {
    case "OAuthCallback":
    case "OAuthCallbackError":
    case "Callback":
      return "Sign-in could not be completed. Google returned an invalid callback. Please try again.";
    case "OAuthSignin":
    case "OAuthCreateAccount":
      return "Could not start Google sign-in. Please try again.";
    case "AccessDenied":
      return "Google sign-in was cancelled or denied.";
    case "SessionRequired":
    case "expired":
      return "Your session expired. Please sign in again.";
    case "Configuration":
      return "Google sign-in did not complete. Open ReGeneLuxe at http://127.0.0.1:5174 and try again.";
    case "database":
      return "ReGeneLuxe could not open the local database. Your data was not deleted.";
    case "sync":
      return "Cloud sync is unavailable. Local data is still saved.";
    case "Default":
    case "unknown":
      return "Sign-in did not complete. Please try again.";
    default:
      return key ? "Sign-in did not complete. Please try again." : "";
  }
}
