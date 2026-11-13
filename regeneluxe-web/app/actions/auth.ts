"use server";

import { signIn, signOut } from "../../auth";
import { SIGNED_OUT_HREF } from "../../server/auth/signedOut.js";
import { requireOperator } from "../../server/auth/workspaceSession.js";
import {
  createProfileInvite,
  revokeProfileInvite,
  getActiveProfileInvite,
  normalizeInviteEmail,
  isValidInviteEmailShape,
} from "../../server/auth/profileInvite.js";
import { redirect } from "next/navigation";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function signOutOperator() {
  await signOut({ redirectTo: SIGNED_OUT_HREF });
}

/**
 * Force Google account chooser after a denied identity — never silently reuse it.
 */
export async function chooseAnotherGoogleAccount(formData?: FormData) {
  const createProfile = String(formData?.get("createProfile") || "") === "1";
  const invite = await getActiveProfileInvite();
  const dest = createProfile || invite
    ? "/signin?createProfile=1&selectAccount=1"
    : "/signin?selectAccount=1";
  await signOut({ redirectTo: dest });
}

/**
 * Operator-authorized Create Another Profile:
 * bind a short-lived one-time invite to the intended Google email, then sign out
 * and open Google account selection. URL flags alone are not authorization.
 */
export async function authorizeCreateAnotherProfile(formData: FormData) {
  const gate = await requireOperator();
  if (!gate.ok) {
    redirect("/signin");
  }

  const email = normalizeInviteEmail(formData.get("inviteEmail"));
  if (!isValidInviteEmailShape(email)) {
    redirect("/settings#account?inviteError=email");
  }

  // Do not invite the currently signed-in Google identity.
  const current = normalizeInviteEmail(gate.operator.email);
  if (email === current) {
    redirect("/settings#account?inviteError=same");
  }

  await createProfileInvite({
    createdByOperatorId: gate.operator.id,
    email,
  });

  await signOut({ redirectTo: "/signin?createProfile=1" });
}

/** Cancel a pending alternate-profile invite without signing out. */
export async function cancelProfileInvite() {
  const gate = await requireOperator();
  if (!gate.ok) redirect("/signin");
  await revokeProfileInvite("operator_cancelled");
  redirect("/settings#account");
}

/**
 * Legacy entry without email — send the operator to the authorize form.
 * Does not bypass the allowlist and does not create an invite.
 */
export async function beginCreateAnotherProfile() {
  redirect("/settings#account");
}
