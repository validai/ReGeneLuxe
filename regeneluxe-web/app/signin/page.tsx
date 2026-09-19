import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { initDb } from "../../server/db/index.js";
import { getOperator } from "../../server/db/operatorRepository.js";
import { listProfilesForOperator } from "../../server/db/managedProfileRepository.js";
import SignInScreen from "../../src/screens/SignInPage";
import { authErrorMessage } from "../../server/auth/errors.js";
import { isSignedOutParam } from "../../server/auth/signedOut.js";
import { isEmailAllowed } from "../../server/auth/allowlist.js";
import { bindExistingGoogleIdentities } from "../../server/db/googleIdentityBinding.js";
import { resolveActiveProfile } from "../../src/data/profileModels.js";
import { assertMatchesBoundGoogleIdentity } from "../../src/data/googleIdentity.js";

export const dynamic = "force-dynamic";

type Search = { error?: string; signedOut?: string | string[] };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await auth();
  const params = await searchParams;
  let destination: string | null = null;
  let dbFailed = false;

  if (session?.operatorId) {
    try {
      await initDb();
      const operator = await getOperator(session.operatorId);
      const allowed = operator && operator.status !== "INACTIVE" && isEmailAllowed(operator.email);
      if (allowed) {
        await bindExistingGoogleIdentities();
        const profiles = await listProfilesForOperator(operator.id);
        const activeProfile = resolveActiveProfile(operator, profiles);
        const match = activeProfile
          ? assertMatchesBoundGoogleIdentity(activeProfile, {
            email: operator.email,
            googleSub: operator.googleSub,
          })
          : { ok: true };
        if (match.ok) {
          destination = profiles.length ? "/" : "/setup/profile";
        }
      }
    } catch {
      dbFailed = true;
    }
  }

  if (destination) redirect(destination);

  const signedOut = isSignedOutParam(params.signedOut);
  const message = dbFailed
    ? authErrorMessage("database")
    : signedOut
      ? ""
      : authErrorMessage(params.error);

  return <SignInScreen errorMessage={message} signedOut={signedOut} />;
}
