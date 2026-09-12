import { emptyContentItem, emptyDecision, emptyVariant } from "../domain.js";
import { buildCampaignContext } from "../campaignContext.js";
import { completeAi } from "../runtimeClient.js";
import { sanitizeAiContext, validateCampaignPlan, validateBrainOutput } from "./validator.js";
import {
  saveContent,
  saveDecision,
  saveActivity,
  listSnapshots,
  listContent,
  listDecisions,
} from "../collectionRepository.js";
import { optionLabels, FORMAT_OPTIONS, GOAL_OPTIONS } from "../options.js";
import { analyzeCampaignChannels } from "./channelIntelligence.js";
import { coordinateCampaign, buildIterationCycle } from "./coordination.js";
import { scheduleContent } from "../publishing.js";
import { recordEvent } from "../events.js";
import { observeCampaign, shouldRunCampaignBrain } from "../campaignMonitor.js";
import { buildCampaignStrategySummary, missingStrategyEssentials } from "../campaignSummary.js";
import { buildAccountIntelligenceSummary, buildCrossCampaignLearning } from "../accountIntelligence.js";
import {
  recordDecisionJournal,
  shouldSuppressRecommendation,
  rejectedRecommendations,
  respondToDecision,
  evaluateDecisionOutcome,
} from "../decisionJournal.js";
import { getSettings } from "../settingsRepository.js";

export { analyzeCampaignChannels } from "./channelIntelligence.js";
export { coordinateCampaign, buildIterationCycle } from "./coordination.js";

function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setMinutes(0, 0, 0);
  return date.toISOString().slice(0, 16);
}

export function buildStrategyPlan(campaign, accounts = []) {
  const context = buildCampaignContext(campaign, accounts);
  const formats = campaign.intake?.contentFormats?.length
    ? campaign.intake.contentFormats
    : ["reel", "short"];
  const ideas = formats.map((format, index) => emptyContentItem({
    campaignId: campaign.id,
    title: `${context.promotedContent.title || campaign.name} · ${optionLabels(FORMAT_OPTIONS, [format])[0] || format}`,
    concept: context.purpose.join(" + ") || campaign.objective,
    format,
    caption: context.messaging.keyMessage || "",
    hook: context.messaging.themes[0] || "",
    cta: context.messaging.cta || "",
    accountIds: [...(campaign.accountIds || [])],
    status: "IDEA",
    provenance: "CALCULATED",
    variants: (campaign.accountIds || []).map((accountId) => {
      const account = accounts.find((item) => item.id === accountId);
      return emptyVariant({
        platform: account?.platform || "",
        accountId,
        caption: context.messaging.keyMessage || "",
        cta: context.messaging.cta || "",
      });
    }),
    scheduledAt: addDaysIso(index + 1),
    notes: index === 0 ? "Created from current strategy. Not AI-generated." : "",
  }));

  return {
    source: "CALCULATED",
    objective: context.purpose.join(" + ") || campaign.objective || campaign.name,
    durationDays: Math.max(formats.length * 2, 7),
    channelRoles: context.accounts.map((account) => ({
      accountId: account.id,
      role: account.missing ? "removed" : (account.role || account.platform),
    })),
    contentIdeas: ideas,
    publishingCadence: `About ${formats.length} posts across the first week.`,
    successMetrics: context.successSignals.primary
      ? [context.successSignals.primary]
      : optionLabels(GOAL_OPTIONS, campaign.intake?.goals || []),
    testingHypotheses: context.testing.hypothesis ? [context.testing.hypothesis] : [],
  };
}

/**
 * Apply a plan into content records.
 * mode:
 *  ADVISORY — should not call this (caller stores proposal only)
 *  ASSISTED — create drafts/ideas; schedule only when scheduledAt present and permission allows drafts
 *  AUTOPILOT — may schedule into queue when account publishPermission allows
 */
export function applyPlan(plan, campaign, { mode = "ASSISTED", accounts = [], schedule = false } = {}) {
  const created = (plan.contentIdeas || []).map((idea, index) => {
    const base = saveContent({
      ...idea,
      campaignId: campaign.id,
      status: idea.status || "IDEA",
      scheduledAt: idea.scheduledAt || (schedule ? addDaysIso(index + 1) : ""),
    });
    if (schedule && base.scheduledAt && mode === "AUTOPILOT") {
      return scheduleContent(base, base.scheduledAt);
    }
    return base;
  });

  saveActivity({
    campaignId: campaign.id,
    type: "plan",
    message: `${created.length} content records created from ${plan.source === "AI" ? "Campaign Brain" : "current strategy"}${schedule && mode === "AUTOPILOT" ? " and queued" : ""}.`,
    source: plan.source,
  });

  if (plan.source === "AI") {
    saveDecision(emptyDecision({
      campaignId: campaign.id,
      decision: "Generated campaign plan",
      evidence: plan.objective,
      reason: mode === "AUTOPILOT"
        ? "Autopilot applied plan into content and queue where allowed."
        : "Assisted mode created reviewable records.",
      affectedContentIds: created.map((item) => item.id),
      affectedAccountIds: accounts.map((account) => account.id),
      permissionRequired: mode !== "AUTOPILOT",
      status: "accepted",
      source: "AI_INTERPRETATION",
    }));
    recordEvent("AI_DECISION_APPLIED", {
      campaignId: campaign.id,
      message: "Campaign plan applied",
      meta: { mode, count: created.length },
    });
  }

  return created;
}

export async function generateCampaignWithAi(campaign, accounts = []) {
  const channels = analyzeCampaignChannels(campaign, accounts);
  const context = sanitizeAiContext({
    ...buildCampaignContext(campaign, accounts),
    channels: channels.channels,
    snapshots: listSnapshots().filter((item) => item.campaignId === campaign.id || (campaign.accountIds || []).includes(item.accountId)),
    library: listContent().filter((item) => item.campaignId === campaign.id),
    lessons: listDecisions().filter((item) => item.campaignId === campaign.id || item.actualOutcome),
  });

  const result = await completeAi({
    task: "campaign_plan",
    context,
  });

  if (!result.ok) {
    return result;
  }

  const checked = validateCampaignPlan(result.plan);
  if (!checked.ok) {
    return { ok: false, error: "AI output was not a usable campaign plan", missing: checked.missing };
  }

  const ideas = (checked.plan.contentIdeas || []).map((idea, index) => emptyContentItem({
    ...idea,
    campaignId: campaign.id,
    provenance: "AI",
    status: "IDEA",
    scheduledAt: idea.scheduledAt || addDaysIso(index + 1),
  }));

  return {
    ok: true,
    source: "AI",
    plan: {
      ...checked.plan,
      contentIdeas: ideas,
      source: "AI",
      durationDays: checked.plan.durationDays || 7,
      publishingCadence: checked.plan.publishingCadence || "",
    },
  };
}

export function analyzeCampaign(campaign, accounts = []) {
  const snapshots = listSnapshots().filter((item) => item.campaignId === campaign.id || item.contentId);
  if (!snapshots.length) {
    return {
      available: false,
      reason: "No recorded analytics. AI will not invent metrics.",
    };
  }
  const content = listContent().filter((item) => item.campaignId === campaign.id);
  const channels = analyzeCampaignChannels(campaign, accounts);
  return {
    available: true,
    source: "CALCULATED",
    snapshotCount: snapshots.length,
    contentCount: content.length,
    accounts: accounts.filter((account) => (campaign.accountIds || []).includes(account.id)).map((account) => account.handle || account.displayName),
    channels: channels.channels,
  };
}

export function historicLessons(accountId) {
  return listDecisions().filter((decision) => (
    decision.actualOutcome
    && (!accountId || (decision.affectedAccountIds || []).includes(accountId))
  ));
}

export function proposeIteration(campaign, snapshots = listSnapshots()) {
  const cycle = buildIterationCycle(campaign, snapshots, listContent());
  if (!cycle.available) {
    return {
      available: false,
      reason: cycle.reason,
    };
  }
  return {
    available: true,
    source: "CALCULATED",
    cycle: cycle.cycle,
    decision: cycle.decision,
  };
}

export function proposeCoordination(campaign, accounts = []) {
  return coordinateCampaign(campaign, accounts);
}

export function persistProposedDecision(decision) {
  return saveDecision(decision);
}

export function canApplyAiPlan(mode) {
  return mode !== "ADVISORY";
}

export function canAutoSchedule(mode) {
  return mode === "AUTOPILOT";
}

export function explainMode(mode) {
  if (mode === "ADVISORY") return "Recommendations only. No records are written.";
  if (mode === "AUTOPILOT") return "May create plans, drafts, and schedules within account publish permissions. Provider publish still requires a real connection.";
  return "May create plans, drafts, and schedules for review. Publishing still needs approval.";
}

export function buildBrainInput(campaign, accounts = [], options = {}) {
  const observation = options.observation || observeCampaign(campaign, { accounts });
  const mode = options.mode || getSettings().aiMode || "ASSISTED";
  const linked = accounts.filter((account) => (campaign.accountIds || []).includes(account.id));
  return sanitizeAiContext({
    mode,
    strategy: buildCampaignStrategySummary(campaign, accounts),
    clarificationQuestions: missingStrategyEssentials(campaign, accounts),
    snapshot: observation.snapshot,
    previousSnapshot: observation.previous,
    changes: observation.changes,
    accounts: linked.map((account) => ({
      id: account.id,
      platform: account.platform,
      handle: account.handle || account.displayName,
      connectionState: account.connectionState,
      publishPermission: account.publishPermission,
      capabilities: account.capabilities || [],
    })),
    accountIntelligence: linked.map((account) => buildAccountIntelligenceSummary(account)),
    crossCampaignLearning: buildCrossCampaignLearning(),
    recentContent: listContent().filter((item) => item.campaignId === campaign.id).slice(0, 40),
    analytics: listSnapshots().filter((item) => item.campaignId === campaign.id || (campaign.accountIds || []).includes(item.accountId)).slice(0, 40),
    priorDecisions: listDecisions().filter((item) => item.campaignId === campaign.id).slice(0, 20),
    rejectedAdvice: rejectedRecommendations(campaign.id),
    userOverrides: listDecisions().filter((item) => item.campaignId === campaign.id && item.userResponse),
  });
}

export function applyBrainOutput(campaign, rawOutput, { mode } = {}) {
  const checked = validateBrainOutput(rawOutput);
  if (!checked.ok) {
    return { ok: false, error: "AI output was not usable", missing: checked.missing };
  }
  const output = checked.value;
  const aiMode = mode || getSettings().aiMode || "ASSISTED";
  const recommendation = typeof output.nextBestAction === "string"
    ? output.nextBestAction
    : output.nextBestAction?.label || output.recommendations?.[0] || "";

  if (recommendation && shouldSuppressRecommendation(recommendation, { campaignId: campaign.id })) {
    return {
      ok: true,
      suppressed: true,
      output,
      message: "Similar recommendation already pending or recently rejected.",
    };
  }

  let decision = null;
  if (recommendation && canApplyAiPlan(aiMode)) {
    decision = recordDecisionJournal({
      campaignId: campaign.id,
      decision: recommendation,
      evidence: (output.evidenceRefs || []).join("; ") || output.campaignSummary,
      reason: (output.findings || []).slice(0, 3).join(" "),
      expectedOutcome: output.nextBestAction?.expectedOutcome || "",
      status: aiMode === "AUTOPILOT" ? "accepted" : "proposed",
      confidence: output.confidence,
      evidenceRefs: output.evidenceRefs,
      permissionRequired: aiMode !== "AUTOPILOT",
    });
  }

  saveActivity({
    campaignId: campaign.id,
    type: "brain",
    message: output.campaignSummary || "Campaign Brain update",
    source: "AI_INTERPRETATION",
  });

  return { ok: true, output, decision, suppressed: false };
}

export async function runCampaignBrain(campaign, accounts = [], { force = false, mode } = {}) {
  const observation = observeCampaign(campaign, { accounts });
  if (!force && !observation.shouldRunBrain) {
    return {
      ok: true,
      skipped: true,
      reason: observation.reason,
      snapshot: observation.snapshot,
    };
  }

  const context = buildBrainInput(campaign, accounts, { observation, mode });
  const result = await completeAi({ task: "campaign_brain", context });

  if (!result.ok) {
    const snapshot = observation.snapshot;
    const next = snapshot.nextActions?.[0];
    const fallback = {
      campaignSummary: snapshot.summary || "Campaign state reviewed.",
      importantChanges: observation.changes.map((item) => item.message),
      findings: snapshot.blockers.concat(snapshot.opportunities).slice(0, 5),
      nextBestAction: next ? { label: next.label, href: next.href } : null,
      recommendations: snapshot.nextActions.map((item) => item.label),
      contentChanges: [],
      schedulingChanges: [],
      experimentActions: [],
      approvalRequests: snapshot.approvals.waiting
        ? [`${snapshot.approvals.waiting} item(s) waiting for approval`]
        : [],
      warnings: snapshot.blockers,
      confidence: 0.4,
      evidenceRefs: [`snapshot:${snapshot.observedAt}`],
    };
    return {
      ok: true,
      source: "CALCULATED",
      unavailable: true,
      error: result.error,
      ...applyBrainOutput(campaign, fallback, { mode }),
      observation,
    };
  }

  const payload = result.brain || result.output || result.plan || result;
  return {
    ok: true,
    source: "AI",
    ...applyBrainOutput(campaign, payload, { mode }),
    observation,
  };
}

export {
  respondToDecision,
  evaluateDecisionOutcome,
  shouldRunCampaignBrain,
  observeCampaign,
  validateBrainOutput,
};
