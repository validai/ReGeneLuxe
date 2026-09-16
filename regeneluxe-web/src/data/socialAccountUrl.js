import { PLATFORMS } from "./models.js";

const UNKNOWN_MESSAGE = "We couldn't identify the platform from this URL. Choose a platform manually.";

const HOST_TO_PLATFORM = {
  "instagram.com": "Instagram",
  "youtube.com": "YouTube",
  "m.youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "x.com": "X",
  "twitter.com": "X",
  "mobile.twitter.com": "X",
  "tiktok.com": "TikTok",
  "vm.tiktok.com": "TikTok",
  "facebook.com": "Facebook",
  "fb.com": "Facebook",
  "fb.me": "Facebook",
  "m.facebook.com": "Facebook",
  "threads.net": "Threads",
  "www.threads.net": "Threads",
  "soundcloud.com": "SoundCloud",
  "on.soundcloud.com": "SoundCloud",
  "snapchat.com": "Snapchat",
  "twitch.tv": "Twitch",
  "kick.com": "Kick",
};

function stripWww(host) {
  return String(host || "").toLowerCase().replace(/^www\./, "");
}

function cleanPath(pathname) {
  return String(pathname || "/").split("?")[0].split("#")[0];
}

function firstSegment(pathname) {
  const parts = cleanPath(pathname).split("/").filter(Boolean);
  return parts[0] || "";
}

function looksLikeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (/^https?:\/\//i.test(raw)) return true;
  if (raw.includes(" ") || raw.startsWith("@")) return false;
  return /^(?:[\w-]+\.)+[\w-]+(?:[/:?#].*)?$/i.test(raw);
}

function toUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

function handleFromSegment(segment) {
  return String(segment || "").replace(/^@/, "").split("?")[0].replace(/\/+$/, "");
}

function canonicalFor(platform, handle, sourceUrl) {
  const id = handleFromSegment(handle);
  if (!id) return sourceUrl || "";
  switch (platform) {
    case "Instagram":
      return `https://www.instagram.com/${id}/`;
    case "YouTube":
      if (id.startsWith("UC") && id.length >= 16) return `https://www.youtube.com/channel/${id}`;
      return `https://www.youtube.com/@${id}`;
    case "X":
      return `https://x.com/${id}`;
    case "TikTok":
      return `https://www.tiktok.com/@${id}`;
    case "Facebook":
      if (/^\d+$/.test(id)) return `https://www.facebook.com/profile.php?id=${id}`;
      return `https://www.facebook.com/${id}`;
    case "Threads":
      return `https://www.threads.net/@${id}`;
    case "SoundCloud":
      return `https://soundcloud.com/${id}`;
    case "Snapchat":
      return `https://www.snapchat.com/add/${id}`;
    case "Twitch":
      return `https://www.twitch.tv/${id}`;
    case "Kick":
      return `https://kick.com/${id}`;
    default:
      return sourceUrl || "";
  }
}

function parseYouTube(url) {
  const host = stripWww(url.hostname);
  if (host === "youtu.be") {
    return { platform: "YouTube", handle: "", profileUrl: url.toString(), note: "Video URL — add the channel URL or @handle." };
  }
  const parts = cleanPath(url.pathname).split("/").filter(Boolean);
  if (parts[0] === "watch" || parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") {
    return { platform: "YouTube", handle: "", profileUrl: "https://www.youtube.com/", note: "Video URL — add the channel URL or @handle." };
  }
  if (parts[0] === "channel" && parts[1]) {
    return { platform: "YouTube", handle: parts[1], profileUrl: canonicalFor("YouTube", parts[1]) };
  }
  if ((parts[0] === "c" || parts[0] === "user") && parts[1]) {
    return { platform: "YouTube", handle: parts[1], profileUrl: `https://www.youtube.com/${parts[0]}/${parts[1]}` };
  }
  if (parts[0]?.startsWith("@")) {
    const handle = handleFromSegment(parts[0]);
    return { platform: "YouTube", handle, profileUrl: canonicalFor("YouTube", handle) };
  }
  if (parts[0]) {
    const handle = handleFromSegment(parts[0]);
    return { platform: "YouTube", handle, profileUrl: canonicalFor("YouTube", handle) };
  }
  return { platform: "YouTube", handle: "", profileUrl: "https://www.youtube.com/" };
}

function parseFacebook(url) {
  const id = url.searchParams.get("id");
  if (url.pathname.includes("profile.php") && id) {
    return { platform: "Facebook", handle: id, profileUrl: canonicalFor("Facebook", id) };
  }
  const skip = new Set(["pages", "watch", "reel", "share", "photo", "permalink.php"]);
  const parts = cleanPath(url.pathname).split("/").filter(Boolean);
  const name = parts.find((part) => !skip.has(part.toLowerCase()));
  if (!name) return { platform: "Facebook", handle: "", profileUrl: "https://www.facebook.com/" };
  return { platform: "Facebook", handle: name, profileUrl: canonicalFor("Facebook", name) };
}

function firstNamedSegment(pathname, skip) {
  const parts = cleanPath(pathname).split("/").filter(Boolean);
  const name = parts.find((part) => !skip.has(part.toLowerCase()));
  return handleFromSegment(name || "");
}

function parseSnapchat(url) {
  const handle = firstNamedSegment(url.pathname, new Set([
    "add", "discover", "spotlight", "lens", "lenses", "snapcodes", "download", "create",
  ]));
  return { platform: "Snapchat", handle, profileUrl: canonicalFor("Snapchat", handle, url.toString()) };
}

function parseTwitch(url) {
  const handle = firstNamedSegment(url.pathname, new Set([
    "directory", "videos", "clips", "settings", "inventory", "drops", "following",
    "browse", "search", "login", "signup", "p", "popout", "turbo", "subscriptions",
  ]));
  return { platform: "Twitch", handle, profileUrl: canonicalFor("Twitch", handle, url.toString()) };
}

function parseKick(url) {
  const handle = firstNamedSegment(url.pathname, new Set([
    "categories", "category", "video", "videos", "clips", "clip",
    "browse", "search", "login", "signup", "settings",
  ]));
  return { platform: "Kick", handle, profileUrl: canonicalFor("Kick", handle, url.toString()) };
}

function parseFromUrl(url) {
  const host = stripWww(url.hostname);
  const platform = HOST_TO_PLATFORM[host];
  if (!platform) return null;
  if (platform === "YouTube") return parseYouTube(url);
  if (platform === "Facebook") return parseFacebook(url);
  if (platform === "Snapchat") return parseSnapchat(url);
  if (platform === "Twitch") return parseTwitch(url);
  if (platform === "Kick") return parseKick(url);
  const segment = firstSegment(url.pathname);
  if (platform === "TikTok" || platform === "Threads") {
    const handle = handleFromSegment(segment);
    return { platform, handle, profileUrl: canonicalFor(platform, handle, url.toString()) };
  }
  const handle = handleFromSegment(segment);
  return { platform, handle, profileUrl: canonicalFor(platform, handle, url.toString()) };
}

export function parseSocialIdentity(input, { platform: forcedPlatform = "" } = {}) {
  const raw = String(input || "").trim();
  if (!raw) {
    return {
      ok: false,
      detected: false,
      error: "Paste a profile URL or handle.",
      platform: forcedPlatform || "",
      handle: "",
      profileUrl: "",
      connectionState: "MANUAL_ONLY",
    };
  }

  if (looksLikeUrl(raw)) {
    const url = toUrl(raw);
    if (!url) {
      return {
        ok: false,
        detected: false,
        error: UNKNOWN_MESSAGE,
        platform: forcedPlatform || "",
        handle: "",
        profileUrl: raw,
        connectionState: "MANUAL_ONLY",
      };
    }
    const parsed = parseFromUrl(url);
    if (!parsed) {
      return {
        ok: false,
        detected: false,
        error: UNKNOWN_MESSAGE,
        platform: forcedPlatform || "",
        handle: "",
        profileUrl: url.toString(),
        connectionState: "MANUAL_ONLY",
      };
    }
    const platform = forcedPlatform || parsed.platform;
    return {
      ok: true,
      detected: !forcedPlatform || forcedPlatform === parsed.platform,
      platform,
      handle: parsed.handle || "",
      profileUrl: parsed.profileUrl,
      displayName: parsed.handle ? `@${String(parsed.handle).replace(/^@/, "")}` : "",
      connectionState: "MANUAL_ONLY",
      note: parsed.note || "",
      error: "",
    };
  }

  const handle = handleFromSegment(raw);
  const platform = forcedPlatform || "";
  return {
    ok: Boolean(platform),
    detected: false,
    platform,
    handle,
    profileUrl: platform ? canonicalFor(platform, handle) : "",
    displayName: handle ? `@${handle}` : "",
    connectionState: "MANUAL_ONLY",
    error: platform ? "" : "Choose a platform for this handle.",
  };
}

export function identityFromAccountDraft(draft) {
  const parsed = parseSocialIdentity(draft.profileUrl || draft.handle, { platform: draft.platform });
  return {
    ...parsed,
    platform: draft.platform || parsed.platform,
    displayName: draft.displayName || parsed.displayName,
  };
}

export { UNKNOWN_MESSAGE, PLATFORMS as SOCIAL_URL_PLATFORMS };
