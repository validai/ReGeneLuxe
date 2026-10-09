import { createHash, randomBytes } from "node:crypto";
import { classifyMediaUrl } from "../../src/data/mediaReadiness.js";
import { enqueueJob, list, upsert, COLLECTIONS, JOB_TYPES } from "../db/index.js";
import { readPublicationImage } from "./store.js";
import { resolvePublicMediaProvider } from "./publicProvider.js";

export const PUBLICATION_SUCCESS_GRACE_MS = 24 * 60 * 60 * 1000;
export const PUBLICATION_FAILURE_GRACE_MS = 2 * 60 * 60 * 1000;

function deliveryId() {
  return `dlv_${randomBytes(12).toString("hex")}`;
}

export function publicationObjectKey({ workspaceId, id, extension }) {
  const workspace = createHash("sha256").update(String(workspaceId || "")).digest("hex").slice(0, 16);
  const file = randomBytes(16).toString("hex");
  return `regeneluxe-publication/${workspace}/${id}/${file}.${extension}`;
}

function publicRecord(row) {
  return {
    deliveryId: row.id,
    mediaId: row.mediaId,
    publicUrl: row.publicUrl,
    expiresAt: row.expiresAt,
    provider: row.provider,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    objectKey: row.objectKey,
    cleanupStatus: row.cleanupStatus,
  };
}

export async function preparePublicationMedia({
  workspaceId,
  accountId,
  contentId,
  mediaId,
  purpose = "instagram_image",
  idempotencyKey = "",
  now = Date.now(),
  provider = resolvePublicMediaProvider(),
} = {}) {
  if (!provider) return { ok: false, code: "MEDIA_NOT_PUBLIC", error: "Public media delivery is not configured." };
  const media = readPublicationImage(mediaId, { workspaceId });
  if (!media) return { ok: false, code: "MEDIA_INVALID", error: "That image is not available for this workspace." };

  const existing = (await list(COLLECTIONS.publication_deliveries).catch(() => []))
    .filter((row) => row.idempotencyKey === idempotencyKey && row.mediaId === mediaId && !row.removedAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  if (existing && Date.parse(existing.expiresAt) > now && classifyMediaUrl(existing.publicUrl) === "PUBLIC_PROVIDER_MEDIA") {
    return { ok: true, reused: true, ...publicRecord(existing) };
  }

  const id = deliveryId();
  const extension = media.mimeType === "image/png" ? "png" : "jpg";
  const objectKey = publicationObjectKey({ workspaceId, id, extension });
  const uploaded = await provider.prepare({ objectKey, body: media.buffer, mimeType: media.mimeType });
  if (!uploaded.ok || classifyMediaUrl(uploaded.publicUrl) !== "PUBLIC_PROVIDER_MEDIA") {
    return { ok: false, code: "MEDIA_NOT_PUBLIC", error: "The media host did not return a public HTTPS URL." };
  }
  const createdAt = new Date(now).toISOString();
  const row = {
    id,
    workspaceId,
    contentId,
    accountId,
    mediaId,
    purpose,
    provider: provider.name,
    objectKey: uploaded.objectKey || objectKey,
    publicUrl: uploaded.publicUrl,
    mimeType: media.mimeType,
    sizeBytes: media.bytes,
    idempotencyKey,
    createdAt,
    expiresAt: new Date(now + PUBLICATION_SUCCESS_GRACE_MS).toISOString(),
    cleanupStatus: "active",
    cleanupEligibleAt: null,
    removedAt: null,
  };
  await upsert(COLLECTIONS.publication_deliveries, row);
  await enqueueJob({
    type: JOB_TYPES.CLEANUP_PUBLIC_MEDIA,
    payload: { deliveryId: id, workspaceId },
    scheduledAt: row.expiresAt,
    idempotencyKey: `cleanup_public_media:${id}`,
  });
  return { ok: true, reused: false, ...publicRecord(row) };
}

export async function markPublicationDeliveryEligible(deliveryIdValue, { outcome = "failed", now = Date.now() } = {}) {
  const rows = await list(COLLECTIONS.publication_deliveries);
  const row = rows.find((item) => item.id === deliveryIdValue);
  if (!row || row.removedAt) return null;
  const grace = outcome === "published" ? PUBLICATION_SUCCESS_GRACE_MS : PUBLICATION_FAILURE_GRACE_MS;
  const next = {
    ...row,
    cleanupStatus: "eligible",
    cleanupEligibleAt: new Date(now + grace).toISOString(),
  };
  await upsert(COLLECTIONS.publication_deliveries, next);
  return next;
}

export async function cleanupDuePublicationMedia({
  now = Date.now(),
  provider = resolvePublicMediaProvider(),
  workspaceId = "",
} = {}) {
  if (!provider) return { ok: false, code: "MEDIA_NOT_PUBLIC", removed: [] };
  const rows = await list(COLLECTIONS.publication_deliveries).catch(() => []);
  const due = rows.filter((row) => {
    if (row.removedAt) return false;
    if (workspaceId && row.workspaceId !== workspaceId) return false;
    const eligibleAt = Date.parse(row.cleanupEligibleAt || "");
    const expiresAt = Date.parse(row.expiresAt || "");
    return (Number.isFinite(eligibleAt) && eligibleAt <= now)
      || (Number.isFinite(expiresAt) && expiresAt <= now);
  });
  const removed = [];
  for (const row of due) {
    const result = await provider.remove({ objectKey: row.objectKey, publicUrl: row.publicUrl });
    if (!result.ok && !result.alreadyGone) continue;
    const next = {
      ...row,
      cleanupStatus: "removed",
      removedAt: new Date(now).toISOString(),
      publicUrl: "",
    };
    await upsert(COLLECTIONS.publication_deliveries, next);
    removed.push(row.id);
  }
  return { ok: true, removed };
}
