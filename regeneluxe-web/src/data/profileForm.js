import { slugifyProfileName } from "./profileModels.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isHttpUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateProfileName(value) {
  return String(value || "").trim() ? "" : "Enter a profile name.";
}

export function validateProfileSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  if (!slug) return "Use letters, numbers, and hyphens only.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "Use letters, numbers, and hyphens only.";
  }
  return "";
}

export function validateProfileEmail(value) {
  const email = String(value || "").trim();
  if (!email || !EMAIL_PATTERN.test(email)) return "Enter a valid email address.";
  return "";
}

export function validateRequiredHttpUrl(value) {
  if (isHttpUrl(value)) return "";
  return "Enter a complete URL beginning with http:// or https://.";
}

export function validateOptionalWebsite(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return validateRequiredHttpUrl(raw);
}

export function validatePlatforms(platforms) {
  return Array.isArray(platforms) && platforms.length > 0
    ? ""
    : "Select at least one platform.";
}

export function resolveProfileSlug(slug, displayName) {
  const explicit = String(slug || "").trim();
  if (explicit) return explicit.toLowerCase();
  return slugifyProfileName(displayName);
}

export function validateProfileSetupFields(values, { imageError = "" } = {}) {
  const slug = resolveProfileSlug(values.slug, values.displayName);
  const errors = {
    displayName: validateProfileName(values.displayName),
    slug: validateProfileSlug(slug),
    primaryEmail: validateProfileEmail(values.primaryEmail),
    primaryPublicUrl: validateRequiredHttpUrl(values.primaryPublicUrl),
    website: validateOptionalWebsite(values.website),
    platforms: validatePlatforms(values.platforms),
    avatar: imageError || "",
  };
  const invalidKeys = Object.keys(errors).filter((key) => errors[key]);
  return {
    errors,
    invalidKeys,
    count: invalidKeys.length,
    slug,
    summary: invalidKeys.length
      ? `Please fix ${invalidKeys.length} field${invalidKeys.length === 1 ? "" : "s"} before saving.`
      : "",
  };
}

export const PROFILE_FIELD_ORDER = [
  "displayName",
  "slug",
  "avatar",
  "primaryEmail",
  "primaryPublicUrl",
  "website",
  "platforms",
];

export const PROFILE_FIELD_IDS = {
  displayName: "profile-name",
  slug: "profile-slug",
  avatar: "profile-image",
  primaryEmail: "profile-email",
  primaryPublicUrl: "profile-public",
  website: "profile-website",
  platforms: "profile-platforms",
};
