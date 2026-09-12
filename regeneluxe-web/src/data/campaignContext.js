import {
  GOAL_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  AUDIENCE_RELATIONSHIP_OPTIONS,
  AGE_RANGE_OPTIONS,
  GEOGRAPHY_OPTIONS,
  INTEREST_OPTIONS,
  FORMAT_OPTIONS,
  TONE_OPTIONS,
  VISUAL_OPTIONS,
  CTA_OPTIONS,
  MESSAGE_THEME_OPTIONS,
  STRATEGY_OPTIONS,
  AVAILABLE_ASSET_OPTIONS,
  CONSTRAINT_OPTIONS,
  SUCCESS_SIGNAL_OPTIONS,
  TESTING_OPTIONS,
  optionLabel,
  optionLabels,
  sectionLabel,
} from "./options.js";
import { hasList, hasText, mergeIntake } from "./models.js";

export function hasCampaignGoal(intake) {
  return hasList(intake?.goals);
}

export function hasContentDefinition(intake) {
  return hasText(intake?.promoted?.primary) || hasText(intake?.promoted?.title) || hasText(intake?.offer);
}

export function hasAudienceDefinition(intake) {
  const audience = intake?.audience || {};
  return hasList(audience.relationships) || hasList(audience.interests) || hasList(audience.ageRanges) || hasList(audience.geography);
}

export function hasTargetAccount(campaign, intake) {
  return hasList(campaign?.accountIds) || hasList(intake?.accountIds) || hasList(intake?.platformTargets);
}

export function hasCreativeDirection(intake) {
  return hasList(intake?.creative?.tone) || hasList(intake?.creative?.visual);
}

export function hasSuccessSignal(intake) {
  return hasText(intake?.success?.primary) || hasList(intake?.success?.secondary);
}

export function campaignCompleteness(campaign) {
  const intake = mergeIntake(campaign?.intake || {});
  const checks = {
    purpose: hasCampaignGoal(intake),
    promoted_content: hasContentDefinition(intake),
    audience: hasAudienceDefinition(intake),
    account_platform: hasTargetAccount(campaign, intake),
    creative_direction: hasCreativeDirection(intake),
    success_signal: hasSuccessSignal(intake),
  };
  const filled = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  return {
    percent: Math.round((filled / total) * 100),
    filled,
    total,
    checks,
  };
}

export function hasEnoughContextForBlueprint(campaign, accounts = []) {
  return diagnoseCampaignContext(campaign, accounts).hasEnoughContextForBlueprint;
}

export function hasEnoughContextForFutureAgent(campaign, accounts = []) {
  return diagnoseCampaignContext(campaign, accounts).hasEnoughContextForFutureAgent;
}

export function diagnoseCampaignContext(campaign, accounts = []) {
  const intake = mergeIntake(campaign?.intake || {});
  const missing = [];
  if (!hasCampaignGoal(intake)) missing.push("campaign_goal");
  if (!hasContentDefinition(intake)) missing.push("content_definition");
  if (!hasAudienceDefinition(intake)) missing.push("audience_definition");
  if (!hasTargetAccount(campaign, intake)) missing.push("target_account");
  if (!hasCreativeDirection(intake)) missing.push("creative_direction");
  if (!hasSuccessSignal(intake)) missing.push("success_signal");

  const liveAccounts = (campaign?.accountIds || [])
    .map((id) => accounts.find((account) => account.id === id))
    .filter(Boolean);

  return {
    ready: missing.length === 0,
    missing,
    hasEnoughContextForBlueprint: missing.filter((item) => item !== "creative_direction").length <= 2,
    hasEnoughContextForFutureAgent: missing.length <= 1 && liveAccounts.length > 0,
    completeness: campaignCompleteness(campaign),
  };
}

function resolveAccounts(ids = [], accounts = []) {
  return ids.map((id) => {
    const account = accounts.find((item) => item.id === id);
    if (!account) {
      return { id, missing: true };
    }
    return {
      id: account.id,
      platform: account.platform,
      handle: account.handle,
      displayName: account.displayName,
      profileUrl: account.profileUrl,
      active: account.active !== false,
      role: account.role || account.campaignRole || "",
      primaryContentType: account.primaryContentType || "",
      audienceNotes: account.audienceNotes || "",
      platformStrengths: account.platformStrengths || "",
      platformWeaknesses: account.platformWeaknesses || "",
      postingNotes: account.postingNotes || "",
      typicalFormats: account.typicalFormats || [],
      defaultCta: account.defaultCta || "",
    };
  });
}

export function buildCampaignContext(campaign, accounts = []) {
  const intake = mergeIntake(campaign?.intake || {});
  const accountIds = hasList(campaign?.accountIds) ? campaign.accountIds : intake.accountIds;
  const diagnostics = diagnoseCampaignContext({ ...campaign, accountIds, intake }, accounts);

  return {
    campaignId: campaign?.id || null,
    name: campaign?.name || "",
    active: campaign?.active !== false,
    currentArea: sectionLabel(campaign?.currentSection || "OVERVIEW"),
    currentSection: campaign?.currentSection || "OVERVIEW",
    purpose: optionLabels(GOAL_OPTIONS, intake.goals),
    purposeValues: intake.goals || [],
    purposeOther: intake.goalsOther || "",
    promotedContent: {
      primary: optionLabel(CONTENT_TYPE_OPTIONS, intake.promoted.primary),
      primaryValue: intake.promoted.primary,
      supporting: optionLabels(CONTENT_TYPE_OPTIONS, intake.promoted.supporting),
      title: intake.promoted.title,
      url: intake.promoted.url,
      releaseDate: intake.promoted.releaseDate,
      description: intake.promoted.description,
      other: intake.promoted.other,
    },
    audience: {
      relationships: optionLabels(AUDIENCE_RELATIONSHIP_OPTIONS, intake.audience.relationships),
      ageRanges: optionLabels(AGE_RANGE_OPTIONS, intake.audience.ageRanges),
      geography: optionLabels(GEOGRAPHY_OPTIONS, intake.audience.geography),
      geographyCustom: intake.audience.geographyCustom,
      interests: optionLabels(INTEREST_OPTIONS, intake.audience.interests),
      interestTags: intake.audience.interestTags || [],
      interestsOther: intake.audience.interestsOther || "",
    },
    accounts: resolveAccounts(accountIds, accounts),
    platformTargets: intake.platformTargets || [],
    contentFormats: optionLabels(FORMAT_OPTIONS, intake.contentFormats),
    creativeDirection: {
      tone: optionLabels(TONE_OPTIONS, intake.creative.tone),
      visual: optionLabels(VISUAL_OPTIONS, intake.creative.visual),
      toneOther: intake.creative.toneOther,
      visualOther: intake.creative.visualOther,
    },
    messaging: {
      cta: optionLabel(CTA_OPTIONS, intake.messaging.cta),
      ctaCustom: intake.messaging.ctaCustom,
      themes: optionLabels(MESSAGE_THEME_OPTIONS, intake.messaging.themes),
      keyMessage: intake.messaging.keyMessage,
    },
    strategy: optionLabels(STRATEGY_OPTIONS, intake.strategy),
    availableAssets: optionLabels(AVAILABLE_ASSET_OPTIONS, intake.availableAssets),
    constraints: optionLabels(CONSTRAINT_OPTIONS, intake.constraints),
    successSignals: {
      primary: optionLabel(SUCCESS_SIGNAL_OPTIONS, intake.success.primary),
      secondary: optionLabels(SUCCESS_SIGNAL_OPTIONS, intake.success.secondary),
      targetValues: intake.success.targetValues || {},
    },
    testing: {
      focus: optionLabels(TESTING_OPTIONS, intake.testing.hypotheses),
      hypothesis: intake.testing.hypothesisText,
    },
    notes: intake.notes || campaign?.notes || "",
    blueprint: campaign?.blueprint || {},
    assets: campaign?.assets || [],
    results: campaign?.results || [],
    iteration: campaign?.iteration || {},
    diagnostics,
  };
}

export function deriveBlueprintFromIntake(campaign, accounts = []) {
  const context = buildCampaignContext(campaign, accounts);
  const accountLine = context.accounts
    .map((account) => (account.missing ? "Account removed" : `${account.platform} ${account.handle || account.displayName}`))
    .join(" · ");

  return {
    objective: [context.purpose.join(" + "), context.promotedContent.title].filter(Boolean).join(" — "),
    audience: [
      context.audience.relationships.join(" / "),
      context.audience.ageRanges.join(", "),
      context.audience.geography.join(", "),
      [...context.audience.interests, ...context.audience.interestTags].join(" + "),
    ].filter(Boolean).join(" · "),
    coreMessage: context.messaging.keyMessage || context.messaging.themes.join(" + "),
    primaryAction: context.messaging.ctaCustom || context.messaging.cta,
    supportingMessages: context.messaging.themes.join(", "),
    creativeDirection: {
      tone: context.creativeDirection.tone.join(" + "),
      visual: context.creativeDirection.visual.join(" + "),
      approach: context.strategy.slice(0, 4).join(", "),
    },
    campaignStructure: context.strategy.join(", "),
    channelStrategy: accountLine || context.platformTargets.join(", "),
    contentFormats: context.contentFormats.join(", "),
    assetRequirements: context.availableAssets.join(", "),
    testingHypotheses: [context.testing.focus.join(", "), context.testing.hypothesis].filter(Boolean).join(" — "),
    successCriteria: [context.successSignals.primary, context.successSignals.secondary.join(", ")].filter(Boolean).join(" · "),
  };
}
