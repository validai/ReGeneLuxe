import { emptyDecision } from "./domain.js";
import { listDecisions, saveDecision } from "./collectionRepository.js";
import { recordEvent } from "./events.js";
import { nowIso } from "./ids.js";

export const OUTCOME_LABELS = {
  POSITIVE: "POSITIVE",
  NEGATIVE: "NEGATIVE",
  INCONCLUSIVE: "INCONCLUSIVE",
  TOO_EARLY: "TOO_EARLY",
  NO_DATA: "NO_DATA",
};

/**
 * Persist a material Campaign Brain decision with evidence + expected outcome.
 */
export function recordDecisionJournal(entry = {}) {
  const decision = saveDecision(emptyDecision({
    campaignId: entry.campaignId || "",
    decision: entry.decision || entry.recommendation || "",
    evidence: entry.evidence || "",
    reason: entry.reason || "",
    expectedOutcome: entry.expectedOutcome || "",
    affectedContentIds: entry.affectedContentIds || [],
    affectedAccountIds: entry.affectedAccountIds || [],
    permissionRequired: entry.permissionRequired !== false,
    status: entry.status || "proposed",
    source: entry.source || "AI_INTERPRETATION",
    snapshotRef: entry.snapshotRef || "",
    confidence: entry.confidence ?? null,
    evidenceRefs: entry.evidenceRefs || [],
  }));
  recordEvent("AI_DECISION_APPLIED", {
    campaignId: decision.campaignId,
    message: decision.decision,
    meta: { decisionId: decision.id, status: decision.status },
  });
  return decision;
}

export function respondToDecision(decisionId, response, note = "") {
  const current = listDecisions().find((item) => item.id === decisionId);
  if (!current) return null;
  const status = response === "reject" || response === "rejected" ? "rejected" : "accepted";
  const next = saveDecision({
    ...current,
    status,
    userResponse: status,
    userResponseNote: note,
    respondedAt: nowIso(),
  });
  recordEvent("USER_OVERRIDE", {
    campaignId: next.campaignId,
    message: status === "rejected" ? `Rejected: ${next.decision}` : `Accepted: ${next.decision}`,
    meta: { decisionId: next.id },
  });
  return next;
}

/**
 * Evaluate expected vs actual after an observation window.
 * Uses supplied actual metrics text/numbers — never invents them.
 */
export function evaluateDecisionOutcome(decisionId, {
  actualOutcome = "",
  metricDelta = null,
  enoughEvidence = true,
  tooEarly = false,
} = {}) {
  const current = listDecisions().find((item) => item.id === decisionId);
  if (!current) return null;

  let outcome = OUTCOME_LABELS.INCONCLUSIVE;
  if (tooEarly) outcome = OUTCOME_LABELS.TOO_EARLY;
  else if (!enoughEvidence || (!actualOutcome && metricDelta == null)) outcome = OUTCOME_LABELS.NO_DATA;
  else if (typeof metricDelta === "number") {
    if (metricDelta > 0) outcome = OUTCOME_LABELS.POSITIVE;
    else if (metricDelta < 0) outcome = OUTCOME_LABELS.NEGATIVE;
    else outcome = OUTCOME_LABELS.INCONCLUSIVE;
  } else if (/positive|improved|up|increase|\+/i.test(actualOutcome)) outcome = OUTCOME_LABELS.POSITIVE;
  else if (/negative|worse|down|drop|decrease/i.test(actualOutcome)) outcome = OUTCOME_LABELS.NEGATIVE;

  return saveDecision({
    ...current,
    actualOutcome: actualOutcome || current.actualOutcome,
    outcomeLabel: outcome,
    evaluatedAt: nowIso(),
  });
}

export function listDecisionJournal(campaignId) {
  return listDecisions()
    .filter((item) => !campaignId || item.campaignId === campaignId)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

/**
 * Suppress duplicate recommendations unless new evidence or still blocking.
 */
export function shouldSuppressRecommendation(recommendation, {
  campaignId,
  decisions = listDecisions(),
  newEvidence = false,
  stillBlocking = false,
  withinHours = 72,
} = {}) {
  if (!recommendation) return false;
  if (newEvidence || stillBlocking) return false;
  const needle = String(recommendation).trim().toLowerCase();
  const cutoff = Date.now() - withinHours * 3600000;
  return decisions.some((item) => {
    if (campaignId && item.campaignId !== campaignId) return false;
    if (item.status === "rejected") {
      // Rejected advice stays suppressed without new evidence.
      return String(item.decision || "").trim().toLowerCase() === needle;
    }
    const stamp = new Date(item.createdAt || item.updatedAt || 0).getTime();
    if (Number.isNaN(stamp) || stamp < cutoff) return false;
    return String(item.decision || "").trim().toLowerCase() === needle;
  });
}

export function rejectedRecommendations(campaignId, decisions = listDecisions()) {
  return decisions
    .filter((item) => item.campaignId === campaignId && (item.status === "rejected" || item.userResponse === "rejected"))
    .map((item) => item.decision);
}
