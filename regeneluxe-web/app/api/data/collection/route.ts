import {
  COLLECTIONS,
  initDb,
  replaceAll,
  setMeta,
  upsert,
  remove,
  list,
} from "../../../../server/db/index.js";
import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../../server/auth/apiGuard.js";
import {
  CLIENT_HIDDEN_COLLECTIONS,
  listWorkspaceCollection,
  recordBelongsToWorkspace,
  stampWorkspaceRecord,
  workspaceIdOf,
} from "../../../../server/auth/tenantScope.js";
import { isAllowedMetaKey, lockConnectionFields, lockIdentityFields, stripForbiddenWriteFields } from "../../../../server/auth/identityLock.js";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(Object.values(COLLECTIONS));

function denyHidden(collection: string) {
  return CLIENT_HIDDEN_COLLECTIONS.has(collection);
}

function prepareWrite(record: Record<string, unknown>, existing: Record<string, unknown> | null, authz: unknown) {
  const current = existing || null;
  const stripped = lockConnectionFields(
    lockIdentityFields(stripForbiddenWriteFields(record), current as object | null),
    current as object | null,
  );
  return stampWorkspaceRecord(stripped, authz);
}

async function writeAllowedMeta(meta: Record<string, unknown>) {
  for (const [key, value] of Object.entries(meta)) {
    if (!isAllowedMetaKey(key)) continue;
    await setMeta(key, value == null ? null : String(value));
  }
}

export async function GET(request: Request) {
  const authz = await requireWorkspaceApi(request);
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    const url = new URL(request.url);
    const collection = String(url.searchParams.get("collection") || "");
    if (!ALLOWED.has(collection) || denyHidden(collection)) {
      return jsonPrivate({ ok: false, error: "Unknown collection" }, 400);
    }
    const records = await listWorkspaceCollection(collection, authz);
    return jsonPrivate({ ok: true, collection, records });
  } catch {
    return jsonPrivate({ ok: false, error: "Could not load records." }, 500);
  }
}

export async function POST(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    const body = await request.json();

    if (body.meta && typeof body.meta === "object") {
      await writeAllowedMeta(body.meta);
      return jsonPrivate({ ok: true });
    }

    const collection = String(body.collection || "");
    if (!ALLOWED.has(collection) || denyHidden(collection) || collection === COLLECTIONS.operators) {
      return jsonPrivate({ ok: false, error: "Unknown collection" }, 400);
    }

    if (body.record && body.record.id) {
      const existing = (await list(collection)).find((row: { id?: string }) => row.id === body.record.id) || null;
      if (existing && !recordBelongsToWorkspace(existing, authz) && collection !== COLLECTIONS.settings) {
        return jsonPrivate({ ok: false, error: "Record not found." }, 404);
      }
      const saved = await upsert(collection, prepareWrite(body.record, existing, authz));
      return jsonPrivate({ ok: true, record: saved });
    }

    if (collection === COLLECTIONS.settings && body.record) {
      const saved = await upsert(collection, { id: "app", ...stripForbiddenWriteFields(body.record) });
      return jsonPrivate({ ok: true, record: saved });
    }

    return jsonPrivate({ ok: false, error: "Invalid payload" }, 400);
  } catch {
    return jsonPrivate({ ok: false, error: "Could not save record." }, 500);
  }
}

export async function DELETE(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    const collection = String(body.collection || "");
    const id = String(body.id || "");
    if (!ALLOWED.has(collection) || !id || denyHidden(collection) || collection === COLLECTIONS.operators) {
      return jsonPrivate({ ok: false, error: "collection and id required" }, 400);
    }
    const existing = (await list(collection)).find((row: { id?: string }) => row.id === id);
    if (existing && !recordBelongsToWorkspace(existing, authz) && collection !== COLLECTIONS.settings) {
      return jsonPrivate({ ok: false, error: "Record not found." }, 404);
    }
    await remove(collection, id);
    return jsonPrivate({ ok: true });
  } catch {
    return jsonPrivate({ ok: false, error: "Could not remove record." }, 500);
  }
}

export async function PUT(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    const body = await request.json();
    const collection = String(body.collection || "");
    if (!ALLOWED.has(collection) || denyHidden(collection) || collection === COLLECTIONS.operators) {
      return jsonPrivate({ ok: false, error: "Unknown collection" }, 400);
    }

    if (Array.isArray(body.records)) {
      const workspaceId = workspaceIdOf(authz);
      const existing = await list(collection);
      const byId = new Map<string, Record<string, unknown>>(
        existing.map((row: { id: string }) => [row.id, row as Record<string, unknown>]),
      );
      const incoming = body.records.map((row: Record<string, unknown>) => (
        prepareWrite(row, byId.get(String(row.id)) || null, authz)
      ));
      const others = existing.filter((row: { managedProfileId?: string }) => (
        row?.managedProfileId && row.managedProfileId !== workspaceId
      ));
      await replaceAll(collection, [...others, ...incoming]);
      return jsonPrivate({ ok: true, count: incoming.length });
    }

    if (body.record && body.record.id) {
      const existing = (await list(collection)).find((row: { id?: string }) => row.id === body.record.id) || null;
      if (existing && !recordBelongsToWorkspace(existing, authz) && collection !== COLLECTIONS.settings) {
        return jsonPrivate({ ok: false, error: "Record not found." }, 404);
      }
      const saved = await upsert(collection, prepareWrite(body.record, existing, authz));
      return jsonPrivate({ ok: true, record: saved });
    }

    if (body.meta && typeof body.meta === "object") {
      await writeAllowedMeta(body.meta);
      return jsonPrivate({ ok: true });
    }

    return jsonPrivate({ ok: false, error: "Invalid payload" }, 400);
  } catch {
    return jsonPrivate({ ok: false, error: "Could not update records." }, 500);
  }
}
