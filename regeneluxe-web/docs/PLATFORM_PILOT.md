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

Threads uses its own authorization host, `https://threads.net/oauth/authorize`, and `https://graph.threads.net/v1.0`.

| Item | Value |
| --- | --- |
| Env | `THREADS_APP_ID` and `THREADS_APP_SECRET`, or the Meta app pair as fallback |
| Redirect | `http://localhost:5174/api/oauth/threads/callback` |
| Scopes | `threads_basic`, `threads_content_publish` |

The account becomes `CONNECTED` only after `GET /me?fields=id,username,name` succeeds. The short-lived token is exchanged for a long-lived token when Threads accepts `th_exchange_token`. The first publish path is text only: create a text container, then publish that creation id. ReGeneLuxe does not use a provider auto-publish flag.

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
| Real Instagram publishing | BLOCKED. The image path creates a container, sends the caption, polls, then calls `media_publish`, but Meta must fetch a public `https://` media URL. Local and localhost assets stop at `MEDIA_PUBLIC_URL_REQUIRED`. |
| Real Facebook publishing | NOT YET PILOTED. The implemented path is a Page text post. Do not treat it as tested live. |

A public media URL needs a temporary signed route on a host Meta can reach: unguessable, expiring, limited to the approved asset, with the right MIME type and no directory listing. This app does not add a tunnel or a third-party media host.

## Live test

Do not publish from a script. After credentials exist, connect in the app, confirm the discovered Page, Instagram account, Threads user, or YouTube channel, then approve that exact post in ReGeneLuxe. Automated tests mock HTTP and do not post.

## Token expiry

| Provider | Lifetime | Expiry result |
| --- | --- | --- |
| Meta user token | short-lived, then about 60 days after exchange | `RECONNECT_REQUIRED` when Graph rejects the token |
| Page token | follows the user grant | same |
| Threads | short-lived, then long-lived after exchange | `RECONNECT_REQUIRED` when identity or publish auth fails |
| YouTube | access token about 1 hour, refresh token when Google returns one | `RECONNECT_REQUIRED` when refresh or upload auth fails |

Ordinary provider failures that are not an authorization rejection stay `ERROR`. Refreshed tokens stay in the vault.
