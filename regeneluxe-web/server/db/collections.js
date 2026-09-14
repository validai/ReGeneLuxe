/** Canonical collection names for the entities table. */
export const COLLECTIONS = {
  campaigns: "campaigns",
  accounts: "accounts",
  content: "content",
  inbox: "inbox",
  analytics: "analytics",
  queue: "queue",
  decisions: "decisions",
  activity: "activity",
  events: "events",
  settings: "settings",
  ui_prefs: "ui_prefs",
  campaign_snapshots: "campaign_snapshots",
  attention: "attention",
  approvals: "approvals",
  brain_runs: "brain_runs",
  monitor_runs: "monitor_runs",
  experiments: "experiments",
  campaign_results: "campaign_results",
  campaign_changes: "campaign_changes",
  publications: "publications",
  publication_attempts: "publication_attempts",
};

export const MUTABLE_COLLECTIONS = new Set([
  COLLECTIONS.campaigns,
  COLLECTIONS.accounts,
  COLLECTIONS.content,
  COLLECTIONS.settings,
]);

export const APPEND_ONLY_COLLECTIONS = new Set([
  COLLECTIONS.analytics,
  COLLECTIONS.decisions,
  COLLECTIONS.events,
  COLLECTIONS.activity,
  COLLECTIONS.publication_attempts,
  COLLECTIONS.brain_runs,
  COLLECTIONS.monitor_runs,
  "metric_snapshots",
]);
