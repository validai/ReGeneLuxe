/** ReGeneLuxe account login vs incremental Gmail/YouTube scopes — keep these lists separate. */

export const ACCOUNT_GOOGLE_SCOPES = "openid profile email";

/** @deprecated use ACCOUNT_GOOGLE_SCOPES */
export const OPERATOR_GOOGLE_SCOPES = ACCOUNT_GOOGLE_SCOPES;

export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export const GMAIL_CONNECTION_SCOPES = [
  "openid",
  "email",
  "profile",
  GMAIL_READONLY_SCOPE,
];

export const GMAIL_CONNECTION_SCOPE_STRING = GMAIL_CONNECTION_SCOPES.join(" ");

export const YOUTUBE_READONLY_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

export const YOUTUBE_CONNECTION_SCOPE_STRING = YOUTUBE_READONLY_SCOPES.join(" ");
