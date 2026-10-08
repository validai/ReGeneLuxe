import { isPilotProvider } from "./publishApproval.js";

const EMPTY = "NOT_ATTEMPTED";

/**
 * Campaign publish status derived from publication attempts.
 * YouTube's confirmed private upload is not a public publish.
 */
export function campaignPlatformResults(attempts = [], { campaignId = "" } = {}) {
  const relevant = attempts.filter((attempt) => !campaignId || attempt.campaignId === campaignId);
  const result = {
    instagram: EMPTY,
    facebook: EMPTY,
    threads: EMPTY,
    youtube: EMPTY,
  };
  for (const provider of Object.keys(result)) {
    const rows = relevant.filter((attempt) => String(attempt.provider || attempt.platform || "").toLowerCase() === provider);
    if (!rows.length) continue;
    const confirmed = rows.find((attempt) => ["PUBLISHED", "CONFIRMED"].includes(attempt.state));
    const failed = rows.find((attempt) => attempt.state === "FAILED");
    if (provider === "youtube" && confirmed) result.youtube = "PRIVATE_UPLOAD_CONFIRMED";
    else if (confirmed) result[provider] = "PUBLISHED";
    else if (failed) result[provider] = "FAILED";
  }
  return result;
}

export function pilotProviders() {
  return ["instagram", "facebook", "threads", "youtube"].filter((provider) => isPilotProvider(provider));
}
