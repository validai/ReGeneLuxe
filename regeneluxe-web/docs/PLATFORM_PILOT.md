# Real platform pilot

This is the operator-controlled path for Instagram, Facebook Page, Threads, and YouTube. A connected account is not permission to publish. An active campaign, `AUTO_PUBLISH`, and content status `READY` are not permission either. The first live post needs a fresh approval for that exact destination and content revision.

Campaign Brain job producers stay unwired.

## What CONNECTED means

`CONNECTED` is written only after OAuth succeeds and the provider returns a real destination id. A pasted handle, URL, Page name, or channel name stays `MANUAL_ONLY` or `SETUP_REQUIRED`.

Meta does not mark the account `CONNECTED` on callback. The callback stores the grant in the encrypted vault and returns the discovered Pages. The operator must choose one. The first Page in the list is never selected automatically.

## Meta app

Use Facebook Login so one grant can discover managed Pages and the professional Instagram account linked to a Page.

| Item | Value |
| --- | --- |
| API host | `https://graph.facebook.com` and `https://www.facebook.com` |
| API version | `META_GRAPH_VERSION`, default `v23.0` |
| App id | `META_APP_ID` |
| App secret | `META_APP_SECRET` |
| Login configuration | `META_LOGIN_CONFIG_ID` (`config_id`, `response_type=code`, `override_default_response_type=true`, `auth_type=rerequest`; scope is not sent) |
| Redirect override | `META_REDIRECT_URI` |
| Instagram redirect | `http://localhost:5174/api/oauth/instagram/callback` |
| Facebook redirect | `http://localhost:5174/api/oauth/facebook/callback` |

The Facebook Login for Business configuration is the permission set. The authorization URL does not send `scope`. `override_default_response_type=true` keeps the request on the code flow, and `auth_type=rerequest` asks Meta to prompt again for that configuration.

- `business_management`
- `instagram_basic`
- `instagram_content_publish`
- `pages_read_engagement`
- `pages_show_list`

The user token is exchanged for a long-lived token (about 60 days). Page tokens from `GET /me/accounts` stay in the vault. They are not written on the account row, into jobs, or into publication attempts.

Instagram publish uses the Page token for the linked professional account:

1. `POST /{ig-user-id}/media` with a public `image_url` or Reel `video_url`
2. Poll `status_code` until `FINISHED`
3. `POST /{ig-user-id}/media_publish`
4. Store the returned media id, which must not be the container id
5. Read `permalink` when Graph returns it

Instagram will not accept `localhost`, `file://`, or a private Mac path. That asset is `LOCAL_ONLY_MEDIA`. The publish stops with `MEDIA_PUBLIC_URL_REQUIRED` before any Graph call. A trusted public `https://` URL is `PUBLIC_PROVIDER_MEDIA`. This sprint does not add a new media host.

Facebook publish is a Page feed post (`POST /{page-id}/feed`) as the selected Page, not as the Facebook user.

## Threads

Threads uses its own authorization window. It does not use Facebook Login for Business. The existing ReGeneLuxe Social Meta app can host the Threads use case, but Meta issues a separate Threads app id and secret. Do not send `META_APP_ID` or `META_APP_SECRET` to Threads.

| Item | Value |
| --- | --- |
| Authorization | `https://threads.com/oauth/authorize` |
| Token exchange | `POST https://graph.threads.com/oauth/access_token` |
| Long-lived exchange | `GET https://graph.threads.com/access_token` with `grant_type=th_exchange_token` |
| Profile | `GET https://graph.threads.com/v1.0/me?fields=id,username,name` |
| Env | `THREADS_APP_ID`, `THREADS_APP_SECRET`, and `THREADS_REDIRECT_URI` |
| Redirect | `https://threads.regeneluxe.test:5175/api/oauth/threads/callback` |
| Scope | `threads_basic` |

The ReGeneLuxe app stays on `http://localhost:5174`. Threads local OAuth uses a separate HTTPS bridge on `threads.regeneluxe.test:5175`. That bridge accepts only the Threads callback, deauthorize, and data-deletion paths. The callback redirects `code` and `state` to `http://localhost:5174/api/oauth/threads/callback`. Token exchange still sends the HTTPS redirect URI. `npm run dev` does not start the bridge. Local development runs `npm run dev:threads-https` beside it. Certificate files stay in `.certs/` and are not committed. Meta cannot reach this hostname from the internet.

The callback stores the token in the vault and returns one Threads profile. The operator confirms that destination before any account row is created or linked. A matching manual Threads entry is not merged automatically. The confirmed account is `CONNECTED` with `APPROVAL_REQUIRED`. Real Threads connect has not been executed. Publishing is not part of this connection.

## X

X uses OAuth 2.0 Authorization Code with PKCE. It does not use OAuth 1.0a or an app-only bearer token. The app type is a confidential Web App. ReGeneLuxe keeps the client secret on the server.

| Item | Value |
| --- | --- |
| Authorization | `https://x.com/i/oauth2/authorize` |
| Token exchange | `POST https://api.x.com/2/oauth2/token` |
| Refresh | `POST https://api.x.com/2/oauth2/token` with `grant_type=refresh_token` |
| Profile | `GET https://api.x.com/2/users/me?user.fields=id,username,name,profile_image_url` |
| Env | `X_CLIENT_ID` and `X_CLIENT_SECRET`. `X_REDIRECT_URI` is an optional override |
| Redirect | `http://localhost:5174/api/oauth/x/callback` |
| Scope | `users.read` and `offline.access` |

The access token lasts about two hours. `offline.access` asks X for a refresh token so the vault can renew it. The PKCE verifier stays in the server OAuth state and is discarded with that state. The callback stores tokens only after X returns a user id. The operator confirms that one X account before any account row is created or linked. A matching manual X entry is not merged automatically. The confirmed account is `CONNECTED` with `APPROVAL_REQUIRED`.

This connection does not request `tweet.write` and does not post. Older text-posting code remains in the connector and has not been live-tested, so the account card does not show a publishing capability. `GET /2/users/me` is a billed X user read. A zero credit balance blocks profile discovery. Real X connect has not been executed.

## TikTok

TikTok connection uses Login Kit for Desktop so the local callback can stay on `http://localhost:5174`. Web Login Kit redirect URIs must begin with `https`, so that product is not used for this local app. No separate TLS host was added.

| Item | Value |
| --- | --- |
| Authorization | `https://www.tiktok.com/v2/auth/authorize/` |
| Token exchange | `POST https://open.tiktokapis.com/v2/oauth/token/` |
| Refresh | `POST https://open.tiktokapis.com/v2/oauth/token/` with `grant_type=refresh_token` |
| Profile | `GET https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name` |
| Env | `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET`. `TIKTOK_REDIRECT_URI` is an optional override |
| Redirect | `http://localhost:5174/api/oauth/tiktok/callback` |
| Scope | `user.info.basic` |

Desktop Login Kit requires PKCE. TikTok's code challenge is the hex SHA-256 of the verifier, kept in the server OAuth state. The access token lasts 24 hours. The refresh token lasts 365 days and is replaced in the vault when TikTok rotates it. The callback stores tokens only after an `open_id` exists. Username is not requested, because it needs `user.info.profile`. The operator confirms the TikTok account before any row is created or linked. A matching manual entry is not merged automatically. The confirmed account is `CONNECTED` with `APPROVAL_REQUIRED`.

Content Posting API is not added. The account card shows no publishing capability. Sandbox mode lets a target user connect without app review and without payment. A public Login Kit app still needs TikTok app review. Real TikTok connect has not been executed.

## Twitch

Twitch connection uses the authorization code grant. The app is a confidential server client, so PKCE is not required. The callback stays on the canonical local origin. The Threads HTTPS bridge is not used.

| Item | Value |
| --- | --- |
| Authorization | `https://id.twitch.tv/oauth2/authorize` |
| Token exchange | `POST https://id.twitch.tv/oauth2/token` |
| Refresh | `POST https://id.twitch.tv/oauth2/token` with `grant_type=refresh_token` |
| Validation | `GET https://id.twitch.tv/oauth2/validate` once after the code exchange |
| Profile | `GET https://api.twitch.tv/helix/users` with the user token and `Client-Id` |
| Revoke | `POST https://id.twitch.tv/oauth2/revoke` on disconnect |
| Env | `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`. `TWITCH_REDIRECT_URI` is an optional override |
| Redirect | `http://localhost:5174/api/oauth/twitch/callback` |
| Scope | none |

Get Users returns the authorizing user without a scope. Email, chat, channel management, clips, and schedule scopes are not requested. The access token lasts about four hours. A confidential refresh token does not expire on a timer, and Twitch may replace it on refresh. The callback validates the token, reads the user id, login, display name, and profile image, then stores the tokens. The operator confirms that Twitch account before any row is created or linked. A manual row links only when its handle is the same login. Display name alone is not a match. The confirmed account is `CONNECTED` with `APPROVAL_REQUIRED`. Stream, chat, clip, and moderation calls are not part of this connection. Real Twitch connect has not been executed.

## Kick

Kick connection uses the OAuth 2.1 authorization code grant with PKCE. The callback stays on the canonical local origin. Use `localhost`, not `127.0.0.1`. The Threads HTTPS bridge is not used.

| Item | Value |
| --- | --- |
| Authorization | `GET https://id.kick.com/oauth/authorize` |
| Token exchange | `POST https://id.kick.com/oauth/token` |
| Refresh | `POST https://id.kick.com/oauth/token` with `grant_type=refresh_token` |
| Introspection | `POST https://id.kick.com/oauth/token/introspect` once after the code exchange |
| Profile | `GET https://api.kick.com/public/v1/users` |
| Revoke | `POST https://id.kick.com/oauth/revoke` on disconnect |
| Env | `KICK_CLIENT_ID` and `KICK_CLIENT_SECRET`. `KICK_REDIRECT_URI` is an optional override |
| Redirect | `http://localhost:5174/api/oauth/kick/callback` |
| Scope | `user:read` |

The PKCE challenge is the base64url SHA-256 of the verifier. The verifier stays in the server OAuth state and is discarded with that state. Kick's token response includes `expires_in` and a new refresh token on refresh. The callback stores tokens only after introspection reports an active user token for this client with `user:read`, and Get Users returns a `user_id`. That user id is the account identity. Channel, chat, stream-key, event, moderation, rewards, and ads endpoints are not called. The operator confirms the Kick account before any row is created or linked. A manual row links only when its handle is the same username. Display name alone is not a match. The confirmed account is `CONNECTED` with `APPROVAL_REQUIRED`. Real Kick connect has not been executed.

## LinkedIn

LinkedIn connection uses Sign In with LinkedIn using OpenID Connect. It is the confidential authorization-code flow. PKCE is not required. The callback stays on the canonical local origin. The Threads HTTPS bridge is not used.

| Item | Value |
| --- | --- |
| Authorization | `GET https://www.linkedin.com/oauth/v2/authorization` |
| Token exchange | `POST https://www.linkedin.com/oauth/v2/accessToken` |
| Refresh | Only when LinkedIn returns a refresh token. Most identity apps do not |
| Profile | `GET https://api.linkedin.com/v2/userinfo` |
| Env | `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`. `LINKEDIN_REDIRECT_URI` is an optional override |
| Redirect | `http://localhost:5174/api/oauth/linkedin/callback` |
| Scope | `openid` and `profile` |

The member subject `sub` is the account id. Userinfo also supplies the name and picture. Email is not requested and is not stored. OpenID Connect does not return a public profile slug, so the destination does not invent a `/in/` URL. The access token lasts 60 days. Programmatic refresh tokens are partner-only; when one is absent, reconnect is a new authorization. The operator confirms the member before any row is created or linked. A manual row is not linked from the display name. The confirmed account is `CONNECTED` with `APPROVAL_REQUIRED`. Share on LinkedIn, organization posting, and ads are not requested. Real LinkedIn connect has not been executed.

## YouTube

The Settings YouTube connection stays a readonly channel grant. It uses `youtube.readonly` and `yt-analytics.readonly`, and it still selects the only channel or asks when Google returns more than one. That path does not request upload permission.

A social YouTube account connect from Accounts requests the pilot scopes:

- `openid`, `email`, `profile`
- `https://www.googleapis.com/auth/youtube.readonly`
- `https://www.googleapis.com/auth/youtube.upload`

Redirect: `http://localhost:5174/api/oauth/youtube/callback`

The publish destination is that verified channel id. One channel can become `CONNECTED`. More than one channel leaves the social account at `SETUP_REQUIRED` with the discovered channel list; the first channel is not chosen automatically. The Settings connection still uses its existing picker. The upload is a server-side resumable session to YouTube Data API v3. `privacyStatus` is always `private`. A public or unlisted upload is rejected before the upload starts. The Google Cloud project is not assumed to be approved for public uploads.

## Fresh approval

`PUT /api/publish` creates an approval bound to the operator, workspace, content fingerprint, provider, account, external destination, and media reference. It expires in 15 minutes and is single-use.

`POST /api/publish` enqueues a job with that approval id. The worker checks the artifact, consumes it with a conditional database update, then calls the provider. A second worker that loses the consume does not call the provider. A successful `publication_attempts` row with the same idempotency key is not published again.

Job payloads carry ids only.

## Campaign result

`campaignPlatformResults` reads publication attempts:

- Instagram, Facebook, and Threads: `PUBLISHED`, `FAILED`, or `NOT_ATTEMPTED`
- YouTube: `PRIVATE_UPLOAD_CONFIRMED`, `FAILED`, or `NOT_ATTEMPTED`

## Live Meta connection

Verified for the DJ Coast workspace after a completed Facebook Login for Business grant:

| Item | State |
| --- | --- |
| Meta authorization | WORKING |
| Facebook Page connection | WORKING. DJ Coast is `CONNECTED` with approval required. |
| Instagram professional discovery | WORKING. The Page resolves to `@_djcoast`. |
| Instagram connected account | WORKING. The earlier manual `@_djcoast` row was linked. It was not duplicated. |
| Instagram image publishing foundation | WORKING. One JPEG or PNG plus a caption. Container, polling, `media_publish`, media id, and permalink are implemented. |
| Public media delivery | OPERATOR SETUP REQUIRED until `PUBLIC_MEDIA_PROVIDER=vercel_blob` and `BLOB_READ_WRITE_TOKEN` are set. Connected is not the same as ready to publish. |
| Real Instagram publish | NOT YET EXECUTED. |
| Real Facebook publishing | NOT YET EXECUTED. The implemented path is a Page text post. |

Local images stay in `.regeneluxe/media`. A publish uploads one unguessable object to Vercel Blob, which returns an HTTPS URL Meta can fetch. The object stays up through container creation, polling, and `media_publish`. After success it is removed 24 hours later. After a failed attempt it is removed 2 hours later. ReGeneLuxe itself is not exposed, and the public URL is not the canonical media id.

## Live test

Do not publish from a script. After credentials exist, connect in the app, confirm the discovered Page, Instagram account, Threads user, or YouTube channel, then approve that exact post in ReGeneLuxe. Automated tests mock HTTP and do not post.

## Token expiry

| Provider | Lifetime | Expiry result |
| --- | --- | --- |
| Meta user token | short-lived, then about 60 days after exchange | `RECONNECT_REQUIRED` when Graph rejects the token |
| Page token | follows the user grant | same |
| Threads | short-lived, then long-lived after exchange | `RECONNECT_REQUIRED` when identity or publish auth fails |
| YouTube | access token about 1 hour, refresh token when Google returns one | `RECONNECT_REQUIRED` when refresh or upload auth fails |
| Twitch | access token about 4 hours, confidential refresh token until revoked or rotated | `RECONNECT_REQUIRED` when validation or refresh fails |
| Kick | `expires_in` from the token response; refresh token is replaced when Kick returns a new one | `RECONNECT_REQUIRED` when introspection or refresh fails |
| LinkedIn | access token 60 days; refresh token only when LinkedIn issues one | `RECONNECT_REQUIRED` when the token expires and no refresh token is stored |

Ordinary provider failures that are not an authorization rejection stay `ERROR`. Refreshed tokens stay in the vault.
