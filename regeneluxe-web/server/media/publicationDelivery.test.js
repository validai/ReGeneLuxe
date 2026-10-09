import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyMediaUrl } from "../../src/data/mediaReadiness.js";
import { buildPublishApproval, explainApprovalRejection, publishFingerprint, variantForAccount } from "../../src/data/publishApproval.js";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-pub-sec-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-pub-key-")), "key");

const { initDb, resetDbForTests, upsert, get, list, COLLECTIONS, enqueueJob, JOB_TYPES } = await import("../db/index.js");
const { processJobQueue } = await import("../jobs/worker.js");
const { setAccountTokens } = await import("../secrets/providers.js");
const { savePublicationImageBuffer, readPublicationImage, inspectPublicationImage } = await import("./store.js");
const {
  publicationObjectKey,
  preparePublicationMedia,
  markPublicationDeliveryEligible,
  cleanupDuePublicationMedia,
} = await import("./publicationDelivery.js");
const {
  createMemoryMediaProvider,
  createVercelBlobProvider,
  publicMediaReadiness,
  setPublicMediaProviderForTests,
} = await import("./publicProvider.js");

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function jpegBytes() {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01, 0x03, 0x00, 0x00, 0x00,
    0xff, 0xd9,
  ]);
}

describe("publication image eligibility", () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rl-pub-media-"));
    process.env.RL_MEDIA_DIR = dir;
  });
  afterEach(() => {
    delete process.env.RL_MEDIA_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it("accepts a real PNG or JPEG and rejects everything else", async () => {
    expect(inspectPublicationImage(PNG).mimeType).toBe("image/png");
    expect(inspectPublicationImage(jpegBytes()).mimeType).toBe("image/jpeg");
    await expect(savePublicationImageBuffer({ buffer: Buffer.alloc(0), managedProfileId: "prf_a" })).rejects.toMatchObject({ code: "MEDIA_INVALID" });
    await expect(savePublicationImageBuffer({ buffer: Buffer.from("<html></html>"), managedProfileId: "prf_a" })).rejects.toMatchObject({ code: "MEDIA_INVALID" });
    await expect(savePublicationImageBuffer({ buffer: Buffer.from("<svg></svg>"), managedProfileId: "prf_a" })).rejects.toMatchObject({ code: "MEDIA_INVALID" });
  });

  it("keeps publication bytes inside the workspace and the media root", async () => {
    const saved = await savePublicationImageBuffer({ buffer: PNG, managedProfileId: "prf_a" });
    expect(readPublicationImage(saved.id, { workspaceId: "prf_b" })).toBeNull();
    expect(readPublicationImage("../etc/passwd", { workspaceId: "prf_a" })).toBeNull();
    expect(readPublicationImage(`${saved.id}/../../outside`, { workspaceId: "prf_a" })).toBeNull();
    const outside = join(tmpdir(), `outside-${Date.now()}.png`);
    writeFileSync(outside, PNG);
    rmSync(join(dir, `${saved.id}.png`));
    symlinkSync(outside, join(dir, `${saved.id}.png`));
    expect(readPublicationImage(saved.id, { workspaceId: "prf_a" })).toBeNull();
    rmSync(outside, { force: true });
  });
});

describe("public media delivery", () => {
  let dir;
  let provider;
  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "rl-pub-delivery-"));
    process.env.RL_MEDIA_DIR = dir;
    delete process.env.PUBLIC_MEDIA_PROVIDER;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    provider = createMemoryMediaProvider();
    setPublicMediaProviderForTests(provider);
    await resetDbForTests();
    await initDb();
  });
  afterEach(() => {
    setPublicMediaProviderForTests(null);
    delete process.env.RL_MEDIA_DIR;
    delete process.env.PUBLIC_MEDIA_PROVIDER;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    rmSync(dir, { recursive: true, force: true });
  });

  it("reports delivery readiness without exposing a storage token", () => {
    setPublicMediaProviderForTests(null);
    expect(publicMediaReadiness()).toEqual({ status: "NOT_CONFIGURED", provider: "" });
    process.env.PUBLIC_MEDIA_PROVIDER = "vercel_blob";
    expect(publicMediaReadiness().status).toBe("NOT_CONFIGURED");
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token-under-test";
    const ready = publicMediaReadiness();
    expect(ready).toEqual({ status: "READY", provider: "vercel_blob" });
    expect(JSON.stringify(ready)).not.toContain("blob-token-under-test");
  });

  it("uploads once to an unguessable https object and cleans it up", async () => {
    const saved = await savePublicationImageBuffer({ buffer: PNG, managedProfileId: "prf_a" });
    const key = publicationObjectKey({ workspaceId: "prf_a", id: "dlv_test", extension: "png" });
    expect(key.startsWith("regeneluxe-publication/")).toBe(true);
    expect(key).not.toContain("prf_a");
    expect(key).not.toContain("@");
    expect(key).not.toContain("caption");
    const first = await preparePublicationMedia({
      workspaceId: "prf_a",
      accountId: "acc_1",
      contentId: "cnt_1",
      mediaId: saved.id,
      idempotencyKey: "publish:cnt_1:acc_1:now",
    });
    expect(first.ok).toBe(true);
    expect(classifyMediaUrl(first.publicUrl)).toBe("PUBLIC_PROVIDER_MEDIA");
    expect(first.publicUrl.startsWith("https://")).toBe(true);
    const second = await preparePublicationMedia({
      workspaceId: "prf_a",
      accountId: "acc_1",
      contentId: "cnt_1",
      mediaId: saved.id,
      idempotencyKey: "publish:cnt_1:acc_1:now",
    });
    expect(second.reused).toBe(true);
    expect(second.deliveryId).toBe(first.deliveryId);
    expect(provider.objects.size).toBe(1);
    expect(JSON.stringify(await list(COLLECTIONS.publication_deliveries))).not.toContain("blob-token");
    await markPublicationDeliveryEligible(first.deliveryId, { outcome: "published", now: Date.parse("2026-10-09T00:00:00Z") });
    const early = await cleanupDuePublicationMedia({ now: Date.parse("2026-10-09T12:00:00Z"), provider, workspaceId: "prf_a" });
    expect(early.removed).toEqual([]);
    const otherWorkspace = await cleanupDuePublicationMedia({ now: Date.parse("2026-10-11T00:00:00Z"), provider, workspaceId: "prf_other" });
    expect(otherWorkspace.removed).toEqual([]);
    const cleaned = await cleanupDuePublicationMedia({ now: Date.parse("2026-10-11T00:00:00Z"), provider, workspaceId: "prf_a" });
    expect(cleaned.removed).toEqual([first.deliveryId]);
    expect(provider.objects.size).toBe(0);
    const again = await cleanupDuePublicationMedia({ now: Date.parse("2026-10-12T00:00:00Z"), provider });
    expect(again.removed).toEqual([]);
  });

  it("rejects a private upload URL before any record is kept", async () => {
    const saved = await savePublicationImageBuffer({ buffer: PNG, managedProfileId: "prf_a" });
    setPublicMediaProviderForTests({
      name: "memory",
      async prepare() {
        return { ok: true, publicUrl: "http://127.0.0.1/secret.jpg", objectKey: "local" };
      },
      async remove() {
        return { ok: true, alreadyGone: true };
      },
    });
    const result = await preparePublicationMedia({
      workspaceId: "prf_a",
      accountId: "acc_1",
      contentId: "cnt_1",
      mediaId: saved.id,
      idempotencyKey: "publish:private",
    });
    expect(result.code).toBe("MEDIA_NOT_PUBLIC");
    expect(await list(COLLECTIONS.publication_deliveries)).toHaveLength(0);
    for (const blocked of [
      "http://cdn.example/a.jpg",
      "https://localhost/a.jpg",
      "https://127.0.0.1/a.jpg",
      "https://[::1]/a.jpg",
      "https://10.0.0.4/a.jpg",
      "file:///tmp/a.jpg",
      "data:image/png;base64,aaaa",
      "blob:https://app.example/111",
    ]) {
      expect(classifyMediaUrl(blocked)).not.toBe("PUBLIC_PROVIDER_MEDIA");
    }
  });

  it("invalidates approval when the media, caption, or attempt changes", () => {
    const variant = { caption: "Exact caption", title: "", mediaId: "med_1", mediaRef: "" };
    const approval = buildPublishApproval({
      id: "apr_bind",
      operatorId: "opr_1",
      managedProfileId: "prf_a",
      contentId: "cnt_1",
      contentFingerprint: publishFingerprint(variant),
      provider: "instagram",
      accountId: "acc_1",
      externalDestinationId: "ig_1",
      mediaId: "med_1",
      mediaRef: "",
      idempotencyKey: "publish:cnt_1:acc_1:now",
    });
    const expected = {
      operatorId: "opr_1",
      managedProfileId: "prf_a",
      contentId: "cnt_1",
      contentFingerprint: publishFingerprint(variant),
      provider: "instagram",
      accountId: "acc_1",
      externalDestinationId: "ig_1",
      mediaId: "med_1",
      mediaRef: "",
      idempotencyKey: "publish:cnt_1:acc_1:now",
    };
    expect(explainApprovalRejection(approval, expected)).toBe("");
    expect(explainApprovalRejection(approval, {
      ...expected,
      contentFingerprint: publishFingerprint({ ...variant, caption: "Changed" }),
    })).toBe("APPROVAL_REVISION_MISMATCH");
    expect(explainApprovalRejection(approval, { ...expected, mediaId: "med_2" })).toBe("APPROVAL_MEDIA_MISMATCH");
    expect(explainApprovalRejection(approval, { ...expected, accountId: "acc_2" })).toBe("APPROVAL_ACCOUNT_MISMATCH");
    expect(explainApprovalRejection(approval, { ...expected, idempotencyKey: "publish:other" })).toBe("APPROVAL_ATTEMPT_MISMATCH");
  });

  it("uploads through the Vercel Blob contract without keeping the token", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: "https://store.public.blob.vercel-storage.com/regeneluxe-publication/a/b/c.jpg" }),
      })
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    const blob = createVercelBlobProvider({ token: "blob-token-under-test", fetchImpl });
    const uploaded = await blob.prepare({ objectKey: "regeneluxe-publication/abc/dlv/file.jpg", body: PNG, mimeType: "image/png" });
    expect(uploaded.publicUrl.startsWith("https://")).toBe(true);
    expect(JSON.stringify(uploaded)).not.toContain("blob-token-under-test");
    expect(fetchImpl.mock.calls[0][0].protocol).toBe("https:");
    expect(fetchImpl.mock.calls[0][1].headers["x-vercel-blob-access"]).toBe("public");
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe("Bearer blob-token-under-test");
    const removed = await blob.remove({ publicUrl: uploaded.publicUrl, objectKey: uploaded.objectKey });
    expect(removed.alreadyGone).toBe(true);
  });
});

describe("instagram publish uses one public image", () => {
  let dir;
  let provider;
  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "rl-pub-ig-"));
    process.env.RL_MEDIA_DIR = dir;
    provider = createMemoryMediaProvider();
    setPublicMediaProviderForTests(provider);
    await resetDbForTests();
    await initDb();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    setPublicMediaProviderForTests(null);
    delete process.env.RL_MEDIA_DIR;
    vi.unstubAllGlobals();
    rmSync(dir, { recursive: true, force: true });
  });

  it("sends the approved caption and https URL once, then keeps the object for cleanup", async () => {
    const saved = await savePublicationImageBuffer({ buffer: jpegBytes(), managedProfileId: "prf_1" });
    const account = {
      id: "acc_ig",
      platform: "Instagram",
      connectionState: "CONNECTED",
      providerAccountId: "ig_1",
      pageId: "page_1",
      managedProfileId: "prf_1",
      publishPermission: "APPROVAL_REQUIRED",
    };
    const content = {
      id: "cnt_img",
      campaignId: "cmp_1",
      caption: "Exact caption",
      mediaId: saved.id,
      status: "READY",
      managedProfileId: "prf_1",
    };
    const variant = variantForAccount(content, account);
    const approval = buildPublishApproval({
      id: "apr_img",
      operatorId: "opr_1",
      managedProfileId: "prf_1",
      contentId: content.id,
      contentFingerprint: publishFingerprint(variant),
      provider: "instagram",
      accountId: account.id,
      externalDestinationId: account.providerAccountId,
      mediaId: variant.mediaId,
      mediaRef: variant.mediaRef,
      idempotencyKey: "publish:cnt_img:acc_ig:now",
    });
    await upsert(COLLECTIONS.accounts, account);
    await upsert(COLLECTIONS.content, content);
    await upsert(COLLECTIONS.approvals, approval);
    setAccountTokens("instagram", account.id, {
      accessToken: "user-secret",
      pages: [{ id: "page_1", access_token: "page-secret", instagram_business_account: { id: "ig_1", username: "_djcoast" } }],
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "container_1" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: "FINISHED" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "media_9" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ permalink: "https://www.instagram.com/p/pilot" }) });
    const payload = {
      contentId: content.id,
      accountId: account.id,
      approvalId: approval.id,
      managedProfileId: "prf_1",
      operatorId: "opr_1",
      idempotencyKey: "publish:cnt_img:acc_ig:now",
    };
    await enqueueJob({ type: JOB_TYPES.PUBLISH_CONTENT, payload, idempotencyKey: payload.idempotencyKey });
    const first = await processJobQueue({ limit: 1, types: [JOB_TYPES.PUBLISH_CONTENT] });
    expect(first.results[0].ok).toBe(true);
    expect(first.results[0].result.providerPostId).toBe("media_9");
    const createBody = String(fetch.mock.calls[0][1].body);
    expect(createBody).toContain("caption=Exact+caption");
    expect(createBody).toContain("https%3A%2F%2Fmedia.test.example%2F");
    expect(provider.objects.size).toBe(1);
    const deliveries = await list(COLLECTIONS.publication_deliveries);
    expect(deliveries[0].cleanupStatus).toBe("eligible");
    expect(JSON.stringify(deliveries)).not.toContain("page-secret");
    expect(JSON.stringify(deliveries)).not.toContain("user-secret");
    const calls = fetch.mock.calls.length;
    await enqueueJob({ type: JOB_TYPES.PUBLISH_CONTENT, payload });
    const second = await processJobQueue({ limit: 1, types: [JOB_TYPES.PUBLISH_CONTENT] });
    expect(second.results[0].result.code).toBe("DUPLICATE_SUPPRESSED");
    expect(fetch.mock.calls.length).toBe(calls);
    expect(provider.objects.size).toBe(1);
    expect((await get(COLLECTIONS.approvals, approval.id)).consumedAt).toBeTruthy();
  });

  it("does not call Meta when the public upload fails", async () => {
    const saved = await savePublicationImageBuffer({ buffer: PNG, managedProfileId: "prf_1" });
    setPublicMediaProviderForTests({
      name: "memory",
      async prepare() {
        return { ok: false, code: "MEDIA_NOT_PUBLIC" };
      },
      async remove() {
        return { ok: true };
      },
    });
    const account = {
      id: "acc_ig",
      platform: "Instagram",
      connectionState: "CONNECTED",
      providerAccountId: "ig_1",
      managedProfileId: "prf_1",
      publishPermission: "APPROVAL_REQUIRED",
    };
    const content = {
      id: "cnt_fail",
      caption: "Exact caption",
      mediaId: saved.id,
      managedProfileId: "prf_1",
    };
    const variant = variantForAccount(content, account);
    const approval = buildPublishApproval({
      id: "apr_fail",
      operatorId: "opr_1",
      managedProfileId: "prf_1",
      contentId: content.id,
      contentFingerprint: publishFingerprint(variant),
      provider: "instagram",
      accountId: account.id,
      externalDestinationId: "ig_1",
      mediaId: variant.mediaId,
      mediaRef: variant.mediaRef,
    });
    await upsert(COLLECTIONS.accounts, account);
    await upsert(COLLECTIONS.content, content);
    await upsert(COLLECTIONS.approvals, approval);
    setAccountTokens("instagram", account.id, { accessToken: "user-secret", pages: [] });
    await enqueueJob({
      type: JOB_TYPES.PUBLISH_CONTENT,
      payload: {
        contentId: content.id,
        accountId: account.id,
        approvalId: approval.id,
        managedProfileId: "prf_1",
        operatorId: "opr_1",
        idempotencyKey: "publish:cnt_fail:acc_ig:now",
      },
    });
    const processed = await processJobQueue({ limit: 1, types: [JOB_TYPES.PUBLISH_CONTENT] });
    expect(processed.results[0].ok).toBe(false);
    expect(processed.results[0].error).toBe("MEDIA_NOT_PUBLIC");
    expect(fetch).not.toHaveBeenCalled();
    expect((await get(COLLECTIONS.approvals, approval.id)).consumedAt).toBeFalsy();
  });

  it("keeps the public object for cleanup when Meta rejects the container", async () => {
    const saved = await savePublicationImageBuffer({ buffer: PNG, managedProfileId: "prf_1" });
    const account = {
      id: "acc_ig",
      platform: "Instagram",
      connectionState: "CONNECTED",
      providerAccountId: "ig_1",
      managedProfileId: "prf_1",
      publishPermission: "APPROVAL_REQUIRED",
    };
    const content = { id: "cnt_box", caption: "Exact caption", mediaId: saved.id, managedProfileId: "prf_1" };
    const variant = variantForAccount(content, account);
    const approval = buildPublishApproval({
      id: "apr_box",
      operatorId: "opr_1",
      managedProfileId: "prf_1",
      contentId: content.id,
      contentFingerprint: publishFingerprint(variant),
      provider: "instagram",
      accountId: account.id,
      externalDestinationId: "ig_1",
      mediaId: variant.mediaId,
      mediaRef: variant.mediaRef,
    });
    await upsert(COLLECTIONS.accounts, account);
    await upsert(COLLECTIONS.content, content);
    await upsert(COLLECTIONS.approvals, approval);
    setAccountTokens("instagram", account.id, {
      accessToken: "user-secret",
      pages: [{ id: "page_1", access_token: "page-secret", instagram_business_account: { id: "ig_1" } }],
    });
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: "Could not download media", code: 9004 } }) });
    await enqueueJob({
      type: JOB_TYPES.PUBLISH_CONTENT,
      payload: {
        contentId: content.id,
        accountId: account.id,
        approvalId: approval.id,
        managedProfileId: "prf_1",
        operatorId: "opr_1",
        idempotencyKey: "publish:cnt_box:acc_ig:now",
      },
    });
    const processed = await processJobQueue({ limit: 1, types: [JOB_TYPES.PUBLISH_CONTENT] });
    expect(processed.results[0].ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    const delivery = (await list(COLLECTIONS.publication_deliveries))[0];
    expect(delivery.cleanupStatus).toBe("eligible");
    expect(delivery.removedAt).toBeNull();
    expect(provider.objects.size).toBe(1);
  });
});
