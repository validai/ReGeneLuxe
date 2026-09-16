# Profile Lane

Generic architecture. DJ Coast is **data** inside ManagedProfile, not a special type or route.

```
Operator
  └── ManagedProfile (1 → many)
        ├── Social accounts
        ├── Profile connections (Gmail / YouTube rails)
        ├── Campaigns
        ├── Content
        ├── Analytics (through related entities)
        ├── Inbox
        ├── Publishing / queue
        └── Campaign Brain history
```

## Fields

**Operator:** `id`, `googleSub` (unique), `email`, `emailVerified`, `name`, `avatarUrl`, `activeProfileId`, `createdAt`, `updatedAt`, `lastLoginAt` (UTC).

`activeProfileId` is a ManagedProfile id. It must never equal the operator id.

**ManagedProfile:** `id`, `ownerOperatorId`, `displayName`, `slug`, `status` (`ACTIVE` \| `INACTIVE`), `avatarUrl` (reference only), `avatarMediaId`, `primaryEmail`, `website` (nullable), `primaryPublicUrl`, `timezone`, `shortDescription`, `platforms`, timestamps.

- `website` may be null. Creators are not required to own a domain.
- `primaryPublicUrl` is independent (channel/hub URL, e.g. Coast Entertainment on YouTube).
- Profile images are PNG, JPG, or WebP. SVG is not supported.
- Canonical size limit is **500 × 1024 = 512,000 bytes** (`File.size` / raw buffer length). UI copy says 500 KB. Never compare base64 or data-URL length to this limit.
- Minimum edge is 256 × 256 pixels. Maximum edge is 4096 × 4096. 500 × 500 is valid.
- `avatarUrl` is a same-origin media reference (`/api/media/{id}`). Inline `data:` URLs are stripped and must not be stored on ManagedProfile rows or synced to Turso.

## Media storage

Local-first pilot: image bytes live under `.regeneluxe/media/` with a JSON sidecar. SQLite/Turso operational tables keep `avatarMediaId` + `avatarUrl` only. Object/cloud media can replace the local store later without changing the profile schema.

## First-profile migration

When an operator creates their **first** ManagedProfile:

1. Existing operational rows without `managedProfileId` are attached to that profile.
2. IDs and relationships are preserved.
3. Rows flagged `fixture: true`, `provenance` `TEST`/`FIXTURE`, or ids matching `test_` / `fixture_` / `vitest_` / `mock_` are **not** attached.

Settings, operators, and UI prefs stay unscoped.

## Client scoping

Repositories filter by `active_profile_id` once a profile is selected. Tests and backups pass `{ scoped: false }` to read everything. New writes stamp `managedProfileId` when an active profile exists.

## Sync

`operators`, `managed_profiles`, and `profile_connections` are mutable collections. Local writes enqueue the Turso outbox (`PENDING`). If cloud is unavailable, data stays local and retries on the next reconcile.
