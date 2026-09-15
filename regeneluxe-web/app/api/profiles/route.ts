import { NextResponse } from "next/server";
import { requireOperator } from "../../../server/auth/workspaceSession.js";
import { createManagedProfile, toPublicProfile } from "../../../server/db/managedProfileRepository.js";
import { setMeta } from "../../../server/db/index.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await requireOperator();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    profiles: result.publicProfiles,
    activeProfile: result.publicActiveProfile,
  });
}

export async function POST(request: Request) {
  const result = await requireOperator();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  const body = await request.json().catch(() => ({}));
  try {
    const profile = await createManagedProfile(result.operator.id, {
      displayName: body.displayName,
      slug: body.slug,
      primaryEmail: body.primaryEmail,
      website: body.website,
      primaryPublicUrl: body.primaryPublicUrl,
      timezone: body.timezone,
      shortDescription: body.shortDescription,
      avatarUrl: body.avatarUrl,
      platforms: body.platforms,
      status: "ACTIVE",
    });
    await setMeta("active_profile_id", profile.id);
    return NextResponse.json({ ok: true, profile: toPublicProfile(profile) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create profile.";
    const status = message.includes("required") ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
