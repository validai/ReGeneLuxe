import { auth } from "../../auth";
import { initDb, setMeta } from "../db/index.js";
import { getOperator } from "../db/operatorRepository.js";
import { getWorkspaceForAccount, listProfileConnections } from "../db/managedProfileRepository.js";
import { publicOperator, publicManagedProfile, publicProfileConnection, PROFILE_CONNECTION_STATES } from "../../src/data/profileModels.js";
import { isEmailAllowed } from "./allowlist.js";
import { displayAccountEmail } from "../../src/data/googleIdentity.js";
import { publicGmailForProfile } from "../connectors/gmailConnection.js";
import { publicYoutubeForProfile } from "../connectors/youtubeConnection.js";

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
  if (!operator || operator.status === "INACTIVE") {
    return { ok: false, status: 401, error: "Please sign in to continue." };
  }
  if (!isEmailAllowed(operator.email)) {
    return {
      ok: false,
      status: 401,
      error: "This Google account is not approved for the ReGeneLuxe private pilot.",
    };
  }
  const workspace = await getWorkspaceForAccount(operator.id);
  const profiles = workspace ? [workspace] : [];
  if (workspace?.id) {
    await setMeta("active_profile_id", workspace.id);
    await setMeta("workspace_id", workspace.id);
  }
  return {
    ok: true,
    operator,
    workspace,
    profiles,
    activeProfile: workspace,
    publicOperator: publicOperator(operator),
    publicAccount: publicOperator(operator),
    publicWorkspace: publicManagedProfile(workspace),
    publicProfiles: profiles.map(publicManagedProfile),
    publicActiveProfile: publicManagedProfile(workspace),
  };
}

export async function loadConnectionState(operator, activeProfile) {
  const profileConnections = activeProfile
    ? await listProfileConnections(activeProfile.id)
    : [];
  const gmail = await publicGmailForProfile(activeProfile?.id);
  const youtube = await publicYoutubeForProfile(activeProfile?.id);
  return {
    googleAccount: {
      kind: "GOOGLE_ACCOUNT",
      status: PROFILE_CONNECTION_STATES.CONNECTED,
      email: displayAccountEmail(operator),
      name: operator?.name || "",
      avatarUrl: operator?.avatarUrl || "",
    },
    gmail: gmail || {
      kind: "GMAIL",
      provider: "gmail",
      status: PROFILE_CONNECTION_STATES.NOT_CONNECTED,
      connectionState: PROFILE_CONNECTION_STATES.NOT_CONNECTED,
      email: "",
      displayLabel: "Gmail",
      permission: "readonly",
    },
    youtube: youtube || {
      kind: "YOUTUBE",
      provider: "youtube",
      status: PROFILE_CONNECTION_STATES.NOT_CONNECTED,
      connectionState: PROFILE_CONNECTION_STATES.NOT_CONNECTED,
      email: "",
      displayLabel: "YouTube",
      permission: "readonly",
    },
    profileConnections: profileConnections.map((row) => publicProfileConnection(row)).filter(Boolean),
  };
}
