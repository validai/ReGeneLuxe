"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BrandTitle from "../components/BrandTitle.jsx";
import FormField, { fieldClass } from "../components/app/FormField.jsx";
import { PLATFORMS } from "../data/models.js";
import { slugifyProfileName } from "../data/profileModels.js";
import { guessTimezone, listIanaTimezones } from "../data/timezones.js";

export default function ProfileSetupPage({ operator }) {
  const router = useRouter();
  const timezones = useMemo(() => listIanaTimezones(), []);
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [primaryPublicUrl, setPrimaryPublicUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [timezone, setTimezone] = useState(guessTimezone());
  const [shortDescription, setShortDescription] = useState("");
  const [platforms, setPlatforms] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const onName = (value) => {
    setDisplayName(value);
    if (!slugTouched) setSlug(slugifyProfileName(value));
  };

  const togglePlatform = (platform) => {
    setPlatforms((current) => (
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    ));
  };

  const onImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 500_000) {
      setError("Choose an image under 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!displayName.trim()) {
      setError("Profile name is required.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          slug: slug.trim(),
          primaryEmail: primaryEmail.trim(),
          primaryPublicUrl: primaryPublicUrl.trim(),
          website: website.trim() ? website.trim() : null,
          timezone,
          shortDescription: shortDescription.trim(),
          avatarUrl,
          platforms,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) {
        setError(body.error || "Could not save this profile.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not save this profile. Check that the local database is available.");
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

        <form className="rl-panel space-y-5 p-6" onSubmit={onSubmit}>
          <FormField id="profile-name" label="Profile name" error={!displayName && error.includes("name") ? error : ""}>
            <input
              id="profile-name"
              className={fieldClass}
              value={displayName}
              onChange={(event) => onName(event.target.value)}
              placeholder="Creator or brand name"
              autoComplete="organization"
              required
            />
          </FormField>

          <FormField id="profile-slug" label="Slug" hint="Used internally. You can keep the suggested value.">
            <input
              id="profile-slug"
              className={fieldClass}
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              placeholder="my-brand"
            />
          </FormField>

          <FormField id="profile-image" label="Profile image">
            <input id="profile-image" type="file" accept="image/*" className={fieldClass} onChange={onImage} />
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="mt-2 h-14 w-14 rounded-full object-cover" />
            ) : null}
          </FormField>

          <FormField id="profile-email" label="Primary email">
            <input
              id="profile-email"
              type="email"
              className={fieldClass}
              value={primaryEmail}
              onChange={(event) => setPrimaryEmail(event.target.value)}
              placeholder="public or booking email"
            />
          </FormField>

          <FormField id="profile-public" label="Primary public link" hint="Channel, hub, or public profile URL. Independent from website.">
            <input
              id="profile-public"
              className={fieldClass}
              value={primaryPublicUrl}
              onChange={(event) => setPrimaryPublicUrl(event.target.value)}
              placeholder="https://www.youtube.com/@…"
            />
          </FormField>

          <FormField id="profile-website" label="Website" hint="Optional. Leave blank if this profile has no domain.">
            <input
              id="profile-website"
              className={fieldClass}
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
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
            <p className="text-xs font-medium text-rl_muted">Main platforms</p>
            <div className="mt-2 flex flex-wrap gap-2">
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
          </div>

          {error ? <p className="text-sm text-rl_danger" role="alert">{error}</p> : null}

          <button type="submit" className="rl-btn w-full" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </button>
        </form>
      </div>
    </div>
  );
}
