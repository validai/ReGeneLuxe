"use client";

import nextDynamic from "next/dynamic";

const SpaBridge = nextDynamic(() => import("./SpaBridge"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-workspace px-4 py-8 text-sm text-rl_muted" aria-busy="true">
      Loading ReGeneLuxe…
    </div>
  ),
});

/** Host finished SPA UI inside Next without SSR (localStorage / window). */
export default function ClientSpa() {
  return <SpaBridge />;
}
