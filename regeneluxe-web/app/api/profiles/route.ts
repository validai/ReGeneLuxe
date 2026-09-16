import { NextResponse } from "next/server";
import { requireOperator } from "../../../server/auth/workspaceSession.js";
import { createManagedProfile, toPublicProfile } from "../../../server/db/managedProfileRepository.js";
import { setMeta } from "../../../server/db/index.js";
import { saveProfileImageBuffer } from "../../../server/media/store.js";
import { sanitizeAvatarUrl } from "../../../src/data/profileImage.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function readProfileInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("avatar");
    return {
      displayName: String(form.get("displayName") || ""),
      slug: String(form.get("slug") || ""),
      primaryEmail: String(form.get("primaryEmail") || ""),
      website: form.get("website") == null ? "" : String(form.get("website")),
      primaryPublicUrl: String(form.get("primaryPublicUrl") || ""),
      timezone: String(form.get("timezone") || ""),
      shortDescription: String(form.get("shortDescription") || ""),
      platforms: String(form.get("platforms") || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      avatarFile: file instanceof File && file.size > 0 ? file : null,
      avatarUrl: "",
    };
  }
  const body = await request.json().catch(() => ({}));
  return {
    displayName: body.displayName,
    slug: body.slug,
    primaryEmail: body.primaryEmail,
    website: body.website,
    primaryPublicUrl: body.primaryPublicUrl,
    timezone: body.timezone,
    shortDescription: body.shortDescription,
    platforms: body.platforms,
    avatarFile: null,
    avatarUrl: sanitizeAvatarUrl(body.avatarUrl),
  };
}

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
    let avatarUrl = input.avatarUrl;
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
