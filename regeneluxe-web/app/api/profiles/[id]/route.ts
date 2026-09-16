import { NextResponse } from "next/server";
import { requireOperator } from "../../../../server/auth/workspaceSession.js";
import {
  getManagedProfile,
  setActiveProfileForOperator,
  toPublicProfile,
  updateManagedProfile,
} from "../../../../server/db/managedProfileRepository.js";
import { setMeta } from "../../../../server/db/index.js";
import { publicOperator } from "../../../../src/data/profileModels.js";
import { saveProfileImageBuffer } from "../../../../server/media/store.js";
import { readProfileInput } from "../../../../server/profiles/readProfileInput.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const result = await requireOperator();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  const { id } = await params;
  const profile = await getManagedProfile(id);
  if (!profile || profile.ownerOperatorId !== result.operator.id) {
    return NextResponse.json({ ok: false, error: "Profile not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, profile: toPublicProfile(profile) });
}

export async function PATCH(request: Request, { params }: Params) {
  const result = await requireOperator();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  const { id } = await params;
  const profile = await getManagedProfile(id);
  if (!profile || profile.ownerOperatorId !== result.operator.id) {
    return NextResponse.json({ ok: false, error: "Profile not found." }, { status: 404 });
  }
  try {
    const input = await readProfileInput(request);
    const patch: Record<string, unknown> = {};
    if (input.mode === "form") {
      Object.assign(patch, {
        displayName: input.displayName,
        slug: input.slug,
        primaryEmail: input.primaryEmail,
        website: input.website,
        primaryPublicUrl: input.primaryPublicUrl,
        timezone: input.timezone,
        shortDescription: input.shortDescription,
        platforms: input.platforms,
        status: input.status || profile.status,
      });
    } else {
      const jsonKeys = ["displayName", "slug", "primaryEmail", "website", "primaryPublicUrl", "timezone", "shortDescription", "platforms", "status"] as const;
      for (const key of jsonKeys) {
        if (input[key] !== undefined) patch[key] = input[key];
      }
    }
    if (input.removeAvatar) {
      patch.avatarUrl = "";
      patch.avatarMediaId = "";
    } else if (input.avatarFile) {
      const buffer = Buffer.from(await input.avatarFile.arrayBuffer());
      const saved = await saveProfileImageBuffer({
        buffer,
        mimeType: input.avatarFile.type,
        originalName: input.avatarFile.name,
      });
      patch.avatarUrl = saved.url;
      patch.avatarMediaId = saved.id;
    } else if (input.avatarUrl !== undefined) {
      patch.avatarUrl = input.avatarUrl;
    }
    const saved = await updateManagedProfile(id, patch);
    return NextResponse.json({ ok: true, profile: toPublicProfile(saved) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update profile.";
    const status = /required|supported|Maximum|pixels|read this image/i.test(message) ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request, { params }: Params) {
  const result = await requireOperator();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.action !== "activate") {
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }
  try {
    const operator = await setActiveProfileForOperator(result.operator.id, id);
    await setMeta("active_profile_id", id);
    const next = await getManagedProfile(id);
    return NextResponse.json({
      ok: true,
      operator: publicOperator(operator),
      activeProfile: toPublicProfile(next),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Could not switch profile.",
    }, { status: 400 });
  }
}
