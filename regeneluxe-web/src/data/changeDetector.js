/**
 * Deterministic comparison of CampaignStateSnapshots.
 * AI consumes these diffs; it does not invent them.
 */

export const CHANGE_TYPES = [
  "CONTENT_CREATED",
  "CONTENT_SCHEDULED",
  "CONTENT_PUBLISHED",
  "CONTENT_FAILED",
  "APPROVAL_REQUESTED",
  "APPROVAL_RESOLVED",
  "ANALYTICS_UPDATED",
  "PRIMARY_METRIC_UP",
  "PRIMARY_METRIC_DOWN",
  "CONTENT_OUTPERFORMING",
  "CONTENT_UNDERPERFORMING",
  "CONNECTION_LOST",
  "CONNECTION_RESTORED",
  "INBOX_ACTIVITY",
  "EXPERIMENT_READY",
  "CAMPAIGN_CONTEXT_CHANGED",
  "USER_OVERRIDE",
  "CONTENT_GAP",
  "PUBLISH_OVERDUE",
];

function metricMap(snapshot) {
  const map = {};
  (snapshot?.analytics?.primaryMetrics || []).forEach((item) => {
    map[item.key] = Number(item.value) || 0;
  });
  return map;
}

/**
 * Significant movement heuristic — not statistical significance.
 * Default: ≥20% relative change and absolute delta ≥3.
 */
export function classifyMetricMove(previous, current, {
  relativeThreshold = 0.2,
  absoluteFloor = 3,
} = {}) {
  if (previous == null || current == null || Number.isNaN(previous) || Number.isNaN(current)) {
    return "INSUFFICIENT_DATA";
  }
  const delta = current - previous;
  if (Math.abs(delta) < absoluteFloor) return "NORMAL";
  const base = Math.abs(previous) < 1 ? 1 : Math.abs(previous);
  const relative = Math.abs(delta) / base;
  if (relative < relativeThreshold) return "NORMAL";
  if (relative >= 0.75) return delta > 0 ? "OUTLIER" : "OUTLIER";
  return delta > 0 ? "MEANINGFUL_UP" : "MEANINGFUL_DOWN";
}

export function compareCampaignSnapshots(previous, current) {
  const changes = [];
  if (!current) return { meaningful: false, changes };

  if (!previous) {
    changes.push({ type: "CAMPAIGN_CONTEXT_CHANGED", message: "Initial campaign state observed" });
    return { meaningful: true, changes };
  }

  const prevContent = previous.content || {};
  const nextContent = current.content || {};
  const contentKeys = ["ideas", "drafts", "ready", "scheduled", "published", "failed"];
  contentKeys.forEach((key) => {
    const before = prevContent[key] || 0;
    const after = nextContent[key] || 0;
    if (after <= before) return;
    if (key === "scheduled") changes.push({ type: "CONTENT_SCHEDULED", message: `Scheduled content increased (${before} → ${after})`, delta: after - before });
    else if (key === "published") changes.push({ type: "CONTENT_PUBLISHED", message: `Published content increased (${before} → ${after})`, delta: after - before });
    else if (key === "failed") changes.push({ type: "CONTENT_FAILED", message: `Failed content increased (${before} → ${after})`, delta: after - before });
    else if (key === "ready" && after > before) changes.push({ type: "APPROVAL_REQUESTED", message: `${after - before} item(s) awaiting approval` });
    else if (key === "ideas" || key === "drafts") changes.push({ type: "CONTENT_CREATED", message: `New ${key} (${before} → ${after})`, delta: after - before });
  });

  if ((prevContent.ready || 0) > 0 && (nextContent.ready || 0) < (prevContent.ready || 0)) {
    changes.push({ type: "APPROVAL_RESOLVED", message: "Approval queue reduced" });
  }

  const prevSnaps = previous.analytics?.snapshotCount || 0;
  const nextSnaps = current.analytics?.snapshotCount || 0;
  if (nextSnaps > prevSnaps) {
    changes.push({ type: "ANALYTICS_UPDATED", message: "New analytics recorded", delta: nextSnaps - prevSnaps });
  }

  const beforeMetrics = metricMap(previous);
  const afterMetrics = metricMap(current);
  Object.keys({ ...beforeMetrics, ...afterMetrics }).forEach((key) => {
    const move = classifyMetricMove(beforeMetrics[key], afterMetrics[key]);
    if (move === "MEANINGFUL_UP" || move === "OUTLIER" && afterMetrics[key] > (beforeMetrics[key] || 0)) {
      changes.push({ type: "PRIMARY_METRIC_UP", message: `${key} moved up`, metric: key, classification: move });
    } else if (move === "MEANINGFUL_DOWN" || (move === "OUTLIER" && afterMetrics[key] < (beforeMetrics[key] || 0))) {
      changes.push({ type: "PRIMARY_METRIC_DOWN", message: `${key} moved down`, metric: key, classification: move });
    }
  });

  const prevUnhealthy = previous.accounts?.unhealthy || 0;
  const nextUnhealthy = current.accounts?.unhealthy || 0;
  if (nextUnhealthy > prevUnhealthy) {
    changes.push({ type: "CONNECTION_LOST", message: "Account connection issue detected" });
  } else if (nextUnhealthy < prevUnhealthy) {
    changes.push({ type: "CONNECTION_RESTORED", message: "Account connection recovered" });
  }

  if ((current.experiments?.completed || 0) > (previous.experiments?.completed || 0)) {
    changes.push({ type: "EXPERIMENT_READY", message: "Experiment ready to evaluate" });
  }

  if (current.publishing?.gaps && !previous.publishing?.gaps) {
    changes.push({ type: "CONTENT_GAP", message: "No upcoming scheduled content" });
  }
  if ((current.publishing?.overdue || 0) > (previous.publishing?.overdue || 0)) {
    changes.push({ type: "PUBLISH_OVERDUE", message: "Scheduled content is overdue" });
  }

  if (previous.objective !== current.objective || previous.active !== current.active) {
    changes.push({ type: "CAMPAIGN_CONTEXT_CHANGED", message: "Campaign definition or active state changed" });
  }

  const meaningfulTypes = new Set(CHANGE_TYPES);
  const meaningful = changes.some((item) => meaningfulTypes.has(item.type) && item.type !== "CAMPAIGN_CONTEXT_CHANGED")
    || changes.some((item) => item.type === "CAMPAIGN_CONTEXT_CHANGED" && previous);

  // Timestamp-only differences are ignored (we never compare observedAt here).
  return {
    meaningful: changes.length > 0 && meaningful,
    changes,
  };
}

export function shouldIgnoreAsNoise(previous, current) {
  if (!previous || !current) return false;
  const diff = compareCampaignSnapshots(previous, current);
  return !diff.meaningful;
}
