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
 * Sign out and return to /signin with Google account chooser intent.
 * Does not create profiles. Independent identities use /signin alone.
 */
export async function chooseAnotherGoogleAccount() {
  await signOut({ redirectTo: "/signin?selectAccount=1" });
}
