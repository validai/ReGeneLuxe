import AccessNotAuthorizedPage from "../../src/screens/AccessNotAuthorizedPage";

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
  return <AccessNotAuthorizedPage reason={reason} />;
}
