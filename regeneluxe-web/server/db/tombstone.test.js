import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTestClients } from "./client.js";

process.env.RL_DB_MODE = "memory";

const {
  initDb,
  resetDbForTests,
  migrate,
  upsert,
  get,
  list,
  remove,
  getLocalClient,
  pushOutboxToRemote,
  pullRemoteToLocal,
  getSyncStatus,
  COLLECTIONS,
} = await import("./index.js");
const { resetRemoteProbeCache } = await import("./sync.js");

function fileClient(dir, name) {
  const path = join(dir, name);
  expect(path).not.toContain(`${join(".regeneluxe", "local.db")}`);
  return { path, client: createClient({ url: `file:${path}` }) };
}

async function remoteRow(remote, collection, id) {
  const result = await remote.execute({
    sql: "SELECT * FROM entities WHERE collection = ? AND id = ?",
    args: [collection, id],
  });
  return result.rows[0] || null;
}

async function writeRemote(remote, { collection, id, revision, updatedAt, deletedAt = null, payload }) {
  const now = updatedAt || "2026-01-01T00:00:00.000Z";
  await remote.execute({
    sql: `INSERT INTO entities (
      collection, id, payload, created_at, updated_at, schema_version, revision, sync_status, deleted_at
    ) VALUES (?, ?, ?, ?, ?, 1, ?, 'SYNCED', ?)
    ON CONFLICT(collection, id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at,
      revision = excluded.revision,
      sync_status = 'SYNCED',
      deleted_at = excluded.deleted_at`,
    args: [collection, id, JSON.stringify({ id, ...payload }), now, now, revision, deletedAt],
  });
}

async function outboxFor(id) {
  const result = await getLocalClient().execute({
    sql: "SELECT op, state, idempotency_key, payload FROM outbox WHERE record_id = ? ORDER BY created_at ASC",
    args: [id],
  });
  return result.rows;
}

describe("durable tombstones", () => {
  beforeEach(async () => {
    process.env.RL_DB_MODE = "memory";
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    await resetDbForTests();
    await initDb();
    resetRemoteProbeCache();
  });

  afterEach(async () => {
    process.env.RL_DB_MODE = "memory";
    await resetDbForTests();
  });

  async function useRemote() {
    const dir = mkdtempSync(join(tmpdir(), "rl-tomb-"));
    const remote = fileClient(dir, "remote.db");
    setTestClients({ remote: remote.client });
    await migrate(remote.client);
    resetRemoteProbeCache();
    return remote.client;
  }

  it("keeps a deleted account deleted across push, stale remote live copy, and reopen", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rl-tomb-local-"));
    const local = fileClient(dir, "local.db");
    const remoteFile = fileClient(dir, "remote.db");
    setTestClients({ local: local.client, remote: remoteFile.client });
    await migrate(local.client);
    await migrate(remoteFile.client);
    resetRemoteProbeCache();

    await upsert(COLLECTIONS.accounts, {
      id: "acc_synth",
      platform: "YouTube",
      displayName: "Synthetic",
      managedProfileId: "ws_a",
      accessToken: "must-not-sync",
    });
    const pushedLive = await pushOutboxToRemote();
    expect(pushedLive.pushed).toBe(1);
    expect((await remoteRow(remoteFile.client, COLLECTIONS.accounts, "acc_synth")).deleted_at).toBeFalsy();

    const deleted = await remove(COLLECTIONS.accounts, "acc_synth");
    expect(deleted.deletedAt).toBeTruthy();
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
    expect((await get(COLLECTIONS.accounts, "acc_synth")).deletedAt).toBe(deleted.deletedAt);

    const queued = await outboxFor("acc_synth");
    const deletes = queued.filter((row) => row.op === "DELETE");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].state).toBe("PENDING");
    expect(JSON.parse(deletes[0].payload)).toEqual({
      id: "acc_synth",
      managedProfileId: "ws_a",
      deletedAt: deleted.deletedAt,
    });
    expect(queued.some((row) => row.op === "UPSERT" && row.state === "PENDING")).toBe(false);

    const pushedDelete = await pushOutboxToRemote();
    expect(pushedDelete.pushed).toBe(1);
    const remoteTombstone = await remoteRow(remoteFile.client, COLLECTIONS.accounts, "acc_synth");
    expect(remoteTombstone.deleted_at).toBeTruthy();
    expect(JSON.parse(remoteTombstone.payload).accessToken).toBeUndefined();
    expect((await outboxFor("acc_synth")).find((row) => row.op === "DELETE").state).toBe("DONE");

    const whileTombstoned = await pullRemoteToLocal();
    expect(whileTombstoned.conflicts).toBe(0);
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);

    await writeRemote(remoteFile.client, {
      collection: COLLECTIONS.accounts,
      id: "acc_synth",
      revision: 9,
      updatedAt: "2026-04-01T00:00:00.000Z",
      payload: { displayName: "Synthetic", managedProfileId: "ws_a" },
    });
    await pullRemoteToLocal();
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
    expect((await get(COLLECTIONS.accounts, "acc_synth")).deletedAt).toBeTruthy();

    local.client.close();
    const reopened = createClient({ url: `file:${local.path}` });
    setTestClients({ local: reopened, remote: remoteFile.client });
    resetRemoteProbeCache();
    await pullRemoteToLocal();
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
    expect((await get(COLLECTIONS.accounts, "acc_synth")).deletedAt).toBeTruthy();
    const status = await getSyncStatus({ fresh: true });
    expect(status.pendingOutbox).toBe(0);
    expect(status.state).toBe("SYNCED");
  });

  it("inserts a remote tombstone when the remote row is missing, then ignores a later live copy", async () => {
    const remote = await useRemote();
    await upsert(COLLECTIONS.accounts, {
      id: "acc_missing",
      platform: "YouTube",
      displayName: "Missing remote",
      managedProfileId: "ws_a",
    });
    await remove(COLLECTIONS.accounts, "acc_missing");
    expect(await remoteRow(remote, COLLECTIONS.accounts, "acc_missing")).toBeNull();

    const pushed = await pushOutboxToRemote();
    expect(pushed.pushed).toBe(1);
    const tombstone = await remoteRow(remote, COLLECTIONS.accounts, "acc_missing");
    expect(tombstone.deleted_at).toBeTruthy();
    expect((await outboxFor("acc_missing")).find((row) => row.op === "DELETE").state).toBe("DONE");

    await writeRemote(remote, {
      collection: COLLECTIONS.accounts,
      id: "acc_missing",
      revision: 8,
      updatedAt: "2026-05-01T00:00:00.000Z",
      payload: { displayName: "stale live", managedProfileId: "ws_a" },
    });
    await pullRemoteToLocal();
    await pullRemoteToLocal();
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
    expect((await get(COLLECTIONS.accounts, "acc_missing")).deletedAt).toBeTruthy();
  });

  it("does not let an older, equal, or newer remote live row clear a local tombstone", async () => {
    const remote = await useRemote();
    const cases = [
      { id: "acc_older", revision: 1, updatedAt: "2020-01-01T00:00:00.000Z" },
      { id: "acc_equal", revision: 2, updatedAt: "2026-02-01T00:00:00.000Z" },
      { id: "acc_newer", revision: 7, updatedAt: "2026-06-01T00:00:00.000Z" },
    ];
    for (const item of cases) {
      await upsert(COLLECTIONS.accounts, {
        id: item.id,
        platform: "YouTube",
        displayName: item.id,
        managedProfileId: "ws_a",
      });
      await remove(COLLECTIONS.accounts, item.id);
      await writeRemote(remote, {
        collection: COLLECTIONS.accounts,
        id: item.id,
        revision: item.revision,
        updatedAt: item.updatedAt,
        payload: { displayName: item.id, managedProfileId: "ws_a" },
      });
    }

    await pullRemoteToLocal();
    for (const item of cases) {
      expect(await list(COLLECTIONS.accounts)).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: item.id })]),
      );
      expect((await get(COLLECTIONS.accounts, item.id)).deletedAt).toBeTruthy();
    }
  });

  it("keeps a newer local live row when the remote tombstone is older", async () => {
    const remote = await useRemote();
    await upsert(COLLECTIONS.accounts, {
      id: "acc_local_newer",
      platform: "YouTube",
      displayName: "Edited after",
      managedProfileId: "ws_a",
    });
    const edited = await upsert(COLLECTIONS.accounts, {
      id: "acc_local_newer",
      platform: "YouTube",
      displayName: "Edited after",
      managedProfileId: "ws_a",
    });
    expect(edited.revision).toBe(2);
    await writeRemote(remote, {
      collection: COLLECTIONS.accounts,
      id: "acc_local_newer",
      revision: 1,
      updatedAt: "2020-01-01T00:00:00.000Z",
      deletedAt: "2020-01-01T00:00:00.000Z",
      payload: { displayName: "Old", managedProfileId: "ws_a" },
    });
    const pulled = await pullRemoteToLocal();
    expect(pulled.conflicts).toBeGreaterThan(0);
    expect((await get(COLLECTIONS.accounts, "acc_local_newer")).deletedAt).toBeFalsy();
    expect(await list(COLLECTIONS.accounts)).toEqual([
      expect.objectContaining({ id: "acc_local_newer", displayName: "Edited after" }),
    ]);
  });

  it("applies a newer remote tombstone onto a local live row", async () => {
    const remote = await useRemote();
    await upsert(COLLECTIONS.accounts, {
      id: "acc_remote_delete",
      platform: "YouTube",
      displayName: "Still here",
      managedProfileId: "ws_a",
    });
    await writeRemote(remote, {
      collection: COLLECTIONS.accounts,
      id: "acc_remote_delete",
      revision: 4,
      updatedAt: "2026-03-02T00:00:00.000Z",
      deletedAt: "2026-03-02T00:00:00.000Z",
      payload: { displayName: "Still here", managedProfileId: "ws_a" },
    });

    const pulled = await pullRemoteToLocal();
    expect(pulled.pulled).toBeGreaterThan(0);
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
    expect((await get(COLLECTIONS.accounts, "acc_remote_delete")).deletedAt).toBe("2026-03-02T00:00:00.000Z");

    const pushed = await pushOutboxToRemote();
    expect(pushed.pushed).toBe(0);
    expect((await remoteRow(remote, COLLECTIONS.accounts, "acc_remote_delete")).deleted_at).toBeTruthy();
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
  });

  it("keeps the same delete contract for a second collection", async () => {
    const remote = await useRemote();
    await upsert(COLLECTIONS.campaigns, {
      id: "camp_synth",
      name: "Synthetic campaign",
      managedProfileId: "ws_a",
    });
    await pushOutboxToRemote();
    await remove(COLLECTIONS.campaigns, "camp_synth");
    expect(await list(COLLECTIONS.campaigns)).toHaveLength(0);
    await pushOutboxToRemote();
    expect((await remoteRow(remote, COLLECTIONS.campaigns, "camp_synth")).deleted_at).toBeTruthy();

    await writeRemote(remote, {
      collection: COLLECTIONS.campaigns,
      id: "camp_synth",
      revision: 6,
      updatedAt: "2026-07-01T00:00:00.000Z",
      payload: { name: "Synthetic campaign", managedProfileId: "ws_a" },
    });
    await pullRemoteToLocal();
    expect(await list(COLLECTIONS.campaigns)).toHaveLength(0);
    expect((await get(COLLECTIONS.campaigns, "camp_synth")).deletedAt).toBeTruthy();
  });

  it("does not apply a tombstone across workspaces", async () => {
    const remote = await useRemote();
    await upsert(COLLECTIONS.accounts, {
      id: "acc_ws_a",
      platform: "YouTube",
      displayName: "A",
      managedProfileId: "ws_a",
    });
    await upsert(COLLECTIONS.accounts, {
      id: "acc_ws_b",
      platform: "YouTube",
      displayName: "B",
      managedProfileId: "ws_b",
    });
    await remove(COLLECTIONS.accounts, "acc_ws_a");
    await pushOutboxToRemote();

    const remoteB = await remoteRow(remote, COLLECTIONS.accounts, "acc_ws_b");
    expect(remoteB.deleted_at).toBeFalsy();
    expect(await list(COLLECTIONS.accounts)).toEqual([
      expect.objectContaining({ id: "acc_ws_b", managedProfileId: "ws_b" }),
    ]);

    await writeRemote(remote, {
      collection: COLLECTIONS.accounts,
      id: "acc_ws_b",
      revision: 9,
      updatedAt: "2026-08-01T00:00:00.000Z",
      deletedAt: "2026-08-01T00:00:00.000Z",
      payload: { displayName: "B", managedProfileId: "ws_a" },
    });
    await pullRemoteToLocal();
    expect((await get(COLLECTIONS.accounts, "acc_ws_b")).deletedAt).toBeFalsy();
    expect((await get(COLLECTIONS.accounts, "acc_ws_a")).deletedAt).toBeTruthy();
  });

  it("stays deleted through repeated local deletes, pushes, and pulls", async () => {
    const remote = await useRemote();
    await upsert(COLLECTIONS.accounts, {
      id: "acc_twice",
      platform: "YouTube",
      displayName: "Twice",
      managedProfileId: "ws_a",
    });
    const first = await remove(COLLECTIONS.accounts, "acc_twice");
    const second = await remove(COLLECTIONS.accounts, "acc_twice");
    expect(second.deletedAt).toBe(first.deletedAt);
    expect(second.revision).toBe(first.revision);
    expect((await outboxFor("acc_twice")).filter((row) => row.op === "DELETE")).toHaveLength(1);

    await pushOutboxToRemote();
    await pushOutboxToRemote();
    expect((await remoteRow(remote, COLLECTIONS.accounts, "acc_twice")).deleted_at).toBeTruthy();
    await pullRemoteToLocal();
    await pullRemoteToLocal();
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);

    const again = await upsert(COLLECTIONS.accounts, {
      id: "acc_twice",
      platform: "YouTube",
      displayName: "Twice",
      managedProfileId: "ws_a",
    });
    expect(again.deletedAt).toBeTruthy();
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
  });

  it("keeps a local delete while the cloud is unavailable and retries without a second delete", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rl-tomb-down-"));
    const real = fileClient(dir, "remote.db");
    await migrate(real.client);
    let failWrites = true;
    const remote = {
      execute: async (statement) => {
        const sql = typeof statement === "string" ? statement : statement.sql;
        if (failWrites && /INSERT INTO entities|UPDATE entities/i.test(sql)) {
          throw new Error("turso down");
        }
        return real.client.execute(statement);
      },
      close: () => real.client.close(),
    };
    setTestClients({ remote });
    resetRemoteProbeCache();

    await upsert(COLLECTIONS.accounts, {
      id: "acc_offline",
      platform: "YouTube",
      displayName: "Offline",
      managedProfileId: "ws_a",
    });
    await remove(COLLECTIONS.accounts, "acc_offline");
    const failed = await pushOutboxToRemote();
    expect(failed.errors).toBe(1);
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
    expect((await get(COLLECTIONS.accounts, "acc_offline")).deletedAt).toBeTruthy();
    expect((await outboxFor("acc_offline")).find((row) => row.op === "DELETE").state).toBe("ERROR");
    expect(await remoteRow(real.client, COLLECTIONS.accounts, "acc_offline")).toBeNull();

    failWrites = false;
    await getLocalClient().execute({
      sql: "UPDATE outbox SET next_attempt_at = ? WHERE record_id = ? AND op = 'DELETE'",
      args: ["2000-01-01T00:00:00.000Z", "acc_offline"],
    });
    const retried = await pushOutboxToRemote();
    expect(retried.pushed).toBe(1);
    expect((await outboxFor("acc_offline")).filter((row) => row.op === "DELETE")).toHaveLength(1);
    expect((await remoteRow(real.client, COLLECTIONS.accounts, "acc_offline")).deleted_at).toBeTruthy();
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
    const status = await getSyncStatus({ fresh: true });
    expect(status.pendingOutbox).toBe(0);
    expect(status.state).toBe("SYNCED");
  });

  it("leaves the local tombstone pending when there is no remote", async () => {
    await upsert(COLLECTIONS.accounts, {
      id: "acc_local_only",
      platform: "YouTube",
      displayName: "Local",
      managedProfileId: "ws_a",
    });
    await remove(COLLECTIONS.accounts, "acc_local_only");
    const pushed = await pushOutboxToRemote();
    expect(pushed.skipped).toBe(true);
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
    expect((await get(COLLECTIONS.accounts, "acc_local_only")).deletedAt).toBeTruthy();
    expect((await outboxFor("acc_local_only")).find((row) => row.op === "DELETE").state).toBe("PENDING");
  });
});
