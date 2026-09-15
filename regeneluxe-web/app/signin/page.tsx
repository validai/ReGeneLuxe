import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { initDb } from "../../server/db/index.js";
import { getOperator } from "../../server/db/operatorRepository.js";
import { listProfilesForOperator } from "../../server/db/managedProfileRepository.js";
import SignInScreen from "../../src/screens/SignInPage";
import { authErrorMessage } from "../../server/auth/errors.js";

export const dynamic = "force-dynamic";

type Search = { error?: string };

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
      const profiles = operator ? await listProfilesForOperator(operator.id) : [];
      destination = profiles.length ? "/" : "/setup/profile";
    } catch {
      dbFailed = true;
    }
  }

  if (destination) redirect(destination);

  const message = dbFailed ? authErrorMessage("database") : authErrorMessage(params.error);

  return <SignInScreen errorMessage={message} />;
}
