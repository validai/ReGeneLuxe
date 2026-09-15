/**
 * Normalize provider metric payloads into ReGeneLuxe canonical keys.
 * Unsupported metrics are null — never coerced to 0.
 */

export const CANONICAL_METRICS = [
  "views",
  "impressions",
  "reach",
  "likes",
  "comments",
  "shares",
  "saves",
  "clicks",
  "profileVisits",
  "followers",
  "followersGained",
  "subscribers",
  "subscribersGained",
  "watchTimeSeconds",
  "averageViewDuration",
  "completionRate",
  "streams",
  "playlistAdds",
  "engagementRate",
];

const ALIASES = {
  viewCount: "views",
  view_count: "views",
  impression_count: "impressions",
  reach_count: "reach",
  like_count: "likes",
  likes_count: "likes",
  favoritings_count: "likes",
  comment_count: "comments",
  comments_count: "comments",
  share_count: "shares",
  shares_count: "shares",
  save_count: "saves",
  saves_count: "saves",
  click_count: "clicks",
  profile_visits: "profileVisits",
  follower_count: "followers",
  followers_count: "followers",
  subscriberCount: "subscribers",
  subscriber_count: "subscribers",
  followers_gained: "followersGained",
  watchTime: "watchTimeSeconds",
  watch_time: "watchTimeSeconds",
  average_view_duration: "averageViewDuration",
  completion_rate: "completionRate",
  playback_count: "streams",
  play_count: "streams",
  plays: "streams",
  playlist_adds: "playlistAdds",
  engagement_rate: "engagementRate",
};

function toNumberOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeMetrics(input = {}, { fillMissingNull = false } = {}) {
  const metrics = {};
  for (const [key, value] of Object.entries(input || {})) {
    const canonical = ALIASES[key] || (CANONICAL_METRICS.includes(key) ? key : null);
    if (!canonical) continue;
    metrics[canonical] = toNumberOrNull(value);
  }
  if (fillMissingNull) {
    for (const key of CANONICAL_METRICS) {
      if (!(key in metrics)) metrics[key] = null;
    }
  }
  return metrics;
}

export function buildMetricSnapshotRecord({
  accountId = null,
  campaignId = null,
  contentId = null,
  platform = "",
  provider = "",
  source = "PROVIDER",
  metrics = {},
  capturedAt = new Date().toISOString(),
  providerUpdatedAt = null,
  freshness = null,
  raw = null,
} = {}) {
  const normalized = normalizeMetrics(metrics);
  return {
    accountId,
    campaignId,
    contentId,
    platform,
    provider,
    source,
    metrics: normalized,
    recordedAt: capturedAt,
    capturedAt,
    providerUpdatedAt,
    freshness: freshness || (source === "PROVIDER" ? "provider" : source.toLowerCase()),
    // Preserve provider-specific payload when valuable — never secrets.
    providerPayload: raw && typeof raw === "object"
      ? JSON.parse(JSON.stringify(raw, (k, v) => (
        /token|secret|authorization|password|apiKey/i.test(String(k)) ? undefined : v
      )))
      : null,
  };
}
