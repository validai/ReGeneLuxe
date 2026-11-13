import { NextResponse } from "next/server";
import { assertE2eSecret, isE2eAuthEnabled, isE2eDisposableEmail } from "../../../../server/auth/e2eAuthGate.js";
import { initDb, list, remove, COLLECTIONS } from "../../../../server/db/index.js";
import { listProfilesForOperator } from "../../../../server/db/managedProfileRepository.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Delete disposable @example.invalid operators and their workspaces.
 * Only available when E2E auth gates are fully enabled.
 */
export async function POST(request: Request) {
  if (!isE2eAuthEnabled()) {
    return new NextResponse(null, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  if (!assertE2eSecret(String(body?.secret || ""))) {
    return NextResponse.json({ ok: false, error: "denied" }, { status: 403 });
  }

  await initDb();
  const operators = await list(COLLECTIONS.operators);
  let removedOperators = 0;
  let removedProfiles = 0;

  for (const operator of operators) {
    if (!isE2eDisposableEmail(operator.email)) continue;
    const profiles = await listProfilesForOperator(operator.id);
    for (const profile of profiles) {
      await remove(COLLECTIONS.managed_profiles, profile.id);
      removedProfiles += 1;
    }
    await remove(COLLECTIONS.operators, operator.id);
    removedOperators += 1;
  }

  return NextResponse.json({ ok: true, removedOperators, removedProfiles });
}
