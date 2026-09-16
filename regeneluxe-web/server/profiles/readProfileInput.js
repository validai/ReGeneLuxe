import { sanitizeAvatarUrl } from "../../src/data/profileImage.js";

export async function readProfileInput(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("avatar");
    return {
      mode: "form",
      displayName: String(form.get("displayName") || ""),
      slug: String(form.get("slug") || ""),
      primaryEmail: String(form.get("primaryEmail") || ""),
      website: form.get("website") == null ? "" : String(form.get("website")),
      primaryPublicUrl: String(form.get("primaryPublicUrl") || ""),
      timezone: String(form.get("timezone") || ""),
      shortDescription: String(form.get("shortDescription") || ""),
      status: String(form.get("status") || ""),
      platforms: String(form.get("platforms") || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      avatarFile: file instanceof File && file.size > 0 ? file : null,
      removeAvatar: String(form.get("removeAvatar") || "") === "1",
      avatarUrl: "",
    };
  }
  const body = await request.json().catch(() => ({}));
  return {
    mode: "json",
    displayName: body.displayName,
    slug: body.slug,
    primaryEmail: body.primaryEmail,
    website: body.website,
    primaryPublicUrl: body.primaryPublicUrl,
    timezone: body.timezone,
    shortDescription: body.shortDescription,
    status: body.status,
    platforms: body.platforms,
    avatarFile: null,
    removeAvatar: Boolean(body.removeAvatar),
    avatarUrl: Object.prototype.hasOwnProperty.call(body, "avatarUrl")
      ? sanitizeAvatarUrl(body.avatarUrl)
      : undefined,
  };
}
