import { youtubeConnector, publicYoutubeChannel } from "./providers/youtube.js";
import { consumeOAuthState } from "./oauth/state.js";
import { getCanonicalOrigin } from "../auth/origin.js";
import { getAccountTokens, hasAccountTokens, clearAccountTokens } from "../secrets/providers.js";
import {
  ensureProfileConnection,
  getManagedProfile,
  getProfileConnectionByKind,
  listProfileConnections,
  upsertProfileConnection,
} from "../db/managedProfileRepository.js";
import { list, upsert, COLLECTIONS } from "../db/index.js";
import { PROFILE_CONNECTION_KINDS, PROFILE_CONNECTION_STATES, publicProfileConnection } from "../../src/data/profileModels.js";
import { emptyAccount } from "../../src/data/models.js";
import { nowIso, createId } from "../../src/data/ids.js";
import { buildMetricSnapshotRecord } from "./normalizeMetrics.js";
import { friendlyGoogleApiError } from "../auth/googleErrors.js";
import { YOUTUBE_CONNECTION_SCOPE_STRING } from "../auth/googleScopes.js";
import { assertMatchesSignedInGoogleAccount } from "../../src/data/googleIdentity.js";

function settingsRedirect(params = {}) {
  const url = new URL("/settings", getCanonicalOrigin());
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function absolutePath(path) {
  if (!path) return `${getCanonicalOrigin()}/settings`;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return new URL(path, getCanonicalOrigin()).toString();
}

function disconnectedFields() {
  return {
    status: PROFILE_CONNECTION_STATES.NOT_CONNECTED,
    connectionState: PROFILE_CONNECTION_STATES.NOT_CONNECTED,
    email: "",
    externalEmail: "",
    externalAccountId: "",
    externalDisplayName: "",
    channelId: "",
    channelTitle: "",
    channelHandle: "",
    pendingChannels: [],
    indexedCount: 0,
    lastErrorCode: "",
    lastErrorSummary: "",
    notes: "YouTube is a profile connection on the signed-in ReGeneLuxe account.",
    updatedAt: nowIso(),
  };
}

async function loadOwnedYoutubeConnection(operator, activeProfile) {
  if (!operator?.id || !activeProfile?.id) {
    return { ok: false, status: 400, error: "Active profile required." };
  }
  if (activeProfile.ownerOperatorId && activeProfile.ownerOperatorId !== operator.id) {
    return { ok: false, status: 403, error: "YouTube can only be managed for a profile you own." };
  }
  const connection = await getProfileConnectionByKind(activeProfile.id, PROFILE_CONNECTION_KINDS.YOUTUBE)
    || await ensureProfileConnection(activeProfile, PROFILE_CONNECTION_KINDS.YOUTUBE);
  return { ok: true, connection };
}

/**
 * @param {{ operator?: { id: string }, activeProfile?: object, returnTo?: string }} [input]
 */
export async function startYoutubeAuth({ operator, activeProfile, returnTo = "/settings" } = {}) {
  if (!operator?.id) {
    return { ok: false, status: 401, error: "Please sign in to continue.", redirectTo: absolutePath("/signin") };
  }
  if (!activeProfile?.id) {
    return { ok: false, status: 400, error: "Create a managed profile before connecting YouTube.", redirectTo: absolutePath("/setup/profile") };
  }
  if (activeProfile.ownerOperatorId && activeProfile.ownerOperatorId !== operator.id) {
    return {
      ok: false,
      status: 403,
      error: "YouTube can only be connected for a profile you own.",
      redirectTo: settingsRedirect({ youtube: "error", message: "YouTube can only be connected for the active profile." }),
    };
  }
  if (youtubeConnector.resolveReadiness?.() === "SETUP_REQUIRED") {
    return {
      ok: false,
      connectionState: "SETUP_REQUIRED",
      error: "YouTube Data API must be enabled before channel data can sync.",
      redirectTo: settingsRedirect({ youtube: "error", message: "YouTube Data API must be enabled before channel data can sync." }),
    };
  }
  const connection = await ensureProfileConnection(activeProfile, PROFILE_CONNECTION_KINDS.YOUTUBE);
  const started = await youtubeConnector.beginAuth({
    accountId: connection.id,
    connectionId: connection.id,
    managedProfileId: activeProfile.id,
    operatorId: operator.id,
    returnTo,
    loginHint: operator.email || "",
  });
  if (!started.ok || !started.authUrl) {
    return {
      ...started,
      redirectTo: settingsRedirect({
        youtube: "error",
        message: started.message || started.error || "YouTube is not ready to connect.",
      }),
    };
  }
  return {
    ok: true,
    authUrl: started.authUrl,
    state: started.state,
    connectionId: connection.id,
    managedProfileId: activeProfile.id,
    redirectTo: started.authUrl,
    scope: YOUTUBE_CONNECTION_SCOPE_STRING,
  };
}

export async function completeYoutubeAuth({ code, state, error, errorDescription, operator } = {}) {
  const stateResult = consumeOAuthState(state);
  if (!stateResult.ok) {
    return {
      ok: false,
      error: stateResult.error,
      redirectTo: settingsRedirect({ youtube: "error", message: stateResult.error }),
    };
  }
  if (stateResult.provider && stateResult.provider !== "youtube") {
    return { ok: false, error: "This connection session is not for YouTube.", redirectTo: settingsRedirect({ youtube: "error", message: "This connection session is not for YouTube." }) };
  }
  if (!operator?.id) {
    return { ok: false, status: 401, error: "Please sign in to continue.", redirectTo: absolutePath("/signin") };
  }
  if (stateResult.operatorId && stateResult.operatorId !== operator.id) {
    return { ok: false, error: "YouTube connection does not belong to this account.", redirectTo: settingsRedirect({ youtube: "error", message: "YouTube connection does not belong to this account." }) };
  }
  const profile = stateResult.managedProfileId ? await getManagedProfile(stateResult.managedProfileId) : null;
  if (!profile || profile.ownerOperatorId !== operator.id) {
    return { ok: false, error: "YouTube can only be attached to the authorizing managed profile.", redirectTo: settingsRedirect({ youtube: "error", message: "YouTube can only be attached to the authorizing managed profile." }) };
  }
  const connection = await ensureProfileConnection(profile, PROFILE_CONNECTION_KINDS.YOUTUBE);
  const result = await youtubeConnector.completeAuth({
    code,
    state,
    stateMeta: { ...stateResult, accountId: connection.id, connectionId: connection.id },
    error,
    errorDescription,
  });
  if (!result.ok) {
    if (!hasAccountTokens("youtube", connection.id)) clearAccountTokens("youtube", connection.id);
    await upsertProfileConnection({
      ...connection,
      status: result.connectionState || PROFILE_CONNECTION_STATES.ERROR,
      connectionState: result.connectionState || PROFILE_CONNECTION_STATES.ERROR,
      lastErrorSummary: result.error || "YouTube connection failed.",
      lastErrorCode: result.code || "",
    });
    return {
      ok: false,
      error: result.error,
      redirectTo: settingsRedirect({ youtube: "error", message: result.error || "YouTube connection failed." }),
    };
  }
  const identity = assertMatchesSignedInGoogleAccount(operator, {
    googleSub: result.profile?.googleAccountSub,
    email: result.profile?.email,
  });
  if (!identity.ok) {
    clearAccountTokens("youtube", connection.id);
    await upsertProfileConnection({
      ...connection,
      ...disconnectedFields(),
      status: PROFILE_CONNECTION_STATES.ERROR,
      connectionState: PROFILE_CONNECTION_STATES.ERROR,
      lastErrorCode: "GOOGLE_ACCOUNT_MISMATCH",
      lastErrorSummary: identity.error,
      notes: identity.error,
    });
    return {
      ok: false,
      error: identity.error,
      redirectTo: settingsRedirect({ youtube: "error", message: identity.error }),
    };
  }
  const channels = result.profile.channels || [];
  const selected = channels.length === 1 ? channels[0] : null;
  const saved = await upsertProfileConnection({
    ...connection,
    provider: "youtube",
    service: "GOOGLE_YOUTUBE",
    status: selected ? PROFILE_CONNECTION_STATES.CONNECTED : PROFILE_CONNECTION_STATES.CONNECTED,
    connectionState: PROFILE_CONNECTION_STATES.CONNECTED,
    permission: "readonly",
    email: result.profile.email || "",
    externalEmail: result.profile.email || "",
    googleAccountSub: result.profile.googleAccountSub || "",
    externalAccountId: selected?.id || "",
    externalDisplayName: selected?.title || "",
    externalAvatarUrl: selected?.avatarUrl || "",
    channelId: selected?.id || "",
    channelTitle: selected?.title || "",
    channelHandle: selected?.handle || "",
    pendingChannels: selected ? [] : channels,
    connectedAt: nowIso(),
    lastErrorCode: "",
    lastErrorSummary: "",
    notes: selected ? "" : (channels.length ? "Select a YouTube channel for this profile." : "No YouTube channels were found on this Google account."),
  });
  if (selected) {
    await reconcileYoutubeAccount(profile, selected);
    await syncYoutubeChannel({ connection: saved }).catch(() => null);
  }
  return {
    ok: true,
    connection: publicProfileConnection(await getProfileConnectionByKind(profile.id, PROFILE_CONNECTION_KINDS.YOUTUBE)),
    channels,
    redirectTo: settingsRedirect(selected
      ? { youtube: "connected" }
      : { youtube: "pick" }),
  };
}

/**
 * @param {{ operator?: { id: string }, activeProfile?: object, channelId?: string }} [input]
 */
export async function selectYoutubeChannel({ operator, activeProfile, channelId } = {}) {
  const loaded = await loadOwnedYoutubeConnection(operator, activeProfile);
  if (!loaded.ok) return loaded;
  const wanted = String(channelId || "");
  const channel = (loaded.connection.pendingChannels || []).find((item) => item.id === wanted);
  if (!channel) {
    return { ok: false, error: "Choose a YouTube channel from the accounts Google returned." };
  }
  const saved = await upsertProfileConnection({
    ...loaded.connection,
    channelId: channel.id,
    channelTitle: channel.title,
    channelHandle: channel.handle,
    externalAccountId: channel.id,
    externalDisplayName: channel.title,
    externalAvatarUrl: channel.avatarUrl,
    pendingChannels: [],
    notes: "",
    status: PROFILE_CONNECTION_STATES.CONNECTED,
  });
  await reconcileYoutubeAccount(activeProfile, channel);
  const synced = await syncYoutubeChannel({ connection: saved });
  return { ok: true, connection: publicProfileConnection(synced.connection || saved), synced };
}

function normalizeHandle(value) {
  return String(value || "").trim().replace(/^@+/, "").toLowerCase();
}

export async function reconcileYoutubeAccount(profile, channel) {
  if (!profile?.id || !channel?.id) return null;
  const accounts = (await list(COLLECTIONS.accounts)).filter((row) => row.managedProfileId === profile.id && row.platform === "YouTube");
  const byId = accounts.find((row) => row.providerAccountId && row.providerAccountId === channel.id);
  const byUrl = accounts.find((row) => String(row.profileUrl || "").includes(channel.id));
  const byHandle = accounts.find((row) => {
    const handle = normalizeHandle(row.handle);
    const incoming = normalizeHandle(channel.handle);
    return handle && incoming && handle === incoming;
  });
  const match = byId || byUrl || byHandle;
  const next = emptyAccount({
    ...(match || {}),
    platform: "YouTube",
    displayName: channel.title || match?.displayName || "",
    handle: channel.handle || match?.handle || "",
    profileUrl: channel.profileUrl || match?.profileUrl || `https://www.youtube.com/channel/${channel.id}`,
    providerAccountId: channel.id,
    connectionMethod: "OAUTH",
    connectionState: "CONNECTED",
    followerCount: channel.subscriberCount ?? match?.followerCount ?? "",
    managedProfileId: profile.id,
    lastSuccessfulSync: nowIso(),
    lastSync: nowIso(),
  });
  return upsert(COLLECTIONS.accounts, next);
}

async function youtubeGet(url, accessToken, service = "youtube") {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, ...friendlyGoogleApiError(json, res.status, service) };
  return { ok: true, json };
}

export async function syncYoutubeChannel({ connection } = {}) {
  const attemptedAt = nowIso();
  if (!connection?.id || !connection.channelId) {
    return { ok: false, error: "Select a YouTube channel first.", lastAttemptedSyncAt: attemptedAt, connection };
  }
  const tokens = getAccountTokens("youtube", connection.id);
  if (!tokens?.accessToken) {
    return { ok: false, connectionState: "RECONNECT_REQUIRED", error: "YouTube needs to be reconnected.", lastAttemptedSyncAt: attemptedAt };
  }
  const channelRes = await youtubeGet(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(connection.channelId)}`,
    tokens.accessToken,
  );
  if (!channelRes.ok) {
    const next = await upsertProfileConnection({
      ...connection,
      lastAttemptedSyncAt: attemptedAt,
      lastErrorCode: channelRes.code || "",
      lastErrorSummary: channelRes.error || "",
      status: channelRes.connectionState || connection.status,
      connectionState: channelRes.connectionState || connection.connectionState,
    });
    return { ...channelRes, connection: next, lastAttemptedSyncAt: attemptedAt };
  }
  const channel = publicYoutubeChannel(channelRes.json.items?.[0] || { id: connection.channelId });
  const search = await youtubeGet(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(connection.channelId)}&order=date&type=video&maxResults=25`,
    tokens.accessToken,
  );
  const videoIds = search.ok
    ? (search.json.items || []).map((item) => item.id?.videoId).filter(Boolean)
    : [];
  let videos = [];
  if (videoIds.length) {
    const details = await youtubeGet(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(videoIds.join(","))}`,
      tokens.accessToken,
    );
    if (details.ok) {
      videos = (details.json.items || []).map((item) => ({
        id: createId("ytv"),
        managedProfileId: connection.managedProfileId,
        connectionId: connection.id,
        providerVideoId: item.id,
        title: item.snippet?.title || "",
        publishedAt: item.snippet?.publishedAt || null,
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "",
        statistics: {
          views: item.statistics?.viewCount != null ? Number(item.statistics.viewCount) : null,
          likes: item.statistics?.likeCount != null ? Number(item.statistics.likeCount) : null,
          comments: item.statistics?.commentCount != null ? Number(item.statistics.commentCount) : null,
        },
        updatedAt: nowIso(),
      }));
      for (const video of videos) {
        const existing = (await list(COLLECTIONS.youtube_videos)).find((row) => (
          row.managedProfileId === connection.managedProfileId && row.providerVideoId === video.providerVideoId
        ));
        await upsert(COLLECTIONS.youtube_videos, { ...video, id: existing?.id || video.id, createdAt: existing?.createdAt || nowIso() });
      }
    }
  }

  const end = new Date();
  const start = new Date(Date.now() - 28 * 86400000);
  const analytics = await youtubeGet(
    `https://youtubeanalytics.googleapis.com/v2/reports?ids=${encodeURIComponent(`channel==${connection.channelId}`)}&startDate=${start.toISOString().slice(0, 10)}&endDate=${end.toISOString().slice(0, 10)}&metrics=views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments,shares`,
    tokens.accessToken,
    "youtube-analytics",
  );
  const row = analytics.ok ? analytics.json.rows?.[0] : null;
  const cols = analytics.ok ? (analytics.json.columnHeaders || []).map((item) => item.name) : [];
  const metricMap = {};
  if (row && cols.length) {
    cols.forEach((name, index) => { metricMap[name] = row[index]; });
  }
  const snapshot = buildMetricSnapshotRecord({
    accountId: connection.externalAccountId || connection.channelId,
    platform: "YouTube",
    provider: "youtube",
    source: "PROVIDER",
    metrics: {
      views: metricMap.views ?? channel.viewCount,
      watchTimeSeconds: metricMap.estimatedMinutesWatched != null ? Number(metricMap.estimatedMinutesWatched) * 60 : null,
      averageViewDuration: metricMap.averageViewDuration ?? null,
      subscribersGained: metricMap.subscribersGained ?? null,
      likes: metricMap.likes ?? null,
      comments: metricMap.comments ?? null,
      shares: metricMap.shares ?? null,
      subscribers: channel.subscriberCount,
    },
    capturedAt: nowIso(),
    raw: analytics.ok ? { columnHeaders: cols } : { analyticsUnavailable: true },
  });
  await upsert(COLLECTIONS.analytics, {
    id: createId("snap"),
    ...snapshot,
    managedProfileId: connection.managedProfileId,
  });

  const next = await upsertProfileConnection({
    ...connection,
    channelTitle: channel.title || connection.channelTitle,
    channelHandle: channel.handle || connection.channelHandle,
    externalDisplayName: channel.title || connection.externalDisplayName,
    externalAvatarUrl: channel.avatarUrl || connection.externalAvatarUrl,
    indexedCount: videos.length,
    lastAttemptedSyncAt: attemptedAt,
    lastSuccessfulSyncAt: nowIso(),
    lastSyncAt: nowIso(),
    lastErrorCode: analytics.ok ? "" : (analytics.code || ""),
    lastErrorSummary: analytics.ok ? "" : (analytics.error || ""),
    status: PROFILE_CONNECTION_STATES.CONNECTED,
  });
  return {
    ok: true,
    connection: next,
    videos: videos.length,
    analyticsImported: Boolean(analytics.ok),
    lastAttemptedSyncAt: attemptedAt,
  };
}

export async function disconnectYoutubeConnection({ operator, activeProfile } = {}) {
  const loaded = await loadOwnedYoutubeConnection(operator, activeProfile);
  if (!loaded.ok) return loaded;
  await youtubeConnector.disconnect({ id: loaded.connection.id });
  const next = await upsertProfileConnection({ ...loaded.connection, ...disconnectedFields() });
  return {
    ok: true,
    connectionState: "NOT_CONNECTED",
    connection: publicProfileConnection(next),
    profilePreserved: Boolean(await getManagedProfile(activeProfile.id)),
  };
}

export async function publicYoutubeForProfile(managedProfileId) {
  const row = managedProfileId
    ? await getProfileConnectionByKind(managedProfileId, PROFILE_CONNECTION_KINDS.YOUTUBE)
    : null;
  return publicProfileConnection(row) || publicProfileConnection({
    kind: PROFILE_CONNECTION_KINDS.YOUTUBE,
    provider: "youtube",
    status: PROFILE_CONNECTION_STATES.NOT_CONNECTED,
    displayLabel: "YouTube",
    permission: "readonly",
  });
}

export { listProfileConnections };
export async function youtubeVideosForProfile(managedProfileId) {
  if (!managedProfileId) return [];
  return (await list(COLLECTIONS.youtube_videos)).filter((row) => row.managedProfileId === managedProfileId);
}
