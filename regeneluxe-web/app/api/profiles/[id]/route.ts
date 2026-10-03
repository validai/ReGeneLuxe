import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../../server/auth/apiGuard.js";
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

export async function GET(request: Request, { params }: Params) {
  const result = await requireWorkspaceApi(request);
  if (!result.ok) return deniedJson(result.error, result.status);
  const { id } = await params;
  const profile = await getManagedProfile(id);
  if (!profile || profile.ownerOperatorId !== result.operator.id) {
    return jsonPrivate({ ok: false, error: "Profile not found." }, 404);
  }
  return jsonPrivate({ ok: true, profile: toPublicProfile(profile) });
}

export async function PATCH(request: Request, { params }: Params) {
  const result = await requireWorkspaceApi(request, { mutate: true });
  if (!result.ok) return deniedJson(result.error, result.status);
  const { id } = await params;
  const profile = await getManagedProfile(id);
  if (!profile || profile.ownerOperatorId !== result.operator.id) {
    return jsonPrivate({ ok: false, error: "Profile not found." }, 404);
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
        managedProfileId: profile.id,
      });
      patch.avatarUrl = saved.url;
      patch.avatarMediaId = saved.id;
    } else if (input.avatarUrl !== undefined) {
      patch.avatarUrl = input.avatarUrl;
    }
    const saved = await updateManagedProfile(id, patch);
    return jsonPrivate({ ok: true, profile: toPublicProfile(saved) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update profile.";
    const status = /required|supported|Maximum|pixels|read this image/i.test(message) ? 400 : 500;
    return jsonPrivate({ ok: false, error: status === 400 ? message : "Could not update profile." }, status);
  }
}

export async function POST(request: Request, { params }: Params) {
  const result = await requireWorkspaceApi(request, { mutate: true });
  if (!result.ok) return deniedJson(result.error, result.status);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.action !== "activate") {
    return jsonPrivate({ ok: false, error: "Unknown action." }, 400);
  }
  try {
    const workspace = result.workspace || result.activeProfile;
    if (!workspace || workspace.id !== id) {
      return jsonPrivate({
        ok: false,
        error: "This ReGeneLuxe account already has a brand workspace. Use a different email to create another brand account.",
      }, 409);
    }
    const operator = await setActiveProfileForOperator(result.operator.id, id);
    await setMeta("active_profile_id", id);
    const next = await getManagedProfile(id);
    return jsonPrivate({
      ok: true,
      operator: publicOperator(operator),
      workspace: toPublicProfile(next),
      activeProfile: toPublicProfile(next),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load this account.";
    const conflict = /already has a brand workspace/i.test(message);
    return jsonPrivate({
      ok: false,
      error: conflict ? message : "Could not load this account.",
    }, conflict ? 409 : 400);
  }
}
