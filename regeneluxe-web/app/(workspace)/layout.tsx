import { Suspense } from "react";
import { redirect } from "next/navigation";
import WorkspaceProviders from "../../src/components/app/WorkspaceProviders";
import Skeleton from "../../src/components/app/Skeleton";
import { requireOperator, loadConnectionState } from "../../server/auth/workspaceSession.js";

export const dynamic = "force-dynamic";

function RouteFallback() {
  return (
    <div className="mx-auto w-full max-w-workspace space-y-6 px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading">
      <Skeleton height="h-8" className="w-48" />
      <Skeleton lines={3} />
      <Skeleton height="h-32" className="w-full" />
    </div>
  );
}

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const result = await requireOperator();
  if (!result.ok) {
    redirect(result.status === 503 ? "/signin?error=database" : result.reason === "identity_mismatch" ? "/signin?error=identity" : "/signin");
  }
  if (result.profiles.length === 0) {
    redirect("/setup/profile");
  }

  const connections = await loadConnectionState(result.operator, result.activeProfile);

  return (
    <WorkspaceProviders
      operator={result.publicOperator}
      profiles={result.publicProfiles}
      activeProfile={result.publicActiveProfile}
      connections={{
        googleAccount: connections.googleAccount,
        gmail: connections.gmail,
        youtube: connections.youtube,
      }}
    >
      <Suspense fallback={<RouteFallback />}>
        {children}
      </Suspense>
    </WorkspaceProviders>
  );
}
