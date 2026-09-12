import { listSnapshots, listContent, listDecisions } from "./collectionRepository.js";
import { buildAccountBaseline } from "./performanceCompare.js";

/**
 * Internal account intelligence summary — not a setup form.
 */
export function buildAccountIntelligenceSummary(account, {
  snapshots = listSnapshots(),
  content = listContent(),
  decisions = listDecisions(),
} = {}) {
  if (!account) return null;
  const accountSnaps = snapshots.filter((item) => item.accountId === account.id);
  const accountContent = content.filter((item) => (item.accountIds || []).includes(account.id));
  const baseline = buildAccountBaseline(accountSnaps);
  const byFormat = {};
  accountContent.forEach((item) => {
    const key = item.format || "unknown";
    byFormat[key] = (byFormat[key] || 0) + 1;
  });
  const bestFormat = Object.entries(byFormat).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const lessons = decisions.filter((item) => (
    item.actualOutcome
    && (item.affectedAccountIds || []).includes(account.id)
  ));

  const strengths = [];
  const weaknesses = [];
  if (baseline.available) strengths.push("Enough history for a recent average baseline");
  else weaknesses.push("Not enough analytics for a stable baseline");
  if (["ERROR", "AUTH_EXPIRED"].includes(account.connectionState)) {
    weaknesses.push("Connection needs attention");
  } else if (account.connectionState === "CONNECTED") {
    strengths.push("Connection healthy");
  } else {
    strengths.push("Manual publishing supported");
  }
  if (bestFormat) strengths.push(`Most used format: ${bestFormat}`);

  return {
    accountId: account.id,
    platform: account.platform,
    label: `${account.platform} · ${account.handle || account.displayName}`,
    connectionHealth: account.connectionState || "MANUAL_ONLY",
    strengths,
    weaknesses,
    bestFormats: bestFormat ? [bestFormat] : [],
    recentTrends: baseline.available ? baseline.averages : {},
    baseline,
    lessons: lessons.slice(0, 5).map((item) => ({
      decision: item.decision,
      outcome: item.outcomeLabel || item.actualOutcome,
    })),
    source: "CALCULATED",
  };
}

export function buildCrossCampaignLearning(accountId, {
  snapshots = listSnapshots(),
  content = listContent(),
  decisions = listDecisions(),
} = {}) {
  const relevantContent = content.filter((item) => !accountId || (item.accountIds || []).includes(accountId));
  const formatCounts = {};
  relevantContent.forEach((item) => {
    if (item.status !== "PUBLISHED") return;
    const key = item.format || "unknown";
    formatCounts[key] = (formatCounts[key] || 0) + 1;
  });
  const rankedFormats = Object.entries(formatCounts).sort((a, b) => b[1] - a[1]);
  const positive = decisions.filter((item) => item.outcomeLabel === "POSITIVE");
  const negative = decisions.filter((item) => item.outcomeLabel === "NEGATIVE");

  return {
    source: "CALCULATED",
    bestPerformingFormats: rankedFormats.slice(0, 3).map(([format, count]) => ({ format, publishedCount: count })),
    weakFormats: rankedFormats.slice(-2).filter(([, count]) => count > 0).map(([format]) => format),
    strongThemes: positive.slice(0, 5).map((item) => item.decision),
    weakThemes: negative.slice(0, 5).map((item) => item.decision),
    evidenceCount: {
      published: relevantContent.filter((item) => item.status === "PUBLISHED").length,
      snapshots: snapshots.filter((item) => !accountId || item.accountId === accountId).length,
      scoredDecisions: positive.length + negative.length,
    },
  };
}
