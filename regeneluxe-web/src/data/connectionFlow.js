/**
 * Connect-first account onboarding.
 * Provider identity is verified before an account row exists.
 * Manual entry stays a secondary, never-CONNECTED path.
 */

export const CONNECTION_SESSION_PREFIX = "cxs_";

export const READINESS_LABELS = Object.freeze({
  IMPLEMENTED: "Ready to connect",
  SETUP_REQUIRED: "Setup required",
  PROVIDER_REVIEW_REQUIRED: "Provider review required",
  UNSUPPORTED: "Unsupported",
});

export const CONNECT_PROVIDERS = Object.freeze([
  { id: "instagram", label: "Instagram", continueWith: "Continue with Meta", grant: "meta", live: true },
  { id: "facebook", label: "Facebook", continueWith: "Continue with Meta", grant: "meta", live: true },
  { id: "threads", label: "Threads", continueWith: "Continue with Threads", grant: "threads", live: true },
  { id: "youtube", label: "YouTube", continueWith: "Continue with Google", grant: "youtube", live: true },
  { id: "tiktok", label: "TikTok", continueWith: "Continue with TikTok", grant: "tiktok", live: false },
  { id: "x", label: "X", continueWith: "Continue with X", grant: "x", live: false },
  { id: "linkedin", label: "LinkedIn", continueWith: "Continue with LinkedIn", grant: "linkedin", live: false },
  { id: "soundcloud", label: "SoundCloud", continueWith: "Continue with SoundCloud", grant: "soundcloud", live: false },
  { id: "snapchat", label: "Snapchat", continueWith: "Continue with Snapchat", grant: "snapchat", live: false },
  { id: "twitch", label: "Twitch", continueWith: "Continue with Twitch", grant: "twitch", live: false },
  { id: "kick", label: "Kick", continueWith: "Continue with Kick", grant: "kick", live: false },
]);

const PLATFORM_LABEL = Object.freeze({
  instagram: "Instagram",
  facebook: "Facebook",
  threads: "Threads",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
  linkedin: "LinkedIn",
  soundcloud: "SoundCloud",
  snapchat: "Snapchat",
  twitch: "Twitch",
  kick: "Kick",
});

export const CONNECTION_FAILURES = Object.freeze({
  setup: {
    title: "Setup required",
    body: "This provider is not ready to authorize yet.",
    action: "Back to providers",
  },
  review: {
    title: "Provider review required",
    body: "This provider is waiting on approval before it can connect.",
    action: "Back to providers",
  },
  cancelled: {
    title: "Authorization cancelled",
    body: "The provider sign-in was cancelled. Nothing was added.",
    action: "Try again",
  },
  reconnect: {
    title: "Reconnect required",
    body: "The provider needs a new authorization before this account can be used.",
    action: "Reconnect",
  },
  none: {
    title: "No eligible destinations found",
    body: "The authorization succeeded, but no Page, professional account, or channel was available.",
    action: "Try another account",
  },
  professional: {
    title: "Professional Instagram account required",
    body: "Instagram publishing needs a professional account linked to a Page you manage.",
    action: "Back to providers",
  },
  multiple: {
    title: "Multiple destinations found",
    body: "Choose which destinations this workspace should operate. None are selected automatically.",
    action: "Choose destinations",
  },
  unavailable: {
    title: "Provider unavailable",
    body: "The provider could not finish authorization. Try again shortly.",
    action: "Try again",
  },
  duplicate: {
    title: "Already connected",
    body: "This provider identity is already in the workspace.",
    action: "Back to accounts",
  },
  workspace: {
    title: "Workspace mismatch",
    body: "This authorization belongs to a different ReGeneLuxe workspace.",
    action: "Back to accounts",
  },
  expired: {
    title: "Connection expired",
    body: "That connection session expired before a destination was confirmed.",
    action: "Start again",
  },
});

export function isConnectionSessionId(id) {
  return String(id || "").startsWith(CONNECTION_SESSION_PREFIX);
}

export function liveConnectProviders() {
  return CONNECT_PROVIDERS.filter((provider) => provider.live);
}

export function connectProvider(id) {
  return CONNECT_PROVIDERS.find((provider) => provider.id === String(id || "").toLowerCase()) || null;
}

export function platformLabel(providerOrPlatform) {
  const key = String(providerOrPlatform || "").toLowerCase();
  return PLATFORM_LABEL[key] || providerOrPlatform || "";
}

export function normalizeProviderId(providerOrPlatform) {
  const key = String(providerOrPlatform || "").toLowerCase();
  if (key === "twitter") return "x";
  return PLATFORM_LABEL[key] ? key : key;
}

export function readinessLabel(readiness) {
  return READINESS_LABELS[readiness] || READINESS_LABELS.UNSUPPORTED;
}

export function readinessForProvider(providerId, definitions = []) {
  const row = definitions.find((item) => normalizeProviderId(item.provider) === normalizeProviderId(providerId));
  const readiness = row?.readiness || "UNSUPPORTED";
  return { readiness, label: readinessLabel(readiness) };
}

export function normalizeHandle(value) {
  return String(value || "").trim().replace(/^@+/, "").toLowerCase();
}

export function providerIdentityKey(workspaceId, provider, externalId) {
  return `${workspaceId || ""}::${normalizeProviderId(provider)}::${String(externalId || "")}`;
}

export function findVerifiedAccount(accounts, { workspaceId, provider, externalId } = {}) {
  if (!externalId) return null;
  return (accounts || []).find((account) => {
    if (String(account.providerAccountId || "") !== String(externalId)) return false;
    if (normalizeProviderId(account.platform) !== normalizeProviderId(provider)) return false;
    if (workspaceId && account.managedProfileId && account.managedProfileId !== workspaceId) return false;
    return true;
  }) || null;
}

export function findLikelyManualMatch(accounts, destination) {
  const handle = normalizeHandle(destination?.handle || destination?.name);
  if (!handle) return null;
  return (accounts || []).find((account) => {
    if (account.providerAccountId) return false;
    if (account.connectionState !== "MANUAL_ONLY" && account.connectionState !== "SETUP_REQUIRED") return false;
    if (normalizeProviderId(account.platform) !== normalizeProviderId(destination.provider || destination.platform)) return false;
    return normalizeHandle(account.handle || account.displayName) === handle;
  }) || null;
}

export function accountFromDestination(destination, workspaceId) {
  return {
    platform: destination.platform || platformLabel(destination.provider),
    displayName: destination.name || destination.handle || "",
    handle: destination.handle || "",
    profileUrl: destination.profileUrl || "",
    providerAccountId: destination.externalId,
    externalDestinationId: destination.externalId,
    pageId: destination.pageId || "",
    pageName: destination.pageName || "",
    connectionState: "CONNECTED",
    connectionMethod: "OAUTH",
    managedProfileId: workspaceId || null,
    publishPermission: "APPROVAL_REQUIRED",
  };
}

export function planConnectionConfirmation({
  accounts = [],
  workspaceId = "",
  destinations = [],
  selectedIds = [],
  choices = {},
} = {}) {
  const selected = destinations.filter((destination) => selectedIds.includes(destination.id));
  if (!selected.length) {
    return { ok: false, failure: "none", created: [], linked: [], blocked: [], needsChoice: [] };
  }
  const created = [];
  const linked = [];
  const blocked = [];
  const needsChoice = [];
  for (const destination of selected) {
    const duplicate = findVerifiedAccount(accounts, {
      workspaceId,
      provider: destination.provider,
      externalId: destination.externalId,
    });
    if (duplicate) {
      blocked.push({ destination, accountId: duplicate.id, reason: "duplicate" });
      continue;
    }
    const manual = findLikelyManualMatch(accounts, destination);
    if (manual) {
      const choice = choices[destination.id];
      if (choice === "link") {
        linked.push({ destination, accountId: manual.id, account: accountFromDestination(destination, workspaceId) });
        continue;
      }
      if (choice === "separate") {
        created.push(accountFromDestination(destination, workspaceId));
        continue;
      }
      needsChoice.push({
        destination,
        accountId: manual.id,
        label: manual.displayName || manual.handle || "Existing entry",
      });
      continue;
    }
    created.push(accountFromDestination(destination, workspaceId));
  }
  if (needsChoice.length) {
    return { ok: false, failure: "match", created: [], linked: [], blocked, needsChoice };
  }
  if (!created.length && !linked.length) {
    return { ok: false, failure: "duplicate", created, linked, blocked, needsChoice };
  }
  return { ok: true, created, linked, blocked, needsChoice };
}

export function renameVerifiedAccount(account, nextHandle) {
  return {
    ...account,
    handle: nextHandle,
    providerAccountId: account.providerAccountId,
  };
}

export function manualConnectionResult() {
  return { connectionState: "MANUAL_ONLY", connectionMethod: "MANUAL" };
}

export function publishDestinationView(account) {
  const state = account?.connectionState || "MANUAL_ONLY";
  if (state === "CONNECTED") return { visible: true, selectable: true, action: null, reason: "" };
  if (state === "RECONNECT_REQUIRED" || state === "AUTH_EXPIRED") {
    return { visible: true, selectable: false, action: "reconnect", reason: "Reconnect required" };
  }
  if (state === "SETUP_REQUIRED") {
    return { visible: true, selectable: false, action: "setup", reason: "Setup required" };
  }
  return { visible: false, selectable: false, action: null, reason: "" };
}

export function metaDestinationsFromPages(pages = []) {
  const destinations = [];
  for (const page of pages) {
    if (!page?.pageId && !page?.id) continue;
    const pageId = String(page.pageId || page.id);
    const pageName = page.pageName || page.name || "";
    const instagramId = page.instagramId || page.instagram_business_account?.id || "";
    const instagramUsername = page.instagramUsername || page.instagram_business_account?.username || "";
    if (instagramId) {
      destinations.push({
        id: `instagram:${instagramId}`,
        provider: "instagram",
        platform: "Instagram",
        name: instagramUsername || pageName,
        handle: instagramUsername ? `@${String(instagramUsername).replace(/^@/, "")}` : "",
        type: "Instagram professional account",
        externalId: String(instagramId),
        relationship: pageName ? `Linked Page: ${pageName}` : "",
        pageId,
        pageName,
        profileUrl: instagramUsername ? `https://www.instagram.com/${String(instagramUsername).replace(/^@/, "")}/` : "",
      });
    }
    destinations.push({
      id: `facebook:${pageId}`,
      provider: "facebook",
      platform: "Facebook",
      name: pageName || "Facebook Page",
      handle: "",
      type: "Facebook Page",
      externalId: pageId,
      relationship: "",
      pageId,
      pageName,
      profileUrl: "",
    });
  }
  return destinations;
}

export function destinationsFromAuthResult(provider, result = {}) {
  const id = normalizeProviderId(provider);
  if (id === "instagram" || id === "facebook") {
    if (Array.isArray(result.publicDestinations) && result.publicDestinations.length) return result.publicDestinations;
    return metaDestinationsFromPages(result.pendingDestinations || []);
  }
  if (id === "youtube") {
    const channels = result.profile?.channels?.length
      ? result.profile.channels
      : (result.pendingDestinations || []);
    const list = channels.length
      ? channels
      : (result.profile?.providerAccountId ? [result.profile] : []);
    return list.map((channel) => ({
      id: `youtube:${channel.id || channel.providerAccountId}`,
      provider: "youtube",
      platform: "YouTube",
      name: channel.title || channel.displayName || channel.handle || "YouTube channel",
      handle: channel.handle || "",
      type: "YouTube channel",
      externalId: String(channel.id || channel.providerAccountId || ""),
      relationship: "",
      profileUrl: channel.profileUrl || "",
      pageId: "",
      pageName: "",
    })).filter((destination) => destination.externalId);
  }
  if (id === "threads" && result.profile?.providerAccountId) {
    return [{
      id: `threads:${result.profile.providerAccountId}`,
      provider: "threads",
      platform: "Threads",
      name: result.profile.displayName || result.profile.handle || "Threads",
      handle: result.profile.handle || "",
      type: "Threads profile",
      externalId: String(result.profile.providerAccountId),
      relationship: "",
      profileUrl: result.profile.profileUrl || "",
      pageId: "",
      pageName: "",
    }];
  }
  return [];
}

export function failureFromAuth(result = {}) {
  const message = String(result.error || result.message || "");
  if (/denied|cancel/i.test(message)) return "cancelled";
  if (/professional instagram/i.test(message)) return "professional";
  if (/no youtube channel|no eligible|no facebook page|no professional/i.test(message)) return "none";
  if (result.connectionState === "RECONNECT_REQUIRED") return "reconnect";
  if (result.readiness === "PROVIDER_REVIEW_REQUIRED" || result.reason === "PROVIDER_REVIEW_REQUIRED") return "review";
  if (result.connectionState === "SETUP_REQUIRED" || result.readiness === "SETUP_REQUIRED" || result.reason === "SETUP_REQUIRED") return "setup";
  if (result.readiness === "UNSUPPORTED" || result.reason === "UNSUPPORTED") return "unavailable";
  return "unavailable";
}

export const PREVIEW_DESTINATIONS = Object.freeze([
  {
    id: "instagram:ig_preview",
    provider: "instagram",
    platform: "Instagram",
    name: "djcoast",
    handle: "@djcoast",
    type: "Instagram professional account",
    externalId: "ig_preview",
    relationship: "Linked Page: DJ Coast",
    pageId: "page_preview",
    pageName: "DJ Coast",
    profileUrl: "https://www.instagram.com/djcoast/",
  },
  {
    id: "facebook:page_preview",
    provider: "facebook",
    platform: "Facebook",
    name: "DJ Coast",
    handle: "",
    type: "Facebook Page",
    externalId: "page_preview",
    relationship: "",
    pageId: "page_preview",
    pageName: "DJ Coast",
    profileUrl: "",
  },
]);

export const PREVIEW_CONNECTED_ACCOUNT = Object.freeze({
  id: "preview_connected",
  platform: "Instagram",
  displayName: "DJ Coast",
  handle: "@djcoast",
  connectionState: "CONNECTED",
  connectionMethod: "OAUTH",
  providerAccountId: "ig_preview",
  lastVerifiedAt: "2026-10-08T18:00:00.000Z",
  preview: true,
});
