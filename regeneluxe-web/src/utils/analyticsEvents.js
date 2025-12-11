// FILE: src/utils/analyticsEvents.js
// Centralized event name constants for analytics tracking

export const EVENTS = Object.freeze({
  // Navigation
  ROUTE_VIEW: "route_view",

  // CTA / navigation
  CTA_CLICK: "cta_click",

  // Onboarding (Start page)
  ONBOARDING_STEP_VIEW: "onboarding_step_view",
  ONBOARDING_STEP_COMPLETED: "onboarding_step_completed",
  ONBOARDING_SUBMIT: "onboarding_submit",
  ONBOARDING_TERMS_OPENED: "onboarding_terms_opened",
  ONBOARDING_TERMS_ACCEPTED: "onboarding_terms_accepted",

  // Dashboard + campaigns
  DASHBOARD_VIEW: "dashboard_view",
  DASHBOARD_NEW_CAMPAIGN_CLICK: "dashboard_new_campaign_click",
  CAMPAIGN_NEW_VIEW: "campaign_new_view",
  CAMPAIGN_CREATED: "campaign_created",
  CAMPAIGN_CREATION_FAILED: "campaign_creation_failed",

  // Errors
  FRONTEND_ERROR: "frontend_error",
  API_ERROR: "api_error",
});


