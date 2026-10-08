# Connection status contracts

Connection status is split by domain. A value in one domain is not a value in another, even when the word is the same (`ERROR`, `SYNCING`).

Runtime definitions live in `src/data/statusContracts.js`. Screens do not keep their own status tables.

## Provider connection

Gmail and YouTube profile grants (`profile_connections.status`).

| State | Label | Meaning |
| --- | --- | --- |
| `CONNECTED` | Connected | A live provider grant is stored |
| `NOT_CONNECTED` | Not connected | No live grant |
| `RECONNECT_REQUIRED` | Reconnect required | Authorization needs the operator |
| `SETUP_REQUIRED` | Setup required | Provider configuration is blocking the grant (for example a disabled API) |
| `SYNCING` | Syncing | A provider sync is in progress |
| `ERROR` | Error | The last operation failed and a new grant is not required |

`SYNCING` is written onto the profile connection row when a Gmail sync starts (`gmailConnection`, `gmailSync`) and replaced when that sync finishes. It is not derived by treating a job `RUNNING` row as the connection status. Job status stays on the job. A retryable Gmail failure can return the connection to `CONNECTED` while the job itself is `ERROR`.

### Allowed provider transitions

These are the transitions the current Gmail and YouTube code already perform. This sprint does not add new ones.

| From | To |
| --- | --- |
| `NOT_CONNECTED` | `CONNECTED` after a successful grant |
| `CONNECTED` | `SYNCING` when a sync starts |
| `CONNECTED` | `RECONNECT_REQUIRED` when authorization is revoked or rejected |
| `CONNECTED` | `ERROR` or `SETUP_REQUIRED` when the provider returns those outcomes |
| `SYNCING` | `CONNECTED` on success, or when a retryable failure keeps the grant usable |
| `SYNCING` | `ERROR`, `RECONNECT_REQUIRED`, or `SETUP_REQUIRED` when the outcome says so |
| `ERROR` | `SYNCING` on the next sync attempt, then `CONNECTED` if that attempt succeeds |
| `RECONNECT_REQUIRED` | `CONNECTED` only after a later successful authorization |
| `SETUP_REQUIRED` | `CONNECTED` or `SYNCING` once configuration allows the operation to proceed |

## Social account connection

Instagram, Facebook, X, Threads, SoundCloud, TikTok, LinkedIn, Snapchat, Twitch, Kick, and manual identification.

| State | Label | Meaning |
| --- | --- | --- |
| `MANUAL_ONLY` | Manual | Handle or URL only. Not an OAuth proof |
| `UNCONNECTED` | Not connected | Account exists and is not authenticated |
| `NOT_CONNECTED` | Not connected | Recognized when a social row carries the provider word. It is not an alias of `UNCONNECTED` |
| `CONNECTING` | Connecting | Authorization has started |
| `CONNECTED` | Connected | Authenticated connector |
| `AUTH_EXPIRED` | Reconnect required | Legacy social value for an expired grant |
| `RECONNECT_REQUIRED` | Reconnect required | Authorization needs the operator |
| `ERROR` | Error | Operation failed. This is not the same badge as reconnect |
| `UNSUPPORTED` | Unsupported | No authenticated connector for the platform |
| `SETUP_REQUIRED` | Setup required | The account is known and provider setup is incomplete |
| `PROVIDER_REVIEW_REQUIRED` | Provider review required | Waiting on provider approval |

Pasting a handle or URL must not write `CONNECTED`.

Provider readiness (`IMPLEMENTED`, `SETUP_REQUIRED`, `PROVIDER_REVIEW_REQUIRED`, `UNSUPPORTED` in `server/connectors/capabilities.js`) describes whether a connector can be activated. It is not the stored connection state. Display may use readiness to refine a placeholder (`MANUAL_ONLY`, `UNCONNECTED`, `NOT_CONNECTED`, or an empty state). It does not relabel `CONNECTED`, and it does not relabel an unrecognized value.

### Social transitions in current code

| From | To |
| --- | --- |
| new manual account | `MANUAL_ONLY` |
| new non-manual account | `UNCONNECTED` |
| connect start | `CONNECTING` |
| successful OAuth | `CONNECTED` |
| refresh failure | connector state, or `RECONNECT_REQUIRED` |
| setup response | `SETUP_REQUIRED` |
| expired grant | `AUTH_EXPIRED` (recorded as a connection-expired event) |

`NOT_CONNECTED` on YouTube means there is no profile grant. `SETUP_REQUIRED` on a social account means the account is known and setup is incomplete. Those strings stay different.

## Job state

`PENDING`, `RUNNING`, `DONE`, `ERROR`, `FAILED` in `server/db/jobs.js`.

Job `RUNNING` is not provider `SYNCING`. Job `ERROR` is not provider `ERROR`. The words overlap. The records do not.

## Database sync health

`LOCAL_ONLY`, `PENDING`, `SYNCING`, `SYNCED`, `ERROR`, `CONFLICT`.

Documented in `docs/DATA_SYNC.md`. Outbox rows use their own `PENDING`, `SYNCING`, `DONE`, `ERROR`, `CONFLICT` set. None of these are provider connection states.

## Presentation

Each canonical state carries `label`, `tone`, and `hint` in `statusContracts.js`.

`StatusBadge`, Settings, and Accounts read that metadata. They do not define a second label map.

## Unknown values

An unrecognized status renders as **Unknown** with a muted badge and the title "Unrecognized status". It is not shown as Connected, Not connected, Setup required, or Healthy.

Reads do not rewrite a stored value. `publicProfileConnection` keeps the raw status so an old row stays readable. New provider writes use `PROVIDER_CONNECTION_STATES`.

`DISCONNECTED` is not a connection state. `accountRepository` still treats that legacy patch as a disconnect event. The badge for it is Unknown.

## Persisted values

The local database currently stores:

- Gmail `CONNECTED`
- YouTube `NOT_CONNECTED`
- Instagram Test `SETUP_REQUIRED`

Those strings are the canonical values. This contract does not rename them.
