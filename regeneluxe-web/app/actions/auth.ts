"use server";

import { signIn, signOut } from "../../auth";
import { SIGNED_OUT_HREF } from "../../server/auth/signedOut.js";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function signOutOperator() {
  await signOut({ redirectTo: SIGNED_OUT_HREF });
}
