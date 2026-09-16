/** Operator login vs profile Gmail connection — keep these lists separate. */

export const OPERATOR_GOOGLE_SCOPES = "openid profile email";

export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export const GMAIL_CONNECTION_SCOPES = [
  "openid",
  "email",
  "profile",
  GMAIL_READONLY_SCOPE,
];

export const GMAIL_CONNECTION_SCOPE_STRING = GMAIL_CONNECTION_SCOPES.join(" ");
