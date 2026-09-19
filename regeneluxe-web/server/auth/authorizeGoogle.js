import { isEmailAllowed } from "./allowlist.js";
import { initDb } from "../db/index.js";
import { upsertOperatorFromGoogle } from "../db/operatorRepository.js";
import {
  bindExistingGoogleIdentities,
  claimBoundProfile,
  findProfileByGoogleIdentity,
} from "../db/googleIdentityBinding.js";
import { googleIdentityMismatchMessage } from "../../src/data/googleIdentity.js";

/**
 * First login: verify allowlisted email, persist Google `sub`, return Operator.
 * If a ManagedProfile is already bound to this Google identity, claim it instead
 * of creating a duplicate workspace.
 */
export async function authorizeGoogleSignIn({ account, profile } = {}) {
  if (account?.provider && account.provider !== "google") {
    return { ok: false, reason: "unsupported_provider" };
  }

  const email = String(profile?.email || "").trim();
  const sub = String(profile?.sub || account?.providerAccountId || "").trim();
  const emailVerified = Boolean(profile?.email_verified ?? profile?.emailVerified);

  if (!sub) return { ok: false, reason: "missing_sub" };
  if (!isEmailAllowed(email)) return { ok: false, reason: "not_allowlisted" };

  try {
    await initDb();
    await bindExistingGoogleIdentities();
    const boundProfile = await findProfileByGoogleIdentity({ email, googleSub: sub });
    if (boundProfile) {
      const claimed = await claimBoundProfile(boundProfile, {
        googleSub: sub,
        email,
        emailVerified,
        name: profile?.name || "",
        avatarUrl: profile?.picture || "",
      });
      return { ok: true, operator: claimed.operator, profile: claimed.profile, claimed: true };
    }

    const operator = await upsertOperatorFromGoogle({
      googleSub: sub,
      email,
      emailVerified,
      name: profile?.name || "",
      avatarUrl: profile?.picture || "",
    });
    return { ok: true, operator };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already linked/i.test(message)) {
      return { ok: false, reason: "identity_mismatch", message: googleIdentityMismatchMessage(email) };
    }
    return {
      ok: false,
      reason: "database_unavailable",
      message,
    };
  }
}
