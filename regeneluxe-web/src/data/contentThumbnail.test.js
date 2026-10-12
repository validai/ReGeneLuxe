import { describe, expect, it } from "vitest";
import { mediaAttachmentLabel, resolveContentThumbnail } from "./contentThumbnail.js";

const COVER = "https://cdn.example.com/cover.jpg";
const SECOND = "https://cdn.example.com/second.png";
const POSTER = "https://cdn.example.com/poster.jpg";

describe("resolveContentThumbnail", () => {
  it("uses the primary image attachment", () => {
    const model = resolveContentThumbnail({
      title: "Night set",
      mediaRefs: ["studio note", COVER, SECOND],
    });
    expect(model).toMatchObject({ kind: "image", src: COVER, alt: "Night set", count: 2 });
  });

  it("prefers an explicit stored poster over a later image", () => {
    const model = resolveContentThumbnail({
      title: "Cut",
      thumbnail: POSTER,
      mediaRefs: [COVER],
    });
    expect(model.src).toBe(POSTER);
    expect(model.kind).toBe("image");
  });

  it("uses a stored video poster and keeps duration", () => {
    const model = resolveContentThumbnail({
      title: "Reel",
      mediaRefs: [{ url: "https://cdn.example.com/clip.mp4", thumbnail: POSTER, duration: "0:12" }],
    });
    expect(model).toMatchObject({ kind: "video", src: POSTER, count: 1, duration: "0:12" });
  });

  it("does not invent a thumbnail for text, notes, or a video with no poster", () => {
    expect(resolveContentThumbnail({ title: "Sunset beach photo", caption: "Hello" }).src).toBe("");
    expect(resolveContentThumbnail({ mediaRefs: ["call sheet for Friday"] }).src).toBe("");
    expect(resolveContentThumbnail({ mediaRefs: ["https://cdn.example.com/clip.mp4"] }).src).toBe("");
    expect(resolveContentThumbnail({ mediaRefs: ["https://cdn.example.com/clip.mp4"] }).kind).toBe("video");
  });

  it("keeps a workspace media route and rejects traversal or local paths", () => {
    expect(resolveContentThumbnail({ mediaRefs: ["/api/media/med_abc"] }).src).toBe("/api/media/med_abc");
    expect(resolveContentThumbnail({ mediaRefs: ["/api/media/../secret"] }).src).toBe("");
    expect(resolveContentThumbnail({ mediaRefs: ["file:///tmp/a.jpg"] }).src).toBe("");
    expect(resolveContentThumbnail({ imageUrl: "/Users/eric/Desktop/secret.jpg" }).src).toBe("");
  });

  it("reads a legacy image field and an existing link image", () => {
    expect(resolveContentThumbnail({ imageUrl: COVER, title: "Legacy" }).src).toBe(COVER);
    expect(resolveContentThumbnail({ openGraph: { image: SECOND }, title: "Link" }).src).toBe(SECOND);
  });

  it("hides filesystem paths and media ids from attachment labels", () => {
    expect(mediaAttachmentLabel("/Users/eric/Desktop/secret.jpg")).toBe("Attached file");
    expect(mediaAttachmentLabel("/api/media/med_abc")).toBe("Image");
    expect(mediaAttachmentLabel(COVER)).toBe("Image");
    expect(mediaAttachmentLabel("https://example.com/notes")).toBe("example.com");
    expect(mediaAttachmentLabel("call sheet")).toBe("call sheet");
  });
});
