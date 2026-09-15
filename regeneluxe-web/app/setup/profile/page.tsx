import { redirect } from "next/navigation";
import { requireOperator } from "../../../server/auth/workspaceSession.js";
import ProfileSetupPage from "../../../src/screens/ProfileSetupPage";

export const dynamic = "force-dynamic";

export default async function SetupProfilePage() {
  const result = await requireOperator();
  if (!result.ok) {
    redirect(result.status === 503 ? "/signin?error=database" : "/signin");
  }
  if (result.profiles.length > 0) {
    redirect("/");
  }
  return <ProfileSetupPage operator={result.publicOperator} />;
}
