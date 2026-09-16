import { auth } from "../../auth";
import { initDb, setMeta } from "../db/index.js";
import { getOperator } from "../db/operatorRepository.js";
import { listProfilesForOperator, listProfileConnections } from "../db/managedProfileRepository.js";
import { publicOperator, publicManagedProfile, publicProfileConnection, resolveActiveProfile } from "../../src/data/profileModels.js";

export async function requireOperator() {
  const session = await auth();
  if (!session?.operatorId) {
    return { ok: false, status: 401, error: "Please sign in to continue." };
  }
  try {
    await initDb();
  } catch {
    return { ok: false, status: 503, error: "ReGeneLuxe could not open the local database. Your data was not deleted." };
  }
  const operator = await getOperator(session.operatorId);
  if (!operator) {
    return { ok: false, status: 401, error: "Please sign in to continue." };
  }
  const profiles = await listProfilesForOperator(operator.id);
  const activeProfile = resolveActiveProfile(operator, profiles);
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
  return {
    googleAccount: {
      kind: "GOOGLE_ACCOUNT",
      status: "CONNECTED",
      name: operator?.name || "",
      email: operator?.email || "",
      avatarUrl: operator?.avatarUrl || "",
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
