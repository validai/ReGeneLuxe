import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyMediaUrl } from "../../src/data/mediaReadiness.js";
import {
  buildPublishApproval,
  publishFingerprint,
  variantForAccount,
} from "../../src/data/publishApproval.js";
import { evaluatePublishGate } from "../../src/data/publishGate.js";
import { campaignPlatformResults } from "../../src/data/campaignPublishStatus.js";
import {
  destinationsForSurface,
  publicDestinationsFromPages,
  classifyMetaPublishFailure,
  publishFacebookPagePost,
  publishInstagramMedia,
  selectionFromVault,
} from "./providers/metaGraph.js";
import { uploadPrivateYouTube } from "./providers/youtubeUpload.js";

process.env.RL_DB_PATH = join(mkdtempSync(join(tmpdir(), "rl-pilot-")), "test.db");
process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-pilot-sec-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-pilot-key-")), "key");

const { initDb, resetDbForTests, upsert, get, list, COLLECTIONS, enqueueJob, JOB_TYPES } = await import("../db/index.js");
const { processJobQueue } = await import("../jobs/worker.js");
const { setAccountTokens } = await import("../secrets/providers.js");

const PAGES = [{
  id: "page_1",
  name: "Coast Page",
  tasks: ["CREATE_CONTENT"],
  access_token: "page-token-secret",
  instagram_business_account: { id: "ig_1", username: "djcoast" },
}, {
  id: "page_2",
  name: "Other Page",
  tasks: ["MODERATE"],
  access_token: "other-page-secret",
  instagram_business_account: { id: "ig_2", username: "other" },
}];

function connectedAccount(overrides = {}) {
  return {
    id: "acc_ig",
    platform: "Instagram",
    connectionState: "CONNECTED",
    connectionMethod: "OAUTH",
    providerAccountId: "ig_1",
    pageId: "page_1",
    managedProfileId: "prf_1",
    publishPermission: "AUTO_PUBLISH",
    ...overrides,
  };
}

function imageContent(overrides = {}) {
  return {
    id: "cnt_1",
    campaignId: "cmp_1",
    title: "Pilot",
    caption: "Hello coast",
    status: "READY",
    managedProfileId: "prf_1",
    mediaRefs: [{ url: "https://cdn.example.com/pilot.jpg" }],
    ...overrides,
  };
}

describe("connected contract", () => {
  it("does not treat pasted identities as connected", () => {
    for (const account of [
      { platform: "Instagram", handle: "@djcoast", connectionState: "MANUAL_ONLY" },
      { platform: "Facebook", displayName: "Coast Page", connectionState: "SETUP_REQUIRED" },
      { platform: "Threads", handle: "@djcoast", connectionState: "UNCONNECTED" },
      { platform: "YouTube", displayName: "Coast Entertainment", connectionState: "NOT_CONNECTED" },
    ]) {
      expect(account.connectionState).not.toBe("CONNECTED");
    }
  });
});

describe("meta discovery and instagram publish", () => {
  it("lists pages and linked instagram accounts without tokens", () => {
    const destinations = publicDestinationsFromPages(PAGES);
    expect(destinations).toHaveLength(2);
    expect(JSON.stringify(destinations)).not.toContain("page-token-secret");
    expect(destinationsForSurface(destinations, "instagram").map((row) => row.instagramId)).toEqual(["ig_1", "ig_2"]);
    const selected = selectionFromVault(PAGES, { surface: "instagram", pageId: "page_1", instagramId: "ig_1" });
    expect(selected.providerAccountId).toBe("ig_1");
    expect(selectionFromVault(PAGES, { surface: "instagram", pageId: "missing" }).ok).toBe(false);
  });

  it("refuses a local instagram asset before any provider call", async () => {
    const fetchImpl = vi.fn();
    expect(classifyMediaUrl("/Users/eric/video.mp4")).toBe("LOCAL_ONLY_MEDIA");
    expect(classifyMediaUrl("http://127.0.0.1:5174/a.jpg")).toBe("LOCAL_ONLY_MEDIA");
    const blocked = evaluatePublishGate({
      account: connectedAccount(),
      content: imageContent({ mediaRefs: [{ url: "file:///tmp/a.jpg" }] }),
      approval: { id: "apr_1" },
    });
    expect(blocked.code).toBe("MEDIA_PUBLIC_URL_REQUIRED");
    const result = await publishInstagramMedia({
      fetchImpl,
      igUserId: "ig_1",
      accessToken: "secret",
      imageUrl: "file:///tmp/a.jpg",
    });
    expect(result.code).toBe("MEDIA_PUBLIC_URL_REQUIRED");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("publishes only after the container is finished and keeps the media id", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "container_1" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: "FINISHED" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "media_9" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ permalink: "https://www.instagram.com/p/abc" }) });
    const result = await publishInstagramMedia({
      fetchImpl,
      igUserId: "ig_1",
      accessToken: "secret",
      imageUrl: "https://cdn.example.com/pilot.jpg",
      caption: "Hello coast",
    });
    expect(result.ok).toBe(true);
    expect(String(fetchImpl.mock.calls[0][1].body)).toContain("caption=Hello+coast");
    expect(result.providerPostId).toBe("media_9");
    expect(result.providerPostId).not.toBe("container_1");
    expect(result.permalink).toMatch(/instagram.com/);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(classifyMetaPublishFailure({ error: { code: 190, message: "Error validating access token" } }, "PUBLISH_FAILED").code).toBe("RECONNECT_REQUIRED");
    expect(classifyMetaPublishFailure({ error: { code: 10, message: "permission" } }, "CONTAINER_FAILED").code).toBe("PERMISSION_MISSING");
    expect(classifyMetaPublishFailure({ error: { code: 4, message: "Application request limit reached" } }, "PUBLISH_FAILED").code).toBe("RATE_LIMITED");
    expect(classifyMetaPublishFailure({ error: { message: "Could not download media" } }, "CONTAINER_FAILED").code).toBe("MEDIA_NOT_PUBLIC");
  });

  it("publishes a facebook page post with the page token kept out of the result", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "page_1_post_1" }) });
    const result = await publishFacebookPagePost({
      fetchImpl,
      pageId: "page_1",
      pageAccessToken: "page-token-secret",
      message: "Hello",
    });
    expect(result.providerPostId).toBe("page_1_post_1");
    expect(JSON.stringify(result)).not.toContain("page-token-secret");
  });
});

describe("youtube private upload", () => {
  it("uploads through a resumable session and forces private", async () => {
    const filePath = join(tmpdir(), `pilot-${Date.now()}.mp4`);
    writeFileSync(filePath, Buffer.from("0123456789"));
    const bodies = [];
    const fetchImpl = vi.fn(async (url, options = {}) => {
      bodies.push(String(options.body || ""));
      if (String(url).includes("uploadType=resumable")) {
        return { ok: true, headers: { get: () => "https://upload.example/session" }, json: async () => ({}) };
      }
      if (!globalThis.__ytRetry) {
        globalThis.__ytRetry = true;
        return { ok: false, status: 308, headers: { get: () => "bytes=0-4" }, json: async () => ({}) };
      }
      return { ok: true, status: 200, headers: { get: () => "" }, json: async () => ({ id: "video_private_1" }) };
    });
    const blocked = evaluatePublishGate({
      account: connectedAccount({ id: "acc_yt", platform: "YouTube", providerAccountId: "channel_1" }),
      content: imageContent({ privacyStatus: "public", videoPath: filePath }),
      approval: null,
    });
    expect(blocked.code).toBe("YOUTUBE_PILOT_PRIVATE_ONLY");
    const result = await uploadPrivateYouTube({
      fetchImpl,
      accessToken: "yt-secret",
      filePath,
      title: "Private pilot",
    });
    expect(result.providerPostId).toBe("video_private_1");
    expect(result.privacyStatus).toBe("private");
    expect(bodies[0]).toContain('"privacyStatus":"private"');
    expect(JSON.stringify(result)).not.toContain("yt-secret");
    delete globalThis.__ytRetry;
  });
});

describe("fresh approval gate", () => {
  const now = Date.parse("2026-10-08T16:00:00.000Z");

  function approvalFor(account, content, patch = {}) {
    const variant = variantForAccount(content, account);
    return buildPublishApproval({
      id: "apr_1",
      operatorId: "opr_1",
      managedProfileId: "prf_1",
      contentId: content.id,
      contentFingerprint: publishFingerprint(variant),
      provider: "instagram",
      accountId: account.id,
      externalDestinationId: account.providerAccountId,
      mediaRef: variant.mediaRef,
      ...patch,
    }, now);
  }

  it("blocks every bypass that is not a fresh matching approval", () => {
    const account = connectedAccount();
    const content = imageContent();
    const base = { account, content, workspaceId: "prf_1", operatorId: "opr_1", now };
    expect(evaluatePublishGate({ ...base, approval: null }).code).toBe("FRESH_APPROVAL_REQUIRED");
    expect(evaluatePublishGate({
      ...base,
      account: connectedAccount({ publishPermission: "AUTO_PUBLISH" }),
      content: imageContent({ status: "READY" }),
      approval: null,
    }).code).toBe("FRESH_APPROVAL_REQUIRED");
    const other = approvalFor(account, content, { accountId: "acc_other" });
    expect(evaluatePublishGate({ ...base, approval: other }).code).toBe("APPROVAL_ACCOUNT_MISMATCH");
    const revised = approvalFor(account, content);
    revised.contentFingerprint = "fp_other";
    expect(evaluatePublishGate({ ...base, approval: revised }).code).toBe("APPROVAL_REVISION_MISMATCH");
    const expired = approvalFor(account, content);
    expired.expiresAt = "2020-01-01T00:00:00.000Z";
    expect(evaluatePublishGate({ ...base, approval: expired }).code).toBe("APPROVAL_EXPIRED");
    const consumed = approvalFor(account, content);
    consumed.consumedAt = "2026-10-08T16:00:01.000Z";
    expect(evaluatePublishGate({ ...base, approval: consumed }).code).toBe("APPROVAL_CONSUMED");
    const moved = approvalFor(account, content, { externalDestinationId: "ig_other" });
    expect(evaluatePublishGate({ ...base, approval: moved }).code).toBe("APPROVAL_DESTINATION_MISMATCH");
    const media = approvalFor(account, content, { mediaRef: "https://cdn.example.com/other.jpg" });
    expect(evaluatePublishGate({ ...base, approval: media }).code).toBe("APPROVAL_MEDIA_MISMATCH");
  });
});

describe("worker does not call the provider without approval", () => {
  beforeEach(async () => {
    await resetDbForTests();
    await initDb();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not fetch when approval is missing, even if the payload says approved", async () => {
    const account = connectedAccount();
    await upsert(COLLECTIONS.accounts, account);
    await upsert(COLLECTIONS.content, imageContent());
    setAccountTokens("instagram", account.id, { accessToken: "secret", pages: PAGES, providerAccountId: "ig_1" });
    await enqueueJob({
      type: JOB_TYPES.PUBLISH_CONTENT,
      payload: {
        contentId: "cnt_1",
        accountId: account.id,
        approved: true,
        managedProfileId: "prf_1",
        operatorId: "opr_1",
        idempotencyKey: "publish:cnt_1:acc_ig:now",
      },
      idempotencyKey: "publish:cnt_1:acc_ig:now",
    });
    const processed = await processJobQueue({ limit: 1, types: [JOB_TYPES.PUBLISH_CONTENT] });
    expect(processed.results[0].ok).toBe(false);
    expect(processed.results[0].error).toBe("FRESH_APPROVAL_REQUIRED");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("publishes once and does not call the provider again for the same attempt", async () => {
    const account = connectedAccount();
    const content = imageContent();
    const variant = variantForAccount(content, account);
    const approval = buildPublishApproval({
      id: "apr_live",
      operatorId: "opr_1",
      managedProfileId: "prf_1",
      contentId: content.id,
      contentFingerprint: publishFingerprint(variant),
      provider: "instagram",
      accountId: account.id,
      externalDestinationId: account.providerAccountId,
      mediaRef: variant.mediaRef,
    });
    await upsert(COLLECTIONS.accounts, account);
    await upsert(COLLECTIONS.content, content);
    await upsert(COLLECTIONS.approvals, approval);
    setAccountTokens("instagram", account.id, { accessToken: "secret", pages: PAGES, providerAccountId: "ig_1" });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "container_1" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: "FINISHED" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "media_9" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ permalink: "https://www.instagram.com/p/abc" }) }));
    const payload = {
      contentId: content.id,
      accountId: account.id,
      approvalId: approval.id,
      managedProfileId: "prf_1",
      operatorId: "opr_1",
      idempotencyKey: "publish:cnt_1:acc_ig:pilot",
    };
    await enqueueJob({ type: JOB_TYPES.PUBLISH_CONTENT, payload, idempotencyKey: payload.idempotencyKey });
    const first = await processJobQueue({ limit: 1, types: [JOB_TYPES.PUBLISH_CONTENT] });
    expect(first.results[0].ok).toBe(true);
    const callsAfterFirst = fetch.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);
    await enqueueJob({ type: JOB_TYPES.PUBLISH_CONTENT, payload });
    const second = await processJobQueue({ limit: 1, types: [JOB_TYPES.PUBLISH_CONTENT] });
    expect(second.results[0]?.ok).toBe(true);
    expect(second.results[0]?.result?.deduped).toBe(true);
    expect(fetch.mock.calls.length).toBe(callsAfterFirst);
    const stored = await get(COLLECTIONS.approvals, approval.id);
    expect(stored.consumedAt).toBeTruthy();
    const attempts = await list(COLLECTIONS.publication_attempts);
    expect(attempts.filter((row) => row.state === "PUBLISHED")).toHaveLength(1);
    expect(JSON.stringify(attempts)).not.toContain("secret");
    expect(campaignPlatformResults(attempts, { campaignId: "cmp_1" }).instagram).toBe("PUBLISHED");
    expect(readFileSync(process.env.RL_SECRETS_PATH, "utf8")).not.toContain("page-token-secret");
  });

  it("does not call Meta again when an earlier attempt may already have created a container", async () => {
    const account = connectedAccount();
    const content = imageContent({ id: "cnt_retry" });
    await upsert(COLLECTIONS.accounts, account);
    await upsert(COLLECTIONS.content, content);
    await upsert(COLLECTIONS.publication_attempts, {
      id: "pub_open",
      provider: "instagram",
      accountId: account.id,
      contentId: content.id,
      idempotencyKey: "publish:cnt_retry:acc_ig:pilot",
      state: "ATTEMPTED",
      providerPostId: "",
      providerResult: { containerId: "container_open" },
      createdAt: "2026-10-09T22:00:00.000Z",
      updatedAt: "2026-10-09T22:00:00.000Z",
    });
    setAccountTokens("instagram", account.id, { accessToken: "secret", pages: PAGES, providerAccountId: "ig_1" });
    const payload = {
      contentId: content.id,
      accountId: account.id,
      managedProfileId: "prf_1",
      operatorId: "opr_1",
      idempotencyKey: "publish:cnt_retry:acc_ig:pilot",
    };
    await enqueueJob({ type: JOB_TYPES.PUBLISH_CONTENT, payload });
    const processed = await processJobQueue({ limit: 1, types: [JOB_TYPES.PUBLISH_CONTENT] });
    expect(processed.results[0].ok).toBe(true);
    expect(processed.results[0].result.code).toBe("DUPLICATE_SUPPRESSED");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("threads and youtube identity", () => {
  const previous = {};
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    for (const name of ["THREADS_APP_ID", "THREADS_APP_SECRET", "THREADS_REDIRECT_URI", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"]) {
      previous[name] = process.env[name];
    }
    process.env.THREADS_APP_ID = "threads-app";
    process.env.THREADS_APP_SECRET = "threads-secret";
    process.env.THREADS_REDIRECT_URI = "https://threads.regeneluxe.test:5175/api/oauth/threads/callback";
    process.env.AUTH_GOOGLE_ID = "google-client";
    process.env.AUTH_GOOGLE_SECRET = "google-secret";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [name, value] of Object.entries(previous)) {
      if (value == null) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("verifies a Threads user before connected and publishes text without auto-publish", async () => {
    const { threadsConnector } = await import("./providers/threads.js");
    const fetch = vi.mocked(global.fetch);
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "short-token", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "long-token", expires_in: 5184000 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "th_1", username: "djcoast", name: "DJ Coast" }) });
    const auth = await threadsConnector._completeAuth({ code: "code", stateMeta: { accountId: "acc_th" } });
    expect(auth.connectionState).toBe("CONNECTED");
    expect(auth.profile.providerAccountId).toBe("th_1");
    expect(JSON.stringify(auth)).not.toContain("long-token");
    const exchangeUrl = String(fetch.mock.calls[1][0]);
    expect(exchangeUrl).toContain("grant_type=th_exchange_token");
    expect(exchangeUrl.startsWith("https://graph.threads.com/access_token")).toBe(true);
    expect(JSON.stringify(auth)).not.toContain("threads-secret");

    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "creation_1" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "thread_9" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ permalink: "https://www.threads.net/@djcoast/post/thread_9" }) });
    const published = await threadsConnector._publishContent(
      { id: "acc_th" },
      { text: "Pilot text" },
      { accessToken: "long-token", providerAccountId: "th_1" },
    );
    expect(published.providerPostId).toBe("thread_9");
    expect(published.externalUrl).toContain("threads.net");
    expect(JSON.stringify(published)).not.toContain("long-token");
    const createBody = String(fetch.mock.calls[3][1].body);
    expect(createBody).toContain("media_type=TEXT");
  });

  it("returns every YouTube channel and keeps a social connect on the upload scope", async () => {
    const { youtubeConnector } = await import("./providers/youtube.js");
    const fetch = vi.mocked(global.fetch);
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "yt-token", refresh_token: "yt-refresh", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [
        { id: "UC1", snippet: { title: "Coast", customUrl: "@coast" } },
        { id: "UC2", snippet: { title: "Other", customUrl: "@other" } },
      ] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: "sub_1", email: "dj@example.com" }) });
    const auth = await youtubeConnector._completeAuth({ code: "code", stateMeta: { accountId: "acc_yt", connectionId: "acc_yt" } });
    expect(auth.profile.channels).toHaveLength(2);
    expect(auth.profile.channels.map((channel) => channel.id)).toEqual(["UC1", "UC2"]);
    expect(JSON.stringify(auth)).not.toContain("yt-token");
    const social = await youtubeConnector._beginAuth({ accountId: "acc_yt", includeUpload: true, returnTo: "/accounts" });
    expect(social.authUrl).toContain("youtube.upload");
    expect(social.authUrl).not.toContain("yt-analytics.readonly");
    const settings = await youtubeConnector._beginAuth({ accountId: "acc_yt", returnTo: "/settings" });
    expect(settings.authUrl).toContain("yt-analytics.readonly");
    expect(settings.authUrl).not.toContain("youtube.upload");
  });
});
