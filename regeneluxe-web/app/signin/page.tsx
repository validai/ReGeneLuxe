import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { initDb } from "../../server/db/index.js";
import { getOperator } from "../../server/db/operatorRepository.js";
import { getWorkspaceForAccount } from "../../server/db/managedProfileRepository.js";
import SignInScreen from "../../src/screens/SignInPage";
import { authErrorMessage } from "../../server/auth/errors.js";
import { isSignedOutParam } from "../../server/auth/signedOut.js";
import { isEmailAllowed } from "../../server/auth/allowlist.js";

export const dynamic = "force-dynamic";

type Search = {
  error?: string;
  signedOut?: string | string[];
  createProfile?: string | string[];
};

function truthyParam(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "1" || raw === "true";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await auth();
  const params = await searchParams;
  const createProfile = truthyParam(params.createProfile);
  let destination: string | null = null;
  let dbFailed = false;

  if (session?.operatorId && !createProfile) {
    try {
      await initDb();
      const operator = await getOperator(session.operatorId);
      const allowed = operator && operator.status !== "INACTIVE" && isEmailAllowed(operator.email);
      if (allowed) {
        const workspace = await getWorkspaceForAccount(operator.id);
        destination = workspace ? "/" : "/setup/profile";
      }
    } catch {
      dbFailed = true;
    }
  }

  if (destination) redirect(destination);

  const signedOut = isSignedOutParam(params.signedOut) || createProfile;
  const message = dbFailed
    ? authErrorMessage("database")
    : (signedOut && !createProfile)
      ? ""
      : authErrorMessage(params.error);

  return (
    <SignInScreen
      errorMessage={message}
      signedOut={signedOut && !createProfile}
      createProfile={createProfile}
    />
  );
}
