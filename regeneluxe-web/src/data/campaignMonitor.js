import { nowIso } from "./ids.js";
import { listCampaigns } from "./campaignRepository.js";
import { listAccounts } from "./accountRepository.js";
import { listContent, listInbox, listSnapshots, listQueue, listDecisions } from "./collectionRepository.js";
import { optionLabels, GOAL_OPTIONS, SUCCESS_SIGNAL_OPTIONS, optionLabel } from "./options.js";
import { toDateKey } from "../utils/dates.js";
import { listEvents } from "./events.js";
import { compareCampaignSnapshots } from "./changeDetector.js";
import { readJson, writeJson, STORAGE_KEYS } from "./storage.js";

export { recordEvent, listEvents, EVENT_TYPES } from "./events.js";

export const ATTENTION_LEVELS = {
  INFO: "INFO",
  ACTION: "ACTION",
  WARNING: "WARNING",
  ERROR: "ERROR",
};

export const PROGRESS_LABELS = {
  PREPARING: "Preparing",
  SCHEDULED: "Scheduled",
  RUNNING: "Running",
  COLLECTING: "Collecting results",
  READY_TO_EVALUATE: "Ready to evaluate",
  ITERATING: "Iterating",
};

/** Map internal content statuses to simple operator labels. */
export function simpleContentLabel(status) {
  if (status === "IDEA") return "Idea";
  if (status === "PLANNED" || status === "DRAFTING") return "Draft";
  if (status === "READY") return "Ready";
  if (status === "SCHEDULED") return "Scheduled";
  if (status === "PUBLISHED") return "Published";
  if (status === "FAILED") return "Failed";
  if (status === "SKIPPED") return "Skipped";
  return String(status || "").replaceAll("_", " ") || "Draft";
}

export function simpleContentBucket(status) {
  if (status === "IDEA") return "ideas";
  if (status === "PLANNED" || status === "DRAFTING") return "drafts";
  if (status === "READY") return "ready";
  if (status === "SCHEDULED") return "scheduled";
  if (status === "PUBLISHED") return "published";
  if (status === "FAILED") return "failed";
  return "drafts";
}

function countByBucket(items) {
  const counts = { ideas: 0, drafts: 0, ready: 0, scheduled: 0, published: 0, failed: 0 };
  items.forEach((item) => {
    counts[simpleContentBucket(item.status)] += 1;
  });
  return counts;
}

function inferProgress(contentCounts, snaps, decisions) {
  if (contentCounts.published > 0 && snaps.length >= 3) {
    if (decisions.some((item) => item.status === "accepted" || item.status === "proposed")) return "ITERATING";
    return "READY_TO_EVALUATE";
  }
  if (contentCounts.published > 0) return "COLLECTING";
  if (contentCounts.scheduled > 0) return "RUNNING";
  if (contentCounts.ready > 0 || contentCounts.scheduled > 0) return "SCHEDULED";
  return "PREPARING";
}

function primaryMetricTotals(snaps) {
  const totals = {};
  snaps.forEach((snap) => {
    Object.entries(snap.metrics || {}).forEach(([key, value]) => {
      if (value == null || value === "") return;
      const number = Number(value);
      if (Number.isNaN(number)) return;
      totals[key] = (totals[key] || 0) + number;
    });
  });
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([key, value]) => ({ key, value }));
}

function strongestChannel(snaps, accounts) {
  const byAccount = {};
  snaps.forEach((snap) => {
    if (!snap.accountId) return;
    const score = Object.values(snap.metrics || {}).reduce((sum, value) => {
      const number = Number(value);
      return sum + (Number.isNaN(number) ? 0 : number);
    }, 0);
    byAccount[snap.accountId] = (byAccount[snap.accountId] || 0) + score;
  });
  const top = Object.entries(byAccount).sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  const account = accounts.find((item) => item.id === top[0]);
  if (!account) return null;
  return {
    accountId: account.id,
    label: `${account.platform} · ${account.handle || account.displayName}`,
    score: top[1],
  };
}

/**
 * Deterministic campaign state. AI consumes this; it does not invent it.
 */
export function buildCampaignStateSnapshot(campaign, {
  accounts = listAccounts(),
  content = listContent(),
  snapshots = listSnapshots(),
  queue = listQueue(),
  decisions = listDecisions(),
  now = new Date(),
} = {}) {
  const linked = accounts.filter((account) => (campaign.accountIds || []).includes(account.id));
  const campaignContent = content.filter((item) => item.campaignId === campaign.id);
  const contentCounts = countByBucket(campaignContent);
  const campaignSnaps = snapshots.filter((item) => (
    item.campaignId === campaign.id
    || campaignContent.some((entry) => entry.id === item.contentId)
  ));
  const campaignQueue = queue.filter((item) => item.campaignId === campaign.id);
  const campaignDecisions = decisions.filter((item) => item.campaignId === campaign.id);
  const today = toDateKey(now);
  const upcoming = campaignContent
    .filter((item) => item.status === "SCHEDULED" && item.scheduledAt)
    .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
  const overdue = upcoming.filter((item) => toDateKey(item.scheduledAt) < today);
  const waitingApproval = campaignContent.filter((item) => item.status === "READY");
  const failed = [
    ...campaignContent.filter((item) => item.status === "FAILED"),
    ...campaignQueue.filter((item) => item.state === "failed"),
  ];
  const connected = linked.filter((account) => account.connectionState === "CONNECTED");
  const unhealthy = linked.filter((account) => ["ERROR", "AUTH_EXPIRED"].includes(account.connectionState));
  const staleAnalytics = campaignSnaps.length === 0
    || campaignSnaps.every((snap) => {
      const age = now.getTime() - new Date(snap.recordedAt).getTime();
      return Number.isNaN(age) || age > 7 * 86400000;
    });

  const blockers = [];
  const opportunities = [];
  const nextActions = [];
  const attention = [];

  if (failed.length) {
    blockers.push(`${failed.length} publish failure${failed.length === 1 ? "" : "s"}`);
    attention.push({ level: ATTENTION_LEVELS.ERROR, message: failed[0].title || failed[0].failureReason || "Publication failed", href: "/queue" });
  }
  if (unhealthy.length) {
    blockers.push(`${unhealthy.length} account connection issue${unhealthy.length === 1 ? "" : "s"}`);
    attention.push({
      level: ATTENTION_LEVELS.WARNING,
      kind: "connection",
      accountId: unhealthy[0].id,
      message: `${unhealthy[0].handle || unhealthy[0].displayName} needs attention`,
      href: "/accounts",
    });
  }
  if (waitingApproval.length) {
    nextActions.push({
      label: `Approve ${waitingApproval[0].title || "content"}`,
      href: `/content/${waitingApproval[0].id}`,
      severity: ATTENTION_LEVELS.ACTION,
    });
    attention.push({
      level: ATTENTION_LEVELS.ACTION,
      kind: "approval",
      contentId: waitingApproval[0].id,
      message: `${waitingApproval.length} item${waitingApproval.length === 1 ? "" : "s"} waiting for approval`,
      href: `/content/${waitingApproval[0].id}`,
    });
  }
  if (overdue.length) {
    nextActions.push({
      label: `Review overdue post`,
      href: `/content/${overdue[0].id}`,
      severity: ATTENTION_LEVELS.WARNING,
    });
  }
  if (contentCounts.ideas + contentCounts.drafts === 0 && contentCounts.scheduled === 0 && contentCounts.published === 0) {
    blockers.push("No content prepared");
    nextActions.push({
      label: "Create first post",
      href: `/content/new?campaignId=${campaign.id}`,
      severity: ATTENTION_LEVELS.ACTION,
    });
  }
  if (campaignSnaps.length >= 3) {
    opportunities.push("Enough results to evaluate");
    attention.push({
      level: ATTENTION_LEVELS.INFO,
      message: "Enough results to evaluate",
      href: `/campaigns/${campaign.id}?tab=results`,
    });
  }
  const proposed = campaignDecisions.find((item) => item.status === "proposed");
  if (proposed) {
    nextActions.push({
      label: proposed.decision,
      href: `/campaigns/${campaign.id}`,
      severity: ATTENTION_LEVELS.ACTION,
    });
  }
  if (!nextActions.length && upcoming[0]) {
    nextActions.push({
      label: `Next: ${upcoming[0].title || "scheduled post"}`,
      href: `/content/${upcoming[0].id}`,
      severity: ATTENTION_LEVELS.INFO,
    });
  }

  const progressKey = inferProgress(contentCounts, campaignSnaps, campaignDecisions);
  const strongest = strongestChannel(campaignSnaps, linked);
  const goals = optionLabels(GOAL_OPTIONS, campaign.intake?.goals || []);
  const success = campaign.intake?.success?.primary
    ? optionLabel(SUCCESS_SIGNAL_OPTIONS, campaign.intake.success.primary)
    : "";

  const observations = [];
  if (campaign.active === false) {
    observations.push("Campaign is inactive.");
  } else if (progressKey === "PREPARING") {
    observations.push("Still preparing content.");
  } else if (progressKey === "RUNNING" || progressKey === "SCHEDULED") {
    observations.push(`Campaign is ${PROGRESS_LABELS[progressKey].toLowerCase()}.`);
  } else {
    observations.push(`Campaign is ${PROGRESS_LABELS[progressKey].toLowerCase()}.`);
  }
  if (contentCounts.scheduled) {
    observations.push(`${contentCounts.scheduled} post${contentCounts.scheduled === 1 ? "" : "s"} scheduled.`);
  }
  if (strongest) {
    observations.push(`${strongest.label} is currently strongest for this campaign.`);
  }
  if (campaignSnaps[0]) {
    observations.push(`Latest metrics recorded ${new Date(campaignSnaps[0].recordedAt).toLocaleString()}.`);
  } else {
    observations.push("No recorded performance yet.");
  }
  if (waitingApproval.length) {
    observations.push(`${waitingApproval.length} post${waitingApproval.length === 1 ? "" : "s"} need approval.`);
  }

  return {
    campaignId: campaign.id,
    observedAt: nowIso(),
    active: campaign.active !== false,
    name: campaign.name,
    objective: campaign.objective || campaign.intake?.promoted?.title || goals[0] || "",
    successSignals: success ? [success] : goals.slice(0, 3),
    progressLabel: PROGRESS_LABELS[progressKey],
    progressKey,
    accounts: {
      participating: linked.map((account) => ({
        id: account.id,
        label: `${account.platform} · ${account.handle || account.displayName}`,
        connectionState: account.connectionState || "MANUAL_ONLY",
      })),
      connected: connected.length,
      unhealthy: unhealthy.length,
      stale: staleAnalytics,
    },
    content: contentCounts,
    publishing: {
      nextPost: upcoming[0]
        ? { id: upcoming[0].id, title: upcoming[0].title || "Untitled", scheduledAt: upcoming[0].scheduledAt }
        : null,
      overdue: overdue.length,
      failed: failed.length,
      gaps: contentCounts.scheduled === 0 && contentCounts.published === 0,
      today: campaignContent.filter((item) => toDateKey(item.scheduledAt) === today).length,
    },
    approvals: {
      waiting: waitingApproval.length,
      blocked: unhealthy.length > 0 && waitingApproval.length > 0,
    },
    analytics: {
      freshness: campaignSnaps[0]?.recordedAt || null,
      primaryMetrics: primaryMetricTotals(campaignSnaps),
      trends: [],
      anomalies: [],
      snapshotCount: campaignSnaps.length,
      strongestChannel: strongest,
    },
    experiments: {
      active: (campaign.intake?.testing?.hypotheses || []).length,
      awaitingResults: contentCounts.published > 0 && campaignSnaps.length < 3 ? 1 : 0,
      completed: campaignSnaps.length >= 3 ? 1 : 0,
    },
    campaignProgress: {
      expected: campaign.intake?.testing?.hypothesisText || "",
      actual: strongest ? `${strongest.label} leading` : "No comparison yet",
    },
    blockers,
    opportunities,
    recentChanges: listEvents({ campaignId: campaign.id }).slice(0, 5),
    nextActions: nextActions.slice(0, 3),
    attention,
    summary: observations.join(" "),
  };
}

export function buildAttentionFeed({
  campaigns = listCampaigns(),
  accounts = listAccounts(),
  content = listContent(),
  queue = listQueue(),
  inbox = listInbox(),
  now = new Date(),
} = {}) {
  const items = [];
  const today = toDateKey(now);
  const approvals = content.filter((item) => item.status === "READY");
  const failures = [
    ...content.filter((item) => item.status === "FAILED"),
    ...queue.filter((item) => item.state === "failed"),
  ];
  const connectionIssues = accounts.filter((account) => ["ERROR", "AUTH_EXPIRED"].includes(account.connectionState));
  const inboxOpen = inbox.filter((item) => !item.handled);
  const scheduledToday = content.filter((item) => toDateKey(item.scheduledAt) === today);

  failures.slice(0, 3).forEach((item) => {
    items.push({
      level: ATTENTION_LEVELS.ERROR,
      message: item.title || item.failureReason || "Publication failed",
      href: "/queue",
    });
  });
  connectionIssues.forEach((account) => {
    items.push({
      level: ATTENTION_LEVELS.WARNING,
      kind: "connection",
      accountId: account.id,
      message: `${account.handle || account.displayName} connection needs attention`,
      href: "/accounts",
    });
  });
  if (approvals[0]) {
    items.push({
      level: ATTENTION_LEVELS.ACTION,
      kind: "approval",
      contentId: approvals[0].id,
      message: `${approvals.length} item${approvals.length === 1 ? "" : "s"} waiting for approval`,
      href: `/content/${approvals[0].id}`,
    });
  }
  if (inboxOpen[0]) {
    items.push({
      level: ATTENTION_LEVELS.ACTION,
      message: `${inboxOpen.length} inbox item${inboxOpen.length === 1 ? "" : "s"} need a reply`,
      href: "/inbox",
    });
  }
  if (scheduledToday.length) {
    items.push({
      level: ATTENTION_LEVELS.INFO,
      message: `${scheduledToday.length} post${scheduledToday.length === 1 ? "" : "s"} publishing today`,
      href: "/calendar",
    });
  }

  const active = campaigns.filter((campaign) => campaign.active !== false);
  active.slice(0, 3).forEach((campaign) => {
    const snap = buildCampaignStateSnapshot(campaign, { accounts, content, now });
    if (snap.analytics.strongestChannel) {
      items.push({
        level: ATTENTION_LEVELS.INFO,
        message: `${campaign.name}: ${snap.analytics.strongestChannel.label} is strongest`,
        href: `/campaigns/${campaign.id}`,
      });
    }
  });

  return items.slice(0, 8);
}

export function shouldRunCampaignBrain(snapshot, previous = null) {
  if (!snapshot) return { run: false, reason: "No campaign state." };
  if (snapshot.approvals.waiting > 0) return { run: true, reason: "Approvals waiting." };
  if (snapshot.publishing.failed > 0) return { run: true, reason: "Publish failure." };
  if (snapshot.accounts.unhealthy > 0) return { run: true, reason: "Account connection issue." };
  if (snapshot.experiments.completed > 0 && (!previous || previous.experiments.completed < snapshot.experiments.completed)) {
    return { run: true, reason: "Experiment ready to evaluate." };
  }
  if (!previous) return { run: false, reason: "Initial snapshot only." };
  if (previous.content.published !== snapshot.content.published) return { run: true, reason: "New publication." };
  if (previous.analytics.snapshotCount !== snapshot.analytics.snapshotCount) return { run: true, reason: "New analytics." };
  if (JSON.stringify(previous.blockers) !== JSON.stringify(snapshot.blockers)) return { run: true, reason: "Blockers changed." };
  return { run: false, reason: "No meaningful change." };
}

export function nextBestAction(snapshot) {
  return snapshot?.nextActions?.[0] || null;
}

export function rememberSnapshot(snapshot) {
  if (!snapshot?.campaignId) return null;
  const all = readJson(STORAGE_KEYS.campaignSnapshots, {});
  const previous = all[snapshot.campaignId] || null;
  all[snapshot.campaignId] = snapshot;
  writeJson(STORAGE_KEYS.campaignSnapshots, all);
  return previous;
}

export function readRememberedSnapshot(campaignId) {
  const all = readJson(STORAGE_KEYS.campaignSnapshots, {});
  return all?.[campaignId] || null;
}

export function observeCampaign(campaign, deps = {}) {
  const current = buildCampaignStateSnapshot(campaign, deps);
  const previous = readRememberedSnapshot(campaign.id);
  const diff = compareCampaignSnapshots(previous, current);
  rememberSnapshot(current);
  const trigger = shouldRunCampaignBrain(current, previous);
  const run = Boolean(trigger.run || diff.meaningful);
  return {
    snapshot: current,
    previous,
    changes: diff.changes,
    meaningful: diff.meaningful,
    shouldRunBrain: run,
    reason: trigger.run ? trigger.reason : (diff.meaningful ? "Meaningful campaign change." : trigger.reason),
  };
}
