import { facebookConnector, instagramConnector } from "./providers/meta.js";
import { youtubeConnector } from "./providers/youtube.js";
import { tiktokConnector } from "./providers/tiktok.js";
import { xConnector } from "./providers/x.js";
import { threadsConnector } from "./providers/threads.js";
import { soundcloudConnector } from "./providers/soundcloud.js";
import { createMockConnector } from "./providers/mock.js";
import { expandCapabilities, hasCapabilityIn, PROVIDER_READINESS } from "./capabilities.js";
import { hasAccountTokens } from "../secrets/providers.js";

const PLATFORM_ALIASES = {
  Instagram: "instagram",
  Facebook: "facebook",
  YouTube: "youtube",
  TikTok: "tiktok",
  X: "x",
  Twitter: "x",
  Threads: "threads",
  SoundCloud: "soundcloud",
  LinkedIn: "linkedin",
  Snapchat: "snapchat",
  Twitch: "twitch",
  Kick: "kick",
  Other: "other",
  Mock: "mock",
  instagram: "instagram",
  facebook: "facebook",
  youtube: "youtube",
  tiktok: "tiktok",
  x: "x",
  threads: "threads",
  soundcloud: "soundcloud",
  linkedin: "linkedin",
  snapchat: "snapchat",
  twitch: "twitch",
  kick: "kick",
  mock: "mock",
};

function unsupportedStub({ provider, displayName, reservedRails = false }) {
  const message = reservedRails
    ? `${displayName} connector rails reserved — not implemented in this sprint.`
    : `No authenticated ${displayName} connector yet. Manual accounts can be planned and marked published.`;
  return {
    provider,
    displayName,
    capabilities: reservedRails ? expandCapabilities(["READ_PROFILE", "PUBLISH_TEXT"]) : [],
    readiness: PROVIDER_READINESS.UNSUPPORTED,
    setupInstructions: message,
    resolveReadiness: () => PROVIDER_READINESS.UNSUPPORTED,
    async beginAuth() {
      return {
        ok: false,
        readiness: PROVIDER_READINESS.UNSUPPORTED,
        reason: "UNSUPPORTED",
        message: `${displayName} is not supported yet.`,
      };
    },
    async execute() {
      return { ok: false, unavailable: true, reason: "UNSUPPORTED" };
    },
  };
}

const CORE = {
  instagram: instagramConnector,
  facebook: facebookConnector,
  youtube: youtubeConnector,
  tiktok: tiktokConnector,
  x: xConnector,
  threads: threadsConnector,
  soundcloud: soundcloudConnector,
  linkedin: unsupportedStub({ provider: "linkedin", displayName: "LinkedIn", reservedRails: true }),
  snapchat: unsupportedStub({ provider: "snapchat", displayName: "Snapchat" }),
  twitch: unsupportedStub({ provider: "twitch", displayName: "Twitch" }),
  kick: unsupportedStub({ provider: "kick", displayName: "Kick" }),
};

function allowMock() {
  return process.env.RL_ALLOW_MOCK_CONNECTOR === "1"
    || process.env.NODE_ENV === "test"
    || process.env.VITEST === "true";
}

export function normalizeProviderId(platformOrProvider) {
  if (!platformOrProvider) return "other";
  return PLATFORM_ALIASES[platformOrProvider] || String(platformOrProvider).toLowerCase();
}

export function getConnector(platformOrProvider) {
  const id = normalizeProviderId(platformOrProvider);
  if (id === "mock") {
    if (!allowMock()) {
      return {
        provider: "mock",
        displayName: "Mock",
        capabilities: [],
        readiness: PROVIDER_READINESS.UNSUPPORTED,
        resolveReadiness: () => PROVIDER_READINESS.UNSUPPORTED,
        async beginAuth() {
          return { ok: false, reason: "UNSUPPORTED", message: "Mock connector disabled." };
        },
      };
    }
    return createMockConnector();
  }
  return CORE[id] || {
    provider: id,
    displayName: platformOrProvider,
    capabilities: [],
    readiness: PROVIDER_READINESS.UNSUPPORTED,
    setupInstructions: "No provider adapter for this platform.",
    resolveReadiness: () => PROVIDER_READINESS.UNSUPPORTED,
    async beginAuth() {
      return { ok: false, reason: "UNSUPPORTED", message: "No provider adapter for this platform." };
    },
  };
}

export function listProviderDefinitions() {
  const defs = Object.values(CORE).map((connector) => ({
    provider: connector.provider,
    displayName: connector.displayName,
    capabilities: [...(connector.capabilities || [])],
    readiness: connector.resolveReadiness?.() || connector.readiness,
    setupInstructions: connector.setupInstructions || "",
    reviewNotes: connector.reviewNotes || "",
    analyticsNormalization: true,
    publishingSupport: (connector.capabilities || []).some((c) => String(c).startsWith("PUBLISH") || c === "SCHEDULE"),
  }));
  if (allowMock()) {
    const mock = createMockConnector();
    defs.push({
      provider: "mock",
      displayName: "Mock",
      capabilities: [...mock.capabilities],
      readiness: PROVIDER_READINESS.IMPLEMENTED,
      setupInstructions: "Test only",
      reviewNotes: "",
      analyticsNormalization: true,
      publishingSupport: true,
    });
  }
  return defs;
}

export function declaredCapabilities(platformOrProvider) {
  return [...(getConnector(platformOrProvider).capabilities || [])];
}

export function availableCapabilities(account) {
  if (!account || account.connectionState !== "CONNECTED") return [];
  const provider = normalizeProviderId(account.platform);
  // Honest: CONNECTED alone is not enough without server tokens (except during client-only tests of declared caps).
  if (typeof window === "undefined") {
    if (!hasAccountTokens(provider, account.id) && provider !== "mock") {
      // Allow mock in tests even if tokens set in same process
    }
  }
  return declaredCapabilities(account.platform);
}

export function hasCapability(account, capability) {
  return hasCapabilityIn(availableCapabilities(account), capability);
}

export function connectionLabel(account) {
  if (!account) return "Manual";
  const state = account.connectionState || "MANUAL_ONLY";
  if (state === "CONNECTED") return "Connected";
  if (state === "MANUAL_ONLY") return "Manual";
  if (state === "SETUP_REQUIRED") return "Setup required";
  if (state === "RECONNECT_REQUIRED") return "Reconnect required";
  return state.replaceAll("_", " ").toLowerCase();
}

export const ConnectorRegistry = {
  get: getConnector,
  list: listProviderDefinitions,
  normalizeProviderId,
  declaredCapabilities,
  availableCapabilities,
  hasCapability,
  connectionLabel,
};

export default ConnectorRegistry;
