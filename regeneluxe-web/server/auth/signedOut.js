/** Dedicated sign-out confirmation. Not an auth error. */

export const SIGNED_OUT_HREF = "/signin?signedOut=1";

export function isSignedOutParam(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  const flag = String(raw || "").trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}
