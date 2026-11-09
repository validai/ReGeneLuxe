# External Agent Bridge (V1)

Prepares ReGeneLuxe for a future handshake with a dedicated ReGeneLuxe GrokBot.

This is **not** a live Grok connection.
This is **not** a public exposure.
This is **not** a standing Grok pairing password.
This is **not** permission for an external AI to operate ReGeneLuxe.

## Architecture

- Provider-neutral trusted analyst bridge
- Disabled by default
- Local-only (ReGeneLuxe on port `5174`)
- Operator-initiated **one-time pairing**
- Short-lived **15-minute** agent session
- Explicit capability allowlist (no wildcards)
- Proposal-only write surface (never auto-executed)
- Human operator retains final control

`EXTERNAL_AGENT_BRIDGE_ENABLED=1` means only:

> This local ReGeneLuxe instance permits operator-initiated external-agent pairing.

It does **not** pair an agent automatically, generate a standing credential, contact an AI provider, or expose the bridge publicly.

There is **no** `EXTERNAL_AGENT_BRIDGE_SECRET` in the normal pairing model. Pairing uses a one-time credential created by a signed-in operator.

## Role

Trusted analyst / product collaborator.

The agent may:

1. complete operator-initiated pairing once;
2. open a short-lived local session;
3. learn the ReGeneLuxe North Star;
4. receive sanitized workspace and product context;
5. read operational summaries;
6. submit recommendations/proposals;
7. leave an auditable history of what it read or proposed.

The agent may **not**:

- publish, schedule, reply, or DM;
- change social connections or OAuth scopes;
- access provider tokens or secrets;
- modify campaigns, content, accounts, queue, analytics, inbox, files, or environment variables;
- execute proposals or bypass approval;
- manage processes, restart ReGeneLuxe, or run shell commands;
- inspect the filesystem or other projects (including Investools);
- refresh its own session (pair again after expiry).

## North Star (canonical)

ReGeneLuxe is a private AI campaign and relationship command center for creators and artist brands.

Its job is to reduce the manual work required to operate and grow one creator/artist brand across multiple social networks.

Loop:

`SOURCE → PLAN → ADAPT → APPROVE → DISTRIBUTE → ENGAGE → OBSERVE → LEARN → NEXT MOVE`

Operating statement:

Create once → intelligently distribute → efficiently network → learn → make the next move better.

Human operator retains final control.

## Enablement (local only)

Disabled by default. To allow pairing on this machine, set in `.env.local` (never commit):

```bash
EXTERNAL_AGENT_BRIDGE_ENABLED=1
```

A process restart is required after changing env. Do not expose this instance publicly.

## Future pairing steps (do not run a live Grok handshake yet)

1. Ensure ReGeneLuxe is running locally on `5174` with `EXTERNAL_AGENT_BRIDGE_ENABLED=1`.
2. Sign in as the ReGeneLuxe operator.
3. Open **Settings → External Agent Bridge**.
4. Click **Start pairing**.
5. Copy the one-time pairing credential shown once (hash stored only; ~10 minute expiry; single use).
6. Have the trusted agent present:
   - pairing credential
   - `agentType`
   - `displayName`
   - `instanceId`
   - `protocolVersion` (`1`)
   - `requestedCapabilities` (allowlisted only)
7. Agent `POST /api/external-agent/handshake` on localhost:5174.
8. Server validates capabilities, consumes the pairing, returns a **15-minute** session token once.
9. Agent uses `x-regeneluxe-agent-session` for read/propose calls until expiry or revoke.
10. Operator reviews proposals in Settings. **Accept** records agreement only — it does not execute.

## Allowed capabilities

- `READ_PRODUCT_CONTEXT`
- `READ_WORKSPACE_SUMMARY`
- `READ_ACCOUNT_METADATA`
- `READ_CAMPAIGN_SUMMARY`
- `READ_CONTENT_METADATA`
- `READ_ANALYTICS_SUMMARY`
- `READ_INBOX_SUMMARY`
- `READ_OPERATIONAL_HEALTH`
- `SUBMIT_PROPOSAL`

Unknown capabilities are denied.

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
| GET/DELETE | `/session` | session | Inspect / end session |
| POST | `/control` | session | Explicit deny + audit |
| GET/POST | `/operator` | signed-in operator | Status, start/cancel pairing, revoke, review proposals |

Agent headers:

- `x-regeneluxe-agent-pairing: <one-time pairing credential>` (handshake only; body field `pairingCredential` also accepted)
- `x-regeneluxe-agent-session: <sessionToken from handshake>`

## Privacy notes

- Analytics are evidence-only MetricSnapshots. Missing values stay `null`. Facts stay separate from interpretation.
- Inbox V1 is summary counts only. Full DM/message bodies are not exposed.
- Pairing and session plaintext are never persisted, never logged, and never returned again after first disclosure.

## Storage

Pairings, sessions, proposals, and audit entries live in the server secrets store under `externalAgent`.
Credentials and session tokens are stored hashed. Provider tokens and env secrets are never returned.

## Ownership

Port `5174` remains ReGeneLuxe-owned. This bridge does not bind another port, open a tunnel, or touch Investools.
