import { analyzeCampaignChannels } from "./channelIntelligence.js";
import { emptyDecision } from "../domain.js";
import { listSnapshots, listContent } from "../collectionRepository.js";

/**
 * Cross-channel coordination proposals from recorded evidence only.
 */
export function coordinateCampaign(campaign, accounts = []) {
  const channelReport = analyzeCampaignChannels(campaign, accounts);
  if (!channelReport.available) {
    return {
      available: false,
      reason: "No channel evidence yet. Campaign Brain will not invent cross-platform changes.",
      proposals: [],
    };
  }

  const ranked = channelReport.channels
    .filter((channel) => channel.strongestMetric)
    .sort((a, b) => (b.strongestMetric?.total || 0) - (a.strongestMetric?.total || 0));

  const proposals = [];
  if (ranked[0]) {
    proposals.push({
      action: "continue",
      accountId: ranked[0].accountId,
      platform: ranked[0].platform,
      reason: `${ranked[0].handle} leads on recorded ${ranked[0].strongestMetric.key}.`,
      evidence: `${ranked[0].snapshotCount} snapshots`,
    });
  }
  if (ranked[1]) {
    proposals.push({
      action: "adjust",
      accountId: ranked[1].accountId,
      platform: ranked[1].platform,
      reason: `${ranked[1].handle} trails the lead channel. Review hook, CTA, or format before the next cycle.`,
      evidence: ranked[1].strongestMetric
        ? `${ranked[1].strongestMetric.key} ${ranked[1].strongestMetric.total}`
        : "Secondary channel",
    });
  }

  const weakFormats = channelReport.channels
    .filter((channel) => channel.contentCount > 0 && channel.publishedCount === 0);
  weakFormats.forEach((channel) => {
    proposals.push({
      action: "test",
      accountId: channel.accountId,
      platform: channel.platform,
      reason: `${channel.handle} has planned content but no published results yet.`,
      evidence: `${channel.contentCount} content records`,
    });
  });

  return {
    available: proposals.length > 0,
    source: "CALCULATED",
    channels: channelReport.channels,
    proposals,
    decision: emptyDecision({
      campaignId: campaign.id,
      decision: proposals[0]
        ? `Coordinate: ${proposals.map((item) => `${item.action} ${item.platform}`).join(" · ")}`
        : "No coordination change yet.",
      evidence: `${channelReport.channels.length} channels reviewed`,
      reason: "Compared recorded account evidence only.",
      affectedAccountIds: proposals.map((item) => item.accountId).filter(Boolean),
      expectedOutcome: "Operator reviews channel emphasis before the next publish cycle.",
      permissionRequired: true,
      status: "proposed",
      source: "CALCULATED",
    }),
  };
}

export function buildIterationCycle(campaign, snapshots = listSnapshots(), content = listContent()) {
  const campaignSnaps = snapshots.filter((item) => (
    item.campaignId === campaign.id
    || content.some((entry) => entry.id === item.contentId && entry.campaignId === campaign.id)
  ));
  const campaignContent = content.filter((item) => item.campaignId === campaign.id);

  if (!campaignSnaps.length) {
    return {
      available: false,
      reason: "No recorded analytics. Iteration requires observe → measure evidence.",
      cycle: null,
    };
  }

  const metricPairs = campaignSnaps.flatMap((item) =>
    Object.entries(item.metrics || {}).filter(([, value]) => value != null && value !== "")
  );
  const top = metricPairs.sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  const published = campaignContent.filter((item) => item.status === "PUBLISHED");
  const ideas = campaignContent.filter((item) => ["IDEA", "PLANNED", "DRAFTING"].includes(item.status));

  const adjustments = [];
  if (top) {
    adjustments.push({
      type: "repeat",
      message: `Repeat approaches that drove recorded ${top[0]}.`,
      evidence: `${top[0]} = ${top[1]}`,
    });
  }
  if (published.length && ideas.length) {
    adjustments.push({
      type: "promote",
      message: `Move ${ideas.length} draft idea${ideas.length === 1 ? "" : "s"} into the next schedule after reviewing winners.`,
      evidence: `${published.length} published · ${ideas.length} drafts`,
    });
  }
  if (!published.length) {
    adjustments.push({
      type: "publish",
      message: "Publish or mark results for planned content before expecting iteration.",
      evidence: `${campaignContent.length} content records`,
    });
  }

  return {
    available: true,
    source: "CALCULATED",
    cycle: {
      plan: campaign.objective || campaign.name,
      publish: published.length,
      observe: campaignSnaps.length,
      measure: top ? { key: top[0], value: Number(top[1]) } : null,
      analyze: top ? `Strongest recorded signal is ${top[0]}.` : "Snapshots exist without populated metrics.",
      learn: adjustments.map((item) => item.message),
      adjust: adjustments,
      next: adjustments[0]?.message || "Review recorded results before changing the plan.",
    },
    decision: emptyDecision({
      campaignId: campaign.id,
      decision: adjustments[0]?.message || "Iteration review ready",
      evidence: `${campaignSnaps.length} snapshots · ${published.length} published`,
      reason: "Closed-loop proposal from recorded performance only.",
      expectedOutcome: "Next content cycle emphasizes winning signals.",
      permissionRequired: true,
      status: "proposed",
      source: "CALCULATED",
    }),
  };
}
