import AccessNotAuthorizedPage from "../../src/screens/AccessNotAuthorizedPage";
import { getActiveProfileInvite, publicInvite } from "../../server/auth/profileInvite.js";

export const dynamic = "force-dynamic";

type Search = {
  reason?: string | string[];
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const reason = Array.isArray(params.reason) ? params.reason[0] : (params.reason || "");
  const invite = await getActiveProfileInvite();
  return (
    <AccessNotAuthorizedPage
      reason={reason}
      createProfilePending={Boolean(invite && publicInvite(invite)?.active)}
    />
  );
}
