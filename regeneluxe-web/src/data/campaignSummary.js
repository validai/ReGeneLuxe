import {
  optionLabels,
  optionLabel,
  GOAL_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  AUDIENCE_RELATIONSHIP_OPTIONS,
  TONE_OPTIONS,
  SUCCESS_SIGNAL_OPTIONS,
  TESTING_OPTIONS,
  FORMAT_OPTIONS,
} from "./options.js";

/**
 * Deterministic compressed strategy summary for operators + AI.
 */
export function buildCampaignStrategySummary(campaign, accounts = []) {
  const intake = campaign?.intake || {};
  const linked = accounts.filter((account) => (campaign?.accountIds || []).includes(account.id));

  const goal = optionLabels(GOAL_OPTIONS, intake.goals || []).join(" + ")
    || campaign?.objective
    || "";
  const promoting = [
    optionLabel(CONTENT_TYPE_OPTIONS, intake.promoted?.primary),
    intake.promoted?.title,
  ].filter(Boolean).join(" · ");
  const audience = [
    optionLabels(AUDIENCE_RELATIONSHIP_OPTIONS, intake.audience?.relationships || []).join(", "),
    intake.audience?.geo,
    intake.audience?.notes,
  ].filter(Boolean).join(" · ");
  const accountLines = linked.map((account) => `${account.platform} ${account.handle || account.displayName}`);
  const content = optionLabels(FORMAT_OPTIONS, intake.creative?.formats || intake.formats || []).join(", ")
    || optionLabels(CONTENT_TYPE_OPTIONS, intake.promoted?.formats || []).join(", ");
  const style = optionLabels(TONE_OPTIONS, intake.creative?.tone || []).join(", ");
  const success = optionLabel(SUCCESS_SIGNAL_OPTIONS, intake.success?.primary)
    || optionLabels(SUCCESS_SIGNAL_OPTIONS, intake.success?.signals || []).join(", ");
  const test = optionLabels(TESTING_OPTIONS, intake.testing?.hypotheses || []).join(", ")
    || intake.testing?.hypothesisText
    || "";

  const lines = [
    goal && { label: "GOAL", value: goal },
    promoting && { label: "PROMOTING", value: promoting },
    audience && { label: "AUDIENCE", value: audience },
    accountLines.length && { label: "ACCOUNTS", value: accountLines.join(", ") },
    content && { label: "CONTENT", value: content },
    style && { label: "STYLE", value: style },
    success && { label: "SUCCESS", value: success },
    test && { label: "TEST", value: test },
  ].filter(Boolean);

  return {
    source: "CALCULATED",
    lines,
    text: lines.map((line) => `${line.label}\n${line.value}`).join("\n\n"),
    goal: goal || "—",
    promoting: promoting || "—",
    audience: audience || "—",
    accounts: accountLines,
    content: content || "—",
    style: style || "—",
    success: success || "—",
    test: test || "—",
  };
}

export function missingStrategyEssentials(campaign, accounts = []) {
  const questions = [];
  if (!campaign?.name || campaign.name === "Untitled campaign") {
    questions.push("What should this campaign be called?");
  }
  if (!(campaign?.intake?.goals || []).length && !campaign?.objective) {
    questions.push("What is the main goal?");
  }
  if (!(campaign?.accountIds || []).length) {
    questions.push("Which account should be the primary channel?");
  } else if ((campaign.accountIds || []).length > 1 && !campaign?.intake?.channels?.primary) {
    questions.push("Which account should be the primary channel?");
  }
  if (!campaign?.intake?.success?.primary) {
    questions.push("Which success signal matters most?");
  }
  const linked = accounts.filter((account) => (campaign?.accountIds || []).includes(account.id));
  if (linked.some((account) => ["ERROR", "AUTH_EXPIRED"].includes(account.connectionState))) {
    questions.push("One of the accounts needs to be reconnected.");
  }
  return questions.slice(0, 3);
}
