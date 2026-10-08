import { assertPublicProviderMedia } from "../../../src/data/mediaReadiness.js";

/**
 * Meta Graph helpers. Version comes from META_GRAPH_VERSION.
 * Tokens stay in the vault. These functions return public identity only.
 */

export const META_PILOT_SCOPES = Object.freeze([
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
]);

export function metaGraphVersion() {
  const raw = String(process.env.META_GRAPH_VERSION || "v23.0").trim();
  return /^v\d+\.\d+$/.test(raw) ? raw : "v23.0";
}

export function metaGraphUrl(path) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `https://graph.facebook.com/${metaGraphVersion()}${suffix}`;
}

export function metaDialogUrl() {
  return `https://www.facebook.com/${metaGraphVersion()}/dialog/oauth`;
}

export function publicDestinationsFromPages(pages = []) {
  return pages.filter((page) => page?.id).map((page) => ({
    pageId: String(page.id),
    pageName: page.name || "",
    tasks: Array.isArray(page.tasks) ? page.tasks : [],
    instagramId: page.instagram_business_account?.id ? String(page.instagram_business_account.id) : "",
    instagramUsername: page.instagram_business_account?.username || "",
  }));
}

export function destinationsForSurface(destinations, surface) {
  if (surface === "facebook") return destinations;
  return destinations.filter((destination) => destination.instagramId);
}

export function safeProviderError(message) {
  return String(message || "Provider request failed")
    .replace(/access_token=[^&\s]+/gi, "access_token=redacted")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer redacted")
    .slice(0, 300);
}

export async function publishInstagramMedia({
  fetchImpl = fetch,
  igUserId,
  accessToken,
  imageUrl = "",
  videoUrl = "",
  sleep = () => Promise.resolve(),
  maxPolls = 5,
} = {}) {
  const mediaUrl = videoUrl || imageUrl;
  const ready = assertPublicProviderMedia(mediaUrl);
  if (!ready.ok) return { ok: false, error: "MEDIA_PUBLIC_URL_REQUIRED", code: "MEDIA_PUBLIC_URL_REQUIRED" };
  const isReel = Boolean(videoUrl);
  const body = new URLSearchParams({ access_token: accessToken });
  if (isReel) {
    body.set("media_type", "REELS");
    body.set("video_url", videoUrl);
  } else {
    body.set("image_url", imageUrl);
  }
  const createRes = await fetchImpl(metaGraphUrl(`/${igUserId}/media`), { method: "POST", body });
  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !created.id) {
    return { ok: false, error: safeProviderError(created.error?.message || "Instagram container was not created."), code: "CONTAINER_FAILED" };
  }
  const containerId = created.id;
  let finished = false;
  let lastStatus = "";
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    const statusUrl = new URL(metaGraphUrl(`/${containerId}`));
    statusUrl.searchParams.set("fields", "status_code");
    statusUrl.searchParams.set("access_token", accessToken);
    const statusRes = await fetchImpl(statusUrl);
    const statusJson = await statusRes.json().catch(() => ({}));
    lastStatus = statusJson.status_code || "";
    if (lastStatus === "FINISHED") {
      finished = true;
      break;
    }
    if (lastStatus === "ERROR" || lastStatus === "EXPIRED") {
      return { ok: false, error: "Instagram media processing failed.", code: "CONTAINER_FAILED", providerStatus: lastStatus };
    }
    await sleep(attempt === 0 ? 0 : 250);
  }
  if (!finished) {
    return { ok: false, error: "Instagram media is not finished processing.", code: "CONTAINER_NOT_FINISHED", providerStatus: lastStatus, containerId };
  }
  const publishBody = new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken,
  });
  const publishRes = await fetchImpl(metaGraphUrl(`/${igUserId}/media_publish`), { method: "POST", body: publishBody });
  const published = await publishRes.json().catch(() => ({}));
  if (!publishRes.ok || !published.id) {
    return { ok: false, error: safeProviderError(published.error?.message || "Instagram publish failed."), code: "PUBLISH_FAILED" };
  }
  if (published.id === containerId) {
    return { ok: false, error: "Provider returned the container id instead of a media id.", code: "CONTAINER_ID_NOT_MEDIA_ID" };
  }
  let permalink = "";
  const mediaLookup = new URL(metaGraphUrl(`/${published.id}`));
  mediaLookup.searchParams.set("fields", "permalink");
  mediaLookup.searchParams.set("access_token", accessToken);
  const permalinkRes = await fetchImpl(mediaLookup);
  const permalinkJson = await permalinkRes.json().catch(() => ({}));
  if (permalinkRes.ok && permalinkJson.permalink) permalink = permalinkJson.permalink;
  return {
    ok: true,
    providerPostId: published.id,
    containerId,
    permalink,
    providerStatus: "PUBLISHED",
    mediaKind: isReel ? "REELS" : "IMAGE",
    mediaUrl,
  };
}

export async function publishFacebookPagePost({
  fetchImpl = fetch,
  pageId,
  pageAccessToken,
  message,
} = {}) {
  const body = new URLSearchParams({
    message: message || "",
    access_token: pageAccessToken,
  });
  const res = await fetchImpl(metaGraphUrl(`/${pageId}/feed`), { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.id) {
    return { ok: false, error: safeProviderError(json.error?.message || "Facebook Page publish failed."), code: "PUBLISH_FAILED" };
  }
  return {
    ok: true,
    providerPostId: json.id,
    permalink: `https://www.facebook.com/${json.id}`,
    providerStatus: "PUBLISHED",
  };
}

export function selectionFromVault(pages, { surface, pageId, instagramId = "" }) {
  const match = (pages || []).find((page) => String(page.id) === String(pageId));
  if (!match) return { ok: false, error: "That Page is not part of this authorization." };
  if (surface === "instagram") {
    const ig = match.instagram_business_account;
    if (!ig?.id || (instagramId && String(ig.id) !== String(instagramId))) {
      return { ok: false, error: "That Page has no matching Instagram professional account." };
    }
    return {
      ok: true,
      providerAccountId: String(ig.id),
      externalDestinationId: String(ig.id),
      pageId: String(match.id),
      pageName: match.name || "",
      handle: ig.username ? `@${ig.username}` : "",
      displayName: ig.username || match.name || "",
      pageAccessToken: match.access_token || "",
      tasks: match.tasks || [],
    };
  }
  return {
    ok: true,
    providerAccountId: String(match.id),
    externalDestinationId: String(match.id),
    pageId: String(match.id),
    pageName: match.name || "",
    handle: match.name || "",
    displayName: match.name || "",
    pageAccessToken: match.access_token || "",
    tasks: match.tasks || [],
  };
}
