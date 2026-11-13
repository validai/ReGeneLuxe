"use server";

import { signIn, signOut } from "../../auth";
import { SIGNED_OUT_HREF } from "../../server/auth/signedOut.js";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function signOutOperator() {
  await signOut({ redirectTo: SIGNED_OUT_HREF });
}

/**
 * Start Create Another Profile:
 * sign out of the current Google identity, then return to sign-in
 * with explicit account selection (prompt=select_account is already configured).
 */
export async function beginCreateAnotherProfile() {
  await signOut({ redirectTo: "/signin?createProfile=1" });
}
