"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "../components/app/PageShell.jsx";
import PageHeader from "../components/app/PageHeader.jsx";
import FormField, { fieldClass } from "../components/app/FormField.jsx";
import { PLATFORMS } from "../data/models.js";
import { PROFILE_STATUSES, slugifyProfileName } from "../data/profileModels.js";
import { listIanaTimezones } from "../data/timezones.js";
import {
  PROFILE_IMAGE_ACCEPT,
  formatBytesAsKb,
  loadImageDimensions,
  validateImageDimensions,
  validateProfileImageFile,
} from "../data/profileImage.js";
import {
  PROFILE_FIELD_IDS,
  PROFILE_FIELD_ORDER,
  validateOptionalWebsite,
  validateProfileEmail,
  validateProfileName,
  validateProfileSetupFields,
  validateProfileSlug,
  validateRequiredHttpUrl,
} from "../data/profileForm.js";
import { useProfileSession } from "../components/app/ProfileSession.jsx";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { activeProfile, refresh } = useProfileSession();
  const timezones = useMemo(() => listIanaTimezones(), []);
  const fileInputRef = useRef(null);
  const [displayName, setDisplayName] = useState(activeProfile?.displayName || "");
  const [slug, setSlug] = useState(activeProfile?.slug || "");
  const [slugTouched, setSlugTouched] = useState(true);
  const [primaryEmail, setPrimaryEmail] = useState(activeProfile?.primaryEmail || "");
  const [primaryPublicUrl, setPrimaryPublicUrl] = useState(activeProfile?.primaryPublicUrl || "");
  const [website, setWebsite] = useState(activeProfile?.website || "");
  const [timezone, setTimezone] = useState(activeProfile?.timezone || "America/New_York");
  const [shortDescription, setShortDescription] = useState(activeProfile?.shortDescription || "");
  const [status, setStatus] = useState(activeProfile?.status || "ACTIVE");
  const [platforms, setPlatforms] = useState(activeProfile?.platforms || []);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(activeProfile?.avatarUrl || "");
  const [imageMeta, setImageMeta] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [formSummary, setFormSummary] = useState("");
  const [savedNote, setSavedNote] = useState("");

  useEffect(() => {
    if (!activeProfile) return;
    setDisplayName(activeProfile.displayName || "");
    setSlug(activeProfile.slug || "");
    setPrimaryEmail(activeProfile.primaryEmail || "");
    setPrimaryPublicUrl(activeProfile.primaryPublicUrl || "");
    setWebsite(activeProfile.website || "");
    setTimezone(activeProfile.timezone || "America/New_York");
    setShortDescription(activeProfile.shortDescription || "");
    setStatus(activeProfile.status || "ACTIVE");
    setPlatforms(activeProfile.platforms || []);
    if (!imageFile) setImagePreview(activeProfile.avatarUrl || "");
  }, [activeProfile, imageFile]);

  const clearFieldError = (key) => {
    setErrors((current) => (current[key] ? { ...current, [key]: "" } : current));
  };

  const onName = (value) => {
    setDisplayName(value);
    if (!slugTouched) setSlug(slugifyProfileName(value));
    if (value.trim()) clearFieldError("displayName");
  };

  const togglePlatform = (platform) => {
    setPlatforms((current) => {
      const next = current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform];
      if (next.length) clearFieldError("platforms");
      return next;
    });
  };

  const resetPickedImage = () => {
    if (imagePreview && imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImageMeta(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const fileCheck = validateProfileImageFile(file);
    if (!fileCheck.ok) {
      resetPickedImage();
      setErrors((current) => ({ ...current, avatar: fileCheck.error }));
      return;
    }
    try {
      const { width, height } = await loadImageDimensions(file);
      const dimensionCheck = validateImageDimensions(width, height);
      if (!dimensionCheck.ok) {
        resetPickedImage();
        setErrors((current) => ({ ...current, avatar: dimensionCheck.error }));
        return;
      }
      resetPickedImage();
      const preview = URL.createObjectURL(file);
      setImageFile(file);
      setImagePreview(preview);
      setImageMeta({ name: file.name, bytes: file.size, width, height });
      setRemoveAvatar(false);
      clearFieldError("avatar");
    } catch {
      resetPickedImage();
      setErrors((current) => ({
        ...current,
        avatar: "We couldn't read this image. Try another PNG, JPG, or WebP file.",
      }));
    }
  };

  const removeImage = () => {
    resetPickedImage();
    setImagePreview("");
    setRemoveAvatar(true);
    clearFieldError("avatar");
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const result = validateProfileSetupFields({
      displayName,
      slug,
      primaryEmail,
      primaryPublicUrl,
      website,
      platforms,
    }, { imageError: errors.avatar || "" });
    setErrors(result.errors);
    setFormSummary(result.summary);
    if (result.count) {
      const first = PROFILE_FIELD_ORDER.find((key) => result.invalidKeys.includes(key));
      document.getElementById(PROFILE_FIELD_IDS[first])?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById(PROFILE_FIELD_IDS[first])?.focus();
      return;
    }
    if (!activeProfile?.id) {
      setFormSummary("No active profile to edit.");
      return;
    }
    setSaving(true);
    setSavedNote("");
    try {
      const form = new FormData();
      form.set("displayName", displayName.trim());
      form.set("slug", result.slug);
      form.set("primaryEmail", primaryEmail.trim());
      form.set("primaryPublicUrl", primaryPublicUrl.trim());
      form.set("website", website.trim());
      form.set("timezone", timezone);
      form.set("shortDescription", shortDescription.trim());
      form.set("platforms", platforms.join(","));
      form.set("status", status);
      if (removeAvatar) form.set("removeAvatar", "1");
      if (imageFile) form.set("avatar", imageFile);
      const response = await fetch(`/api/profiles/${activeProfile.id}`, { method: "PATCH", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) {
        setFormSummary(body.error || "Could not save this profile.");
        return;
      }
      await refresh();
      setSavedNote("Profile saved.");
      router.refresh();
    } catch {
      setFormSummary("Could not save this profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!activeProfile) {
    return (
      <PageShell width="narrow">
        <PageHeader title="Edit profile" description="Select or create a managed profile first." />
      </PageShell>
    );
  }

  const initial = (activeProfile.displayName || "?").slice(0, 1).toUpperCase();
  const showingImage = Boolean(imagePreview) && !removeAvatar;

  return (
    <PageShell width="narrow" className="space-y-8">
      <PageHeader
        title="Edit profile"
        description={`${activeProfile.displayName} · Active profile. This is not the signed-in Google operator.`}
      />

      <form className="rl-panel space-y-5 p-6" onSubmit={onSubmit} noValidate>
        {formSummary ? (
          <p className="rounded-lg border border-rl_danger/30 bg-rl_danger/10 px-3 py-2 text-sm text-rl_danger" role="alert">
            {formSummary}
          </p>
        ) : null}
        {savedNote ? <p className="text-sm text-rl_ok">{savedNote}</p> : null}

        <FormField
          id="profile-image"
          label="Profile image"
          hint="PNG, JPG, or WebP. Maximum 500 KB. SVG is not supported."
          error={errors.avatar}
        >
          <input
            ref={fileInputRef}
            id="profile-image"
            type="file"
            accept={PROFILE_IMAGE_ACCEPT}
            className="sr-only"
            onChange={onImage}
          />
          {showingImage ? (
            <div className="flex items-center gap-3 rounded-lg border border-rl_border p-3">
              <img src={imagePreview} alt="" className="h-16 w-16 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-rl_text">{imageMeta?.name || "Current image"}</p>
                {imageMeta ? (
                  <>
                    <p className="text-xs text-rl_muted">{imageMeta.width} × {imageMeta.height}</p>
                    <p className="text-xs text-rl_muted">{formatBytesAsKb(imageMeta.bytes)}</p>
                  </>
                ) : (
                  <p className="text-xs text-rl_muted">Stored profile image</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <button type="button" className="rl-btn-ghost text-xs" onClick={() => fileInputRef.current?.click()}>
                  Change image
                </button>
                <button type="button" className="rl-btn-ghost text-xs" onClick={removeImage}>
                  Remove image
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rl_surfaceActive text-lg font-semibold">
                {initial}
              </span>
              <button type="button" className="rl-btn-ghost text-xs" onClick={() => fileInputRef.current?.click()}>
                Change image
              </button>
            </div>
          )}
        </FormField>

        <FormField id="profile-name" label="Profile name" error={errors.displayName}>
          <input
            id="profile-name"
            className={fieldClass}
            value={displayName}
            onChange={(event) => onName(event.target.value)}
            onBlur={() => setErrors((current) => ({ ...current, displayName: validateProfileName(displayName) }))}
          />
        </FormField>

        <FormField id="profile-slug" label="Slug" error={errors.slug}>
          <input
            id="profile-slug"
            className={fieldClass}
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
              if (!validateProfileSlug(event.target.value || slugifyProfileName(displayName))) clearFieldError("slug");
            }}
            onBlur={() => setErrors((current) => ({
              ...current,
              slug: validateProfileSlug(slug || slugifyProfileName(displayName)),
            }))}
          />
        </FormField>

        <FormField id="profile-email" label="Primary email" error={errors.primaryEmail}>
          <input
            id="profile-email"
            type="email"
            className={fieldClass}
            value={primaryEmail}
            onChange={(event) => {
              setPrimaryEmail(event.target.value);
              if (!validateProfileEmail(event.target.value)) clearFieldError("primaryEmail");
            }}
            onBlur={() => setErrors((current) => ({ ...current, primaryEmail: validateProfileEmail(primaryEmail) }))}
          />
        </FormField>

        <FormField id="profile-public" label="Primary public link" error={errors.primaryPublicUrl}>
          <input
            id="profile-public"
            className={fieldClass}
            value={primaryPublicUrl}
            onChange={(event) => {
              setPrimaryPublicUrl(event.target.value);
              if (!validateRequiredHttpUrl(event.target.value)) clearFieldError("primaryPublicUrl");
            }}
            onBlur={() => setErrors((current) => ({
              ...current,
              primaryPublicUrl: validateRequiredHttpUrl(primaryPublicUrl),
            }))}
          />
        </FormField>

        <FormField id="profile-website" label="Website" hint="Optional." error={errors.website}>
          <input
            id="profile-website"
            className={fieldClass}
            value={website}
            onChange={(event) => {
              setWebsite(event.target.value);
              if (!validateOptionalWebsite(event.target.value)) clearFieldError("website");
            }}
            onBlur={() => setErrors((current) => ({ ...current, website: validateOptionalWebsite(website) }))}
          />
        </FormField>

        <FormField id="profile-tz" label="Timezone">
          <select id="profile-tz" className={fieldClass} value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {timezones.map((zone) => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
        </FormField>

        <FormField id="profile-desc" label="Short description">
          <textarea
            id="profile-desc"
            className={fieldClass}
            rows={3}
            value={shortDescription}
            onChange={(event) => setShortDescription(event.target.value)}
          />
        </FormField>

        <FormField id="profile-status" label="Profile status">
          <select id="profile-status" className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            {PROFILE_STATUSES.map((item) => (
              <option key={item} value={item}>{item === "ACTIVE" ? "Active" : "Inactive"}</option>
            ))}
          </select>
        </FormField>

        <div>
          <p className="text-xs font-medium text-rl_muted" id="profile-platforms-label">Main platforms</p>
          <div id="profile-platforms" tabIndex={-1} className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="profile-platforms-label">
            {PLATFORMS.map((platform) => {
              const selected = platforms.includes(platform);
              return (
                <button
                  key={platform}
                  type="button"
                  onClick={() => togglePlatform(platform)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    selected ? "border-rl_accent bg-rl_accent/10 text-rl_text" : "border-rl_border text-rl_muted"
                  }`}
                >
                  {platform}
                </button>
              );
            })}
          </div>
          {errors.platforms ? <p className="mt-1 text-[11px] text-rl_danger">{errors.platforms}</p> : null}
        </div>

        <button type="submit" className="rl-btn w-full" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </PageShell>
  );
}
