"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BrandTitle from "../components/BrandTitle.jsx";
import FormField, { fieldClass } from "../components/app/FormField.jsx";
import { PLATFORMS } from "../data/models.js";
import { slugifyProfileName } from "../data/profileModels.js";
import { guessTimezone, listIanaTimezones } from "../data/timezones.js";
import {
  PROFILE_IMAGE_ACCEPT,
  formatBytesAsKb,
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

function loadImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    image.src = url;
  });
}

export default function ProfileSetupPage({ operator }) {
  const router = useRouter();
  const timezones = useMemo(() => listIanaTimezones(), []);
  const fileInputRef = useRef(null);
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [primaryPublicUrl, setPrimaryPublicUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [timezone, setTimezone] = useState(guessTimezone());
  const [shortDescription, setShortDescription] = useState("");
  const [platforms, setPlatforms] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageMeta, setImageMeta] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [formSummary, setFormSummary] = useState("");

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

  const resetImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview("");
    setImageMeta(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    clearFieldError("avatar");
  };

  const onImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const fileCheck = validateProfileImageFile(file);
    if (!fileCheck.ok) {
      resetImage();
      setErrors((current) => ({ ...current, avatar: fileCheck.error }));
      return;
    }
    try {
      const { width, height } = await loadImageDimensions(file);
      const dimensionCheck = validateImageDimensions(width, height);
      if (!dimensionCheck.ok) {
        resetImage();
        setErrors((current) => ({ ...current, avatar: dimensionCheck.error }));
        return;
      }
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      const preview = URL.createObjectURL(file);
      setImageFile(file);
      setImagePreview(preview);
      setImageMeta({
        name: file.name,
        bytes: file.size,
        width,
        height,
      });
      clearFieldError("avatar");
    } catch {
      resetImage();
      setErrors((current) => ({
        ...current,
        avatar: "We couldn't read this image. Try another PNG, JPG, or WebP file.",
      }));
    }
  };

  const focusFirstInvalid = (invalidKeys) => {
    const first = PROFILE_FIELD_ORDER.find((key) => invalidKeys.includes(key));
    const id = PROFILE_FIELD_IDS[first];
    const node = id ? document.getElementById(id) : null;
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.focus();
    }
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
      focusFirstInvalid(result.invalidKeys);
      return;
    }
    setSaving(true);
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
      if (imageFile) form.set("avatar", imageFile);
      const response = await fetch("/api/profiles", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) {
        setFormSummary(body.error || "Could not save this profile.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setFormSummary("Could not save this profile. Check that the local database is available.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-rl_bg px-4 py-12 text-rl_text">
      <div className="mx-auto w-full max-w-xl space-y-8">
        <div className="space-y-2 text-center">
          <BrandTitle variant="header" />
          <h1 className="font-display text-2xl font-semibold tracking-tight">Profile setup</h1>
          <p className="text-sm text-rl_muted">
            Create the first managed profile for this workspace.
            {operator?.name ? ` Signed in as ${operator.name}.` : ""}
          </p>
        </div>

        <form className="rl-panel space-y-5 p-6" onSubmit={onSubmit} noValidate>
          {formSummary ? (
            <p className="rounded-lg border border-rl_danger/30 bg-rl_danger/10 px-3 py-2 text-sm text-rl_danger" role="alert">
              {formSummary}
            </p>
          ) : null}

          <FormField id="profile-name" label="Profile name" error={errors.displayName}>
            <input
              id="profile-name"
              className={fieldClass}
              value={displayName}
              onChange={(event) => onName(event.target.value)}
              onBlur={() => setErrors((current) => ({ ...current, displayName: validateProfileName(displayName) }))}
              placeholder="Creator or brand name"
              autoComplete="organization"
            />
          </FormField>

          <FormField id="profile-slug" label="Slug" hint="Used internally. You can keep the suggested value." error={errors.slug}>
            <input
              id="profile-slug"
              className={fieldClass}
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
                if (!validateProfileSlug(event.target.value || slugifyProfileName(displayName))) {
                  clearFieldError("slug");
                }
              }}
              onBlur={() => setErrors((current) => ({
                ...current,
                slug: validateProfileSlug(slug || slugifyProfileName(displayName)),
              }))}
              placeholder="my-brand"
            />
          </FormField>

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
            {imageMeta && imagePreview ? (
              <div className="flex items-center gap-3 rounded-lg border border-rl_border p-3">
                <img src={imagePreview} alt="" className="h-14 w-14 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-rl_text">{imageMeta.name}</p>
                  <p className="text-xs text-rl_muted">
                    {imageMeta.width} × {imageMeta.height}
                  </p>
                  <p className="text-xs text-rl_muted">{formatBytesAsKb(imageMeta.bytes)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button type="button" className="rl-btn-ghost text-xs" onClick={() => fileInputRef.current?.click()}>
                    Replace image
                  </button>
                  <button type="button" className="rl-btn-ghost text-xs" onClick={resetImage}>
                    Remove image
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className={`${fieldClass} text-left text-rl_muted`} onClick={() => fileInputRef.current?.click()}>
                Choose image
              </button>
            )}
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
              placeholder="public or booking email"
            />
          </FormField>

          <FormField
            id="profile-public"
            label="Primary public link"
            hint="Channel, hub, or public profile URL. Independent from website."
            error={errors.primaryPublicUrl}
          >
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
              placeholder="https://www.youtube.com/@…"
            />
          </FormField>

          <FormField
            id="profile-website"
            label="Website"
            hint="Optional. Leave blank if this profile has no domain."
            error={errors.website}
          >
            <input
              id="profile-website"
              className={fieldClass}
              value={website}
              onChange={(event) => {
                setWebsite(event.target.value);
                if (!validateOptionalWebsite(event.target.value)) clearFieldError("website");
              }}
              onBlur={() => setErrors((current) => ({ ...current, website: validateOptionalWebsite(website) }))}
              placeholder="https://"
            />
          </FormField>

          <FormField id="profile-tz" label="Timezone">
            <select
              id="profile-tz"
              className={fieldClass}
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            >
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
              placeholder="One or two lines."
            />
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
      </div>
    </div>
  );
}
