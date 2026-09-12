import { Suspense } from "react";
import WorkspaceProviders from "../../src/components/app/WorkspaceProviders";
import Skeleton from "../../src/components/app/Skeleton";

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

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProviders>
      <Suspense fallback={<RouteFallback />}>
        {children}
      </Suspense>
    </WorkspaceProviders>
  );
}
