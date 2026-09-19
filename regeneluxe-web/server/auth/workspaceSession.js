import { auth } from "../../auth";
import { initDb, setMeta } from "../db/index.js";
import { getOperator } from "../db/operatorRepository.js";
import { listProfilesForOperator, listProfileConnections } from "../db/managedProfileRepository.js";
import { publicOperator, publicManagedProfile, publicProfileConnection, resolveActiveProfile } from "../../src/data/profileModels.js";
import { isEmailAllowed } from "./allowlist.js";
import {
  bindExistingGoogleIdentities,
  claimBoundProfile,
  findProfileByGoogleIdentity,
} from "../db/googleIdentityBinding.js";
import {
  assertMatchesBoundGoogleIdentity,
  displayGoogleIdentity,
  googleIdentityMismatchMessage,
} from "../../src/data/googleIdentity.js";

export async function requireOperator() {
  const session = await auth();
  if (!session?.operatorId) {
    return { ok: false, status: 401, error: "Please sign in to continue." };
  }
  try {
    await initDb();
    await bindExistingGoogleIdentities();
  } catch {
    return { ok: false, status: 503, error: "ReGeneLuxe could not open the local database. Your data was not deleted." };
  }
  let operator = await getOperator(session.operatorId);
  if (!operator || operator.status === "INACTIVE") {
    return { ok: false, status: 401, error: "Please sign in to continue." };
  }
  if (!isEmailAllowed(operator.email)) {
    return {
      ok: false,
      status: 401,
      reason: "identity_mismatch",
      error: "Please sign in with the Google account linked to this profile.",
    };
  }
  let profiles = await listProfilesForOperator(operator.id);
  if (!profiles.length) {
    const bound = await findProfileByGoogleIdentity({
      email: operator.email,
      googleSub: operator.googleSub,
    });
    if (bound) {
      const claimed = await claimBoundProfile(bound, {
        email: operator.email,
        googleSub: operator.googleSub,
        emailVerified: operator.emailVerified,
        name: operator.name,
        avatarUrl: operator.avatarUrl,
      });
      operator = claimed.operator;
      profiles = await listProfilesForOperator(operator.id);
    }
  }
  const activeProfile = resolveActiveProfile(operator, profiles);
  if (activeProfile) {
    const match = assertMatchesBoundGoogleIdentity(activeProfile, {
      email: operator.email,
      googleSub: operator.googleSub,
    });
    if (!match.ok) {
      return {
        ok: false,
        status: 401,
        reason: "identity_mismatch",
        error: match.error || googleIdentityMismatchMessage(activeProfile.googleAccountEmail),
      };
    }
  }
  if (activeProfile && operator.activeProfileId !== activeProfile.id) {
    operator.activeProfileId = activeProfile.id;
  }
  if (activeProfile?.id) {
    await setMeta("active_profile_id", activeProfile.id);
  }
  return {
    ok: true,
    operator,
    profiles,
    activeProfile,
    publicOperator: publicOperator(operator),
    publicProfiles: profiles.map(publicManagedProfile),
    publicActiveProfile: publicManagedProfile(activeProfile),
  };
}

export async function loadConnectionState(operator, activeProfile) {
  const profileConnections = activeProfile
    ? await listProfileConnections(activeProfile.id)
    : [];
  const gmailRow = profileConnections.find((row) => row.kind === "GMAIL");
  const youtubeRow = profileConnections.find((row) => row.kind === "YOUTUBE");
  const googleEmail = displayGoogleIdentity(activeProfile, operator);
  return {
    googleAccount: {
      kind: "GOOGLE_ACCOUNT",
      status: "CONNECTED",
      email: googleEmail,
      name: activeProfile?.displayName || "",
      avatarUrl: activeProfile?.avatarUrl || "",
    },
    gmail: publicProfileConnection(gmailRow) || {
      kind: "GMAIL",
      provider: "gmail",
      status: "NOT_CONNECTED",
      connectionState: "NOT_CONNECTED",
      email: "",
      displayLabel: "Gmail",
    },
    youtube: {
      kind: "YOUTUBE",
      status: youtubeRow?.status || "NOT_CONNECTED",
    },
    profileConnections: profileConnections.map((row) => publicProfileConnection(row)).filter(Boolean),
  };
}
