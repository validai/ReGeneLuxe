/**
 * Client-safe connector registry — capabilities & labels only.
 * Real OAuth / tokens / API calls go through same-origin /api.
 */

const ALL_READ = [
  "READ_PROFILE",
  "READ_POSTS",
  "READ_CONTENT",
  "READ_POST_METRICS",
  "READ_CONTENT_METRICS",
  "READ_ACCOUNT_METRICS",
];

const DEFINITIONS = {
  Instagram: {
    capabilities: [
      ...ALL_READ,
      "READ_COMMENTS",
      "CREATE_POST",
      "PUBLISH_POST",
      "PUBLISH_IMAGE",
      "PUBLISH_VIDEO",
      "SCHEDULE_POST",
      "SCHEDULE",
      "DELETE_POST",
      "DELETE_CONTENT",
    ],
    notes: "Requires Meta app credentials (META_APP_ID / META_APP_SECRET).",
  },
  Facebook: {
    capabilities: [
      ...ALL_READ,
      "READ_COMMENTS",
      "READ_MESSAGES",
      "CREATE_POST",
      "PUBLISH_POST",
      "PUBLISH_IMAGE",
      "PUBLISH_VIDEO",
      "SCHEDULE_POST",
      "SCHEDULE",
    ],
    notes: "Requires Meta app credentials for Facebook Pages.",
  },
  YouTube: {
    capabilities: [
      ...ALL_READ,
      "READ_COMMENTS",
      "CREATE_POST",
      "PUBLISH_POST",
      "PUBLISH_VIDEO",
    ],
    notes: "Requires Google OAuth (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
  },
  TikTok: {
    capabilities: [
      ...ALL_READ,
      "CREATE_POST",
      "PUBLISH_POST",
      "PUBLISH_VIDEO",
    ],
    notes: "Available after TikTok provider approval for posting/analytics products.",
  },
  X: {
    capabilities: [
      ...ALL_READ,
      "READ_COMMENTS",
      "READ_MENTIONS",
      "READ_MESSAGES",
      "CREATE_POST",
      "PUBLISH_POST",
      "PUBLISH_TEXT",
      "PUBLISH_IMAGE",
    ],
    notes: "Requires X OAuth 2.0 client credentials.",
  },
  Threads: {
    capabilities: [
      "READ_PROFILE",
      "READ_POSTS",
      "READ_CONTENT",
      "CREATE_POST",
      "PUBLISH_POST",
      "PUBLISH_TEXT",
      "PUBLISH_IMAGE",
    ],
    notes: "Requires Threads / Meta app credentials.",
  },
  SoundCloud: {
    capabilities: [
      "READ_PROFILE",
      "READ_POSTS",
      "READ_CONTENT",
      "READ_POST_METRICS",
      "READ_CONTENT_METRICS",
    ],
    notes: "Requires SoundCloud app credentials.",
  },
  LinkedIn: {
    capabilities: ["READ_PROFILE", "CREATE_POST", "PUBLISH_POST", "PUBLISH_TEXT"],
    notes: "Rails reserved — UNSUPPORTED in this sprint.",
  },
  Snapchat: {
    capabilities: [],
    notes: "No authenticated connector yet. Manual accounts stay MANUAL_ONLY.",
  },
  Twitch: {
    capabilities: [],
    notes: "No authenticated connector yet. Manual accounts stay MANUAL_ONLY.",
  },
  Kick: {
    capabilities: [],
    notes: "No authenticated connector yet. Manual accounts stay MANUAL_ONLY.",
  },
  Other: {
    capabilities: [],
    notes: "No provider adapter for this platform.",
  },
};

export const CONNECTORS = Object.fromEntries(
  Object.entries(DEFINITIONS).map(([platform, def]) => [
    platform,
    {
      platform,
      capabilities: def.capabilities,
      notes: def.notes,
      supported: def.capabilities.length > 0,
      async execute() {
        return {
          ok: false,
          unavailable: true,
          reason: "Use /api/oauth and /api/connections — client adapters never hold tokens.",
        };
      },
    },
  ]),
);

export function getConnector(platform) {
  return CONNECTORS[platform] || CONNECTORS.Other;
}

export function declaredCapabilities(platform) {
  return [...(getConnector(platform).capabilities || [])];
}

export function availableCapabilities(account) {
  if (!account || account.connectionState !== "CONNECTED") return [];
  return declaredCapabilities(account.platform);
}

export function hasCapability(account, capability) {
  const caps = availableCapabilities(account);
  if (caps.includes(capability)) return true;
  // Alias tolerance
  const aliases = {
    PUBLISH_POST: ["PUBLISH_TEXT", "PUBLISH_IMAGE", "PUBLISH_VIDEO"],
    SCHEDULE_POST: ["SCHEDULE"],
    READ_POSTS: ["READ_CONTENT"],
    READ_POST_METRICS: ["READ_CONTENT_METRICS"],
  };
  if (aliases[capability]?.some((a) => caps.includes(a))) return true;
  // reverse: asking for PUBLISH_IMAGE when only PUBLISH_POST declared
  if (["PUBLISH_TEXT", "PUBLISH_IMAGE", "PUBLISH_VIDEO"].includes(capability) && caps.includes("PUBLISH_POST")) {
    return true;
  }
  return false;
}

export function connectionLabel(account) {
  if (!account) return "Manual";
  if (account.connectionState === "CONNECTED") return "Connected";
  if (account.connectionState === "MANUAL_ONLY" || !account.connectionState) return "Manual";
  if (account.connectionState === "SETUP_REQUIRED") return "Setup required";
  if (account.connectionState === "RECONNECT_REQUIRED") return "Reconnect required";
  return account.connectionState.replaceAll("_", " ").toLowerCase();
}

export function publishMediaSupport(platform) {
  const caps = declaredCapabilities(platform);
  return {
    text: caps.includes("PUBLISH_TEXT") || caps.includes("PUBLISH_POST"),
    image: caps.includes("PUBLISH_IMAGE") || caps.includes("PUBLISH_POST"),
    video: caps.includes("PUBLISH_VIDEO") || (platform === "YouTube" || platform === "TikTok"),
    schedule: caps.includes("SCHEDULE") || caps.includes("SCHEDULE_POST"),
  };
}

export async function startProviderConnect(provider, accountId, returnTo = "/accounts", account = null) {
  const res = await fetch(`/api/oauth/${encodeURIComponent(String(provider).toLowerCase())}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, returnTo, account }),
  });
  return res.json();
}

export async function connectionAction(action, accountId, extra = {}) {
  const res = await fetch("/api/connections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, accountId, ...extra }),
  });
  return res.json();
}

export async function refreshAccountAnalytics(accountId, extra = {}) {
  const res = await fetch("/api/analytics/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, ...extra }),
  });
  return res.json();
}

export async function requestProviderPublish({ contentId, accountId, approved = false }) {
  const res = await fetch("/api/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentId, accountId, approved }),
  });
  return res.json();
}
