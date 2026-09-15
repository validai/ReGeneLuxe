import { NextResponse } from "next/server";
import {
  COLLECTIONS,
  initDb,
  replaceAll,
  setMeta,
  upsert,
  remove,
  list,
} from "../../../../server/db/index.js";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(Object.values(COLLECTIONS));

export async function GET(request: Request) {
  try {
    await initDb();
    const url = new URL(request.url);
    const collection = String(url.searchParams.get("collection") || "");
    if (!ALLOWED.has(collection)) {
      return NextResponse.json({ ok: false, error: "Unknown collection" }, { status: 400 });
    }
    const records = await list(collection);
    return NextResponse.json({ ok: true, collection, records });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

/** Single-record upsert (enqueues outbox) or meta update. */
export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();

    if (body.meta && typeof body.meta === "object") {
      for (const [key, value] of Object.entries(body.meta)) {
        await setMeta(key, value == null ? null : String(value));
      }
      return NextResponse.json({ ok: true });
    }

    const collection = String(body.collection || "");
    if (!ALLOWED.has(collection)) {
      return NextResponse.json({ ok: false, error: "Unknown collection" }, { status: 400 });
    }

    if (body.record && body.record.id) {
      const saved = await upsert(collection, body.record);
      return NextResponse.json({ ok: true, record: saved });
    }

    if (collection === COLLECTIONS.settings && body.record) {
      const saved = await upsert(collection, { id: "app", ...body.record });
      return NextResponse.json({ ok: true, record: saved });
    }

    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    const collection = String(body.collection || "");
    const id = String(body.id || "");
    if (!ALLOWED.has(collection) || !id) {
      return NextResponse.json({ ok: false, error: "collection and id required" }, { status: 400 });
    }
    await remove(collection, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

/**
 * Bulk replace — migration / controlled import only.
 * Does not enqueue outbox (use seedOutbox afterward if cloud seed needed).
 */
export async function PUT(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const collection = String(body.collection || "");
    if (!ALLOWED.has(collection)) {
      return NextResponse.json({ ok: false, error: "Unknown collection" }, { status: 400 });
    }

    if (Array.isArray(body.records)) {
      await replaceAll(collection, body.records);
      return NextResponse.json({ ok: true, count: body.records.length });
    }

    if (body.record && body.record.id) {
      const saved = await upsert(collection, body.record);
      return NextResponse.json({ ok: true, record: saved });
    }

    if (body.meta && typeof body.meta === "object") {
      for (const [key, value] of Object.entries(body.meta)) {
        await setMeta(key, value == null ? null : String(value));
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
