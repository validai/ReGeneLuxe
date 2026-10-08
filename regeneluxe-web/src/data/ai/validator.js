import { AI_EXCLUDED_FIELDS } from "../secretFields.js";
import { GMAIL_BRAIN_KEYS, GMAIL_PRIVATE_FIELDS, gmailBrainSignals, looksLikeGmailRecord } from "../gmailSignals.js";

export function validateCampaignPlan(plan) {
  if (!plan || typeof plan !== "object") {
    return { ok: false, missing: ["plan"] };
  }
  const missing = [];
  if (!plan.objective) missing.push("objective");
  if (!Array.isArray(plan.contentIdeas)) missing.push("contentIdeas");
  if (!Array.isArray(plan.successMetrics)) missing.push("successMetrics");
  return { ok: missing.length === 0, missing, plan };
}

export function validateBrainOutput(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, missing: ["payload"], value: null };
  }
  const missing = [];
  if (typeof payload.campaignSummary !== "string") missing.push("campaignSummary");
  if (!("nextBestAction" in payload)) missing.push("nextBestAction");
  if (payload.recommendations && !Array.isArray(payload.recommendations)) missing.push("recommendations");
  if (payload.findings && !Array.isArray(payload.findings)) missing.push("findings");
  if (payload.importantChanges && !Array.isArray(payload.importantChanges)) missing.push("importantChanges");
  if (payload.contentChanges && !Array.isArray(payload.contentChanges)) missing.push("contentChanges");
  if (payload.schedulingChanges && !Array.isArray(payload.schedulingChanges)) missing.push("schedulingChanges");
  if (payload.warnings && !Array.isArray(payload.warnings)) missing.push("warnings");
  if (payload.evidenceRefs && !Array.isArray(payload.evidenceRefs)) missing.push("evidenceRefs");
  if (missing.length) return { ok: false, missing, value: null };

  return {
    ok: true,
    missing: [],
    value: {
      campaignSummary: payload.campaignSummary,
      importantChanges: payload.importantChanges || [],
      findings: payload.findings || [],
      nextBestAction: payload.nextBestAction || null,
      recommendations: payload.recommendations || payload.contentRecommendations || [],
      contentChanges: payload.contentChanges || [],
      schedulingChanges: payload.schedulingChanges || payload.scheduleAdjustments || [],
      platformRecommendations: payload.platformRecommendations || [],
      experimentActions: payload.experimentActions || [],
      approvalRequests: payload.approvalRequests || [],
      warnings: payload.warnings || payload.risks || [],
      confidence: typeof payload.confidence === "number" ? payload.confidence : null,
      evidenceRefs: payload.evidenceRefs || [],
    },
  };
}

function redactGmail(object, key = "") {
  if (!object || typeof object !== "object") return;
  if (Array.isArray(object)) {
    for (let i = object.length - 1; i >= 0; i -= 1) {
      if (looksLikeGmailRecord(object[i])) object.splice(i, 1);
      else redactGmail(object[i]);
    }
    return;
  }
  delete object.gmail_messages;
  delete object.gmailMessages;
  if (key === "gmail" || looksLikeGmailRecord(object)) {
    const signals = gmailBrainSignals(object);
    Object.keys(object).forEach((field) => {
      if (!GMAIL_BRAIN_KEYS.includes(field)) delete object[field];
    });
    Object.assign(object, signals);
    GMAIL_PRIVATE_FIELDS.forEach((field) => {
      delete object[field];
    });
    return;
  }
  Object.entries(object).forEach(([childKey, value]) => {
    if (value && typeof value === "object") redactGmail(value, childKey);
  });
}

export function sanitizeAiContext(context) {
  const clone = JSON.parse(JSON.stringify(context || {}));
  const strip = (object) => {
    if (!object || typeof object !== "object") return;
    AI_EXCLUDED_FIELDS.forEach((key) => {
      if (key in object) delete object[key];
    });
    Object.values(object).forEach((value) => {
      if (value && typeof value === "object") strip(value);
    });
  };
  strip(clone);
  redactGmail(clone);
  return clone;
}
