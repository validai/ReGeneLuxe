import { NextResponse } from "next/server";
import { requireOperator } from "../../../server/auth/workspaceSession.js";
import { createManagedProfile, toPublicProfile } from "../../../server/db/managedProfileRepository.js";
import { setMeta } from "../../../server/db/index.js";
import { saveProfileImageBuffer } from "../../../server/media/store.js";
import { readProfileInput } from "../../../server/profiles/readProfileInput.js";

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

  try {
    const input = await readProfileInput(request);
    let avatarUrl = input.avatarUrl || "";
    let avatarMediaId = "";
    if (input.avatarFile) {
      const buffer = Buffer.from(await input.avatarFile.arrayBuffer());
      const saved = await saveProfileImageBuffer({
        buffer,
        mimeType: input.avatarFile.type,
        originalName: input.avatarFile.name,
      });
      avatarUrl = saved.url;
      avatarMediaId = saved.id;
    }
    const profile = await createManagedProfile(result.operator.id, {
      displayName: input.displayName,
      slug: input.slug,
      primaryEmail: input.primaryEmail,
      website: input.website,
      primaryPublicUrl: input.primaryPublicUrl,
      timezone: input.timezone,
      shortDescription: input.shortDescription,
      avatarUrl,
      avatarMediaId,
      platforms: input.platforms,
      status: "ACTIVE",
    });
    await setMeta("active_profile_id", profile.id);
    return NextResponse.json({ ok: true, profile: toPublicProfile(profile) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create profile.";
    const status = /required|supported|Maximum|pixels|read this image/i.test(message) ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
