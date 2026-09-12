import { listContent, listSnapshots, listDecisions } from "../collectionRepository.js";
import { CONNECTION_LABELS } from "../domain.js";

/**
 * Per-account intelligence findings for Campaign Brain.
 * Never invents metrics. Uses only recorded snapshots, content history, and lessons.
 */
export function analyzeAccountChannel(account, { campaignId } = {}) {
  if (!account) {
    return { available: false, reason: "No account." };
  }

  const snaps = listSnapshots().filter((item) => item.accountId === account.id);
  const content = listContent().filter((item) => (
    (item.accountIds || []).includes(account.id)
    && (!campaignId || item.campaignId === campaignId)
  ));
  const lessons = listDecisions().filter((decision) => (
    decision.actualOutcome
    && (decision.affectedAccountIds || []).includes(account.id)
  ));

  const metricTotals = {};
  snaps.forEach((snap) => {
    Object.entries(snap.metrics || {}).forEach(([key, value]) => {
      if (value == null || value === "") return;
      const number = Number(value);
      if (Number.isNaN(number)) return;
      metricTotals[key] = (metricTotals[key] || 0) + number;
    });
  });

  const byFormat = {};
  content.forEach((item) => {
    const format = item.format || "unknown";
    byFormat[format] = byFormat[format] || { count: 0, published: 0 };
    byFormat[format].count += 1;
    if (item.status === "PUBLISHED") byFormat[format].published += 1;
  });

  const strongestMetric = Object.entries(metricTotals).sort((a, b) => b[1] - a[1])[0] || null;
  const strongestFormat = Object.entries(byFormat).sort((a, b) => b[1].published - a[1].published)[0] || null;

  return {
    available: snaps.length > 0 || content.length > 0 || lessons.length > 0,
    accountId: account.id,
    platform: account.platform,
    handle: account.handle || account.displayName,
    connection: CONNECTION_LABELS[account.connectionState] || "Manual",
    connectionState: account.connectionState || "MANUAL_ONLY",
    strengths: account.platformStrengths || "",
    weaknesses: account.platformWeaknesses || "",
    snapshotCount: snaps.length,
    contentCount: content.length,
    publishedCount: content.filter((item) => item.status === "PUBLISHED").length,
    strongestMetric: strongestMetric
      ? { key: strongestMetric[0], total: strongestMetric[1], source: "CALCULATED" }
      : null,
    strongestFormat: strongestFormat
      ? { format: strongestFormat[0], published: strongestFormat[1].published, source: "CALCULATED" }
      : null,
    lessons: lessons.map((item) => ({
      decision: item.decision,
      outcome: item.actualOutcome,
    })),
    findings: [
      snaps.length === 0 ? "No recorded analytics for this account." : null,
      strongestMetric ? `Strongest recorded metric: ${strongestMetric[0]}.` : null,
      strongestFormat ? `Most published format: ${strongestFormat[0]}.` : null,
      lessons[0] ? `Prior lesson: ${lessons[0].actualOutcome}` : null,
    ].filter(Boolean),
  };
}

export function analyzeCampaignChannels(campaign, accounts = []) {
  const linked = accounts.filter((account) => (campaign.accountIds || []).includes(account.id));
  const channels = linked.map((account) => analyzeAccountChannel(account, { campaignId: campaign.id }));
  return {
    campaignId: campaign.id,
    channels,
    available: channels.some((item) => item.available),
  };
}
