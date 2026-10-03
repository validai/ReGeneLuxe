import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../server/auth/apiGuard.js";
import { createManagedProfile, toPublicProfile } from "../../../server/db/managedProfileRepository.js";
import { setMeta } from "../../../server/db/index.js";
import { saveProfileImageBuffer } from "../../../server/media/store.js";
import { readProfileInput } from "../../../server/profiles/readProfileInput.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const result = await requireWorkspaceApi(request);
  if (!result.ok) return deniedJson(result.error, result.status);
  return jsonPrivate({
    ok: true,
    profiles: result.publicProfiles,
    activeProfile: result.publicActiveProfile,
  });
}

export async function POST(request: Request) {
  const result = await requireWorkspaceApi(request, { mutate: true });
  if (!result.ok) return deniedJson(result.error, result.status);

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
        managedProfileId: result.workspace?.id || "",
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
    return jsonPrivate({ ok: true, profile: toPublicProfile(profile) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create account.";
    const conflict = /already has a brand workspace/i.test(message);
    const status = conflict ? 409 : /required|supported|Maximum|pixels|read this image/i.test(message) ? 400 : 500;
    return jsonPrivate({ ok: false, error: conflict ? message : (status === 400 ? message : "Could not create account.") }, status);
  }
}
