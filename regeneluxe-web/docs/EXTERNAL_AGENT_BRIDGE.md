# External Agent Bridge (V1 + marketing draft import)

Prepares ReGeneLuxe for trusted marketing-team agents (GrokBots) as analysts and draft importers.

This is **not** a live remote Grok connection.
This is **not** a public exposure.
This is **not** a standing Grok pairing password.
This is **not** permission for an external AI to publish or operate ReGeneLuxe.

## Transport truth (current)

**ReGeneLuxe currently accepts agent connections only through its local runtime** (`127.0.0.1` / `localhost:5174`).

| Mode | Credential created? | Can connect today? |
|------|---------------------|--------------------|
| `LOCAL_TEST_CLIENT` | Yes (after agent + mode chosen) | Yes — process on this machine |
| `REMOTE_AGENT` | **No** | **No** — remote transport not configured |

A remote Grok agent **cannot** currently reach ReGeneLuxe.

Do **not**:

- expose port 5174 publicly merely to make Grok connect
- auto-create Cloudflare / ngrok / similar tunnels
- generate a pairing credential when transport is invalid
- imply pairing is possible when the agent cannot reach localhost

### Future (not built in this sprint)

Preferred secure direction:

```
remote agent
  ↕
secure rendezvous / relay
  ↕ outbound connection
local ReGeneLuxe
```

ReGeneLuxe should initiate outbound connectivity rather than accepting arbitrary inbound internet traffic. No provider credentials or database contents should live in the relay.

## Architecture

- Provider-neutral trusted analyst bridge
- Disabled by default (`EXTERNAL_AGENT_BRIDGE_ENABLED=1` to allow pairing)
- Local-only transport
- Operator-initiated **one-time pairing** (agent + connection mode required first)
- Short-lived **15-minute** agent session TTL
- Explicit capability allowlist (no wildcards)
- Proposals remain for strategy / Next Move
- Optional **drafts-only** import for `CONTENT_OPERATOR` sessions
- Human operator retains final control; **APPROVED ≠ PUBLISHED**

## Pairing UI states (truthful)

| State | Meaning |
|-------|---------|
| `DISABLED` | Bridge env flag off |
| `READY` | Enabled; no waiting credential; no session |
| `WAITING_FOR_AGENT` | One-time credential created; unused; waiting for handshake |
| `CONNECTED` | Handshake succeeded; session active |
| `REMOTE_TRANSPORT_REQUIRED` | Operator chose remote agent; no credential issued |
| `CANCELLED` / `EXPIRED` / `FAILED` | Terminal pairing outcomes |

Do **not** label an unused credential as “Pairing active.” Use **WAITING FOR AGENT**.

## Connection wizard (Settings → Agents)

1. Choose agent — MR ENTREPRENEUR · MR POST · Other trusted agent  
2. Role — Campaign Strategist / Content Operator / Trusted Analyst  
3. Permissions — plain-English allow / deny  
4. Connection mode — Local test client **or** Remote agent  
5. Only then create a temporary pairing credential (local mode only)

Compact **Team** roster shows MR ENTREPRENEUR / MR POST as CONNECTED or DISCONNECTED.

## Temporary certification pairing (local only)

When a local credential is shown:

1. Open the intended **local** test client / agent process.  
2. Open the secure Secrets field (never normal chat).  
3. Copy the credential.  
4. Paste into `REGENELUXE_PAIRING_CREDENTIAL`.  
5. Return to Settings → Agents. Status stays **WAITING FOR AGENT** until handshake.  
6. On success: credential is hidden; agent shows **CONNECTED**.

Credential metadata shown: expires countdown · used · agent · workspace · role.

## Security

- Pairing / session plaintext never persisted, never logged, never returned after first disclosure.
- Cancel / supersede destroys the credential hash.
- Exposed credentials must be cancelled and never reused.
- Wrong agent / wrong role / unknown capabilities / replay → denied.
- Local Host / loopback Origin / no cross-site — fail closed.

## Role capabilities

Marketing team roles:

- **MR ENTREPRENEUR** (`CAMPAIGN_STRATEGIST`) — campaign strategy, rollout, timing; proposals by default
- **MR POST** (`CONTENT_OPERATOR`) — may receive draft capabilities explicitly at pairing
- **REGENELUXE** — authoritative hub
- **HUMAN OPERATOR** — final authority

Still denied: publish, schedule-directly, approve, change account, provider write, bypass approval, OAuth, secrets, filesystem, process control.

## Enablement (local only)

```bash
EXTERNAL_AGENT_BRIDGE_ENABLED=1
```

Restart required after env change. Do not expose this instance publicly.

## Endpoints

All under `http://localhost:5174/api/external-agent/…`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/handshake` | none | Readiness / bridge state |
| POST | `/handshake` | one-time pairing credential | Consume pairing; return session token once |
| GET | `/capabilities` | session | Allowed / denied surface |
| GET | `/north-star` | session | Product identity |
| GET | `/context` | session | Sanitized workspace summary |
| GET | `/operations` | session | Operational counts |
| GET/POST | `/proposals` | session | List / submit proposals |
| GET/POST | `/drafts` | draft capabilities | List own drafts / create draft |
| GET/PATCH | `/drafts/:id` | draft capabilities | Status / update own draft |
| POST | `/drafts/:id/submit` | `SUBMIT_CONTENT_FOR_APPROVAL` | Submit for operator review |
| GET/DELETE | `/session` | session | Inspect / end session |
| POST | `/control` | session | Explicit deny + audit |
| GET/POST | `/operator` | signed-in operator | Status, start/cancel pairing, revoke, review proposals |

Operator `start_pairing` body requires:

- `agentKey` — `mr_entrepreneur` | `mr_post` | `other`
- `connectionMode` — `LOCAL_TEST_CLIENT` | `REMOTE_AGENT`

Agent headers:

- `x-regeneluxe-agent-pairing: <one-time pairing credential>` (handshake only)
- `x-regeneluxe-agent-session: <sessionToken from handshake>`

## Certification

Local test-client path: `node scripts/e2e-external-agent-pairing.mjs`

Remote Grok connectivity remains **not available** until a secure rendezvous/relay is approved and built.

## Ownership

Port `5174` remains ReGeneLuxe-owned. This bridge does not bind another port, open a tunnel, or touch Investools.
