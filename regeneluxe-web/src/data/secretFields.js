/** Field names that must never reach the client bundle, backups, or Campaign Brain. */
export const SECRET_FIELD_NAMES = [
  "apiKey",
  "accessToken",
  "refreshToken",
  "token",
  "secret",
  "password",
  "clientSecret",
  "authorization",
  "Authorization",
  "access_token",
  "refresh_token",
  "client_secret",
  "api_key",
  "idToken",
  "id_token",
  "AUTH_SECRET",
  "AUTH_GOOGLE_SECRET",
  "AUTH_GOOGLE_ID",
  "TURSO_AUTH_TOKEN",
  "authToken",
];

/** Extra identity keys excluded from Campaign Brain / ordinary UI payloads. */
export const AI_EXCLUDED_FIELDS = [...SECRET_FIELD_NAMES, "googleSub"];

export function stripSecretFields(value, extraKeys = []) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => stripSecretFields(item, extraKeys));
  const clone = { ...value };
  const keys = new Set([...SECRET_FIELD_NAMES, ...extraKeys]);
  for (const key of keys) {
    delete clone[key];
  }
  for (const key of Object.keys(clone)) {
    clone[key] = stripSecretFields(clone[key], extraKeys);
  }
  return clone;
}
