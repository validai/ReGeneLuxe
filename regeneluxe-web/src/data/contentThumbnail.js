/**
 * Derived visual identity for a content item.
 * Screens never see storage paths or media ids.
 */

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)(?:$|[?#])/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v)(?:$|[?#])/i;
const LOCAL_MEDIA = /^\/api\/media\/([A-Za-z0-9._-]+)$/;

const EMPTY = Object.freeze({
  kind: "none",
  src: "",
  alt: "",
  count: 0,
  duration: "",
});

function textOf(value) {
  return String(value || "").trim();
}

function asAttachment(value, role = "media") {
  if (value == null || value === "") return null;
  if (typeof value === "string" || typeof value === "number") {
    return { url: textOf(value), poster: "", mime: "", kind: "", alt: "", duration: "", role };
  }
  if (typeof value !== "object") return null;
  const url = textOf(value.url || value.href || value.src || value.mediaRef);
  const poster = textOf(value.thumbnail || value.poster || value.previewImage);
  return {
    url,
    poster,
    mime: textOf(value.mimeType || value.mime).toLowerCase(),
    kind: textOf(value.kind || value.type).toLowerCase(),
    alt: textOf(value.alt),
    duration: textOf(value.duration || value.length),
    role,
  };
}

function localMediaSrc(value) {
  const match = LOCAL_MEDIA.exec(textOf(value));
  if (!match || match[1].includes("..")) return "";
  return `/api/media/${match[1]}`;
}

function imageSrc(value) {
  const local = localMediaSrc(value);
  if (local) return local;
  const raw = textOf(value);
  if (!/^https:\/\//i.test(raw)) return "";
  if (!IMAGE_EXT.test(raw.split("?")[0])) return "";
  return raw;
}

function looksLikeVideo(attachment) {
  if (!attachment) return false;
  if (textOf(attachment.mime).startsWith("video/")) return true;
  if (attachment.kind === "video") return true;
  return VIDEO_EXT.test(textOf(attachment.url).split("?")[0]);
}

function looksLikeImage(attachment) {
  if (!attachment || looksLikeVideo(attachment)) return false;
  if (attachment.mime.startsWith("image/")) return true;
  if (attachment.kind === "image") return true;
  return Boolean(imageSrc(attachment.url) || imageSrc(attachment.poster));
}

function isVisual(attachment) {
  return looksLikeImage(attachment) || looksLikeVideo(attachment);
}

function collect(content = {}) {
  const items = [];
  const push = (value, role) => {
    const attachment = asAttachment(value, role);
    if (attachment && (attachment.url || attachment.poster)) items.push(attachment);
  };
  push(content.thumbnail, "poster");
  push(content.poster, "poster");
  push(content.previewImage, "link");
  push(content.openGraph?.image, "link");
  for (const ref of Array.isArray(content.mediaRefs) ? content.mediaRefs : []) push(ref, "media");
  for (const variant of Array.isArray(content.variants) ? content.variants : []) {
    push(variant?.thumbnail, "poster");
    push(variant?.mediaRef, "media");
  }
  push(content.imageUrl, "media");
  if (content.videoPath) push({ url: content.videoPath, kind: "video" }, "media");
  return items;
}

function altText(content, attachment) {
  const fromAttachment = textOf(attachment?.alt);
  if (fromAttachment && !fromAttachment.includes("/") && !fromAttachment.includes("\\")) return fromAttachment;
  return textOf(content.title || content.caption || content.concept) || "Content preview";
}

/**
 * @returns {{ kind: "image" | "video" | "none", src: string, alt: string, count: number, duration: string }}
 */
export function resolveContentThumbnail(content) {
  if (!content || typeof content !== "object") return { ...EMPTY };
  const items = collect(content);
  const seen = new Set();
  const visual = [];
  for (const item of items.filter(isVisual)) {
    const key = imageSrc(item.poster) || imageSrc(item.url) || item.url;
    if (seen.has(key)) continue;
    seen.add(key);
    visual.push(item);
  }
  const posters = [];
  for (const item of items) {
    const poster = imageSrc(item.poster) || (item.role === "poster" || item.role === "link" ? imageSrc(item.url) : "");
    if (poster) posters.push({ src: poster, attachment: item });
    if (looksLikeImage(item)) {
      const src = imageSrc(item.url) || imageSrc(item.poster);
      if (src && !posters.some((entry) => entry.src === src)) posters.push({ src, attachment: item });
    }
  }
  const chosen = posters[0];
  const video = visual.find(looksLikeVideo);
  const images = visual.filter((item) => looksLikeImage(item));
  const duration = textOf(video?.duration || content.variants?.find((variant) => variant?.length)?.length);
  if (chosen) {
    return {
      kind: looksLikeVideo(chosen.attachment) || (video && images.length === 0) ? "video" : "image",
      src: chosen.src,
      alt: altText(content, chosen.attachment),
      count: visual.length,
      duration,
    };
  }
  if (video) {
    return {
      kind: "video",
      src: "",
      alt: altText(content, video),
      count: visual.length,
      duration,
    };
  }
  return { ...EMPTY, alt: altText(content, null), count: 0 };
}

export function hasContentPreview(content) {
  const model = resolveContentThumbnail(content);
  return Boolean(model.src);
}

/** Operator-facing label. Hides filesystem paths and media ids. */
export function mediaAttachmentLabel(value) {
  const attachment = asAttachment(value);
  if (!attachment) return "Attachment";
  if (looksLikeVideo(attachment)) return "Video";
  if (looksLikeImage(attachment) || localMediaSrc(attachment.url) || localMediaSrc(attachment.poster)) return "Image";
  const url = attachment.url;
  if (!url) return "Attachment";
  if (url.startsWith("file:") || url.startsWith("/") || url.startsWith(".") || /^[A-Za-z]:\\/.test(url)) return "Attached file";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.hostname;
  } catch {
    // A typed note stays visible.
  }
  return url;
}
