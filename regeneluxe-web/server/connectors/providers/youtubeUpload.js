import { createReadStream, statSync } from "node:fs";

const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const CHUNK = 256 * 1024;

function mimeFor(filePath) {
  if (String(filePath).endsWith(".mov")) return "video/quicktime";
  if (String(filePath).endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

/**
 * Server-side resumable upload. privacyStatus is always private.
 */
export async function uploadPrivateYouTube({
  fetchImpl = fetch,
  accessToken,
  filePath,
  title,
  description = "",
} = {}) {
  const size = statSync(filePath).size;
  const init = await fetchImpl(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(size),
      "X-Upload-Content-Type": mimeFor(filePath),
    },
    body: JSON.stringify({
      snippet: { title: title || "ReGeneLuxe private pilot", description },
      status: { privacyStatus: "private" },
    }),
  });
  const session = init.headers.get("location");
  if (!init.ok || !session) {
    const json = await init.json?.().catch(() => ({})) || {};
    return { ok: false, error: json.error?.message || "YouTube upload session was not created.", code: "UPLOAD_SESSION_FAILED" };
  }

  let offset = 0;
  let videoId = "";
  while (offset < size) {
    const end = Math.min(offset + CHUNK, size) - 1;
    const stream = createReadStream(filePath, { start: offset, end });
    const chunks = [];
    for await (const piece of stream) chunks.push(piece);
    const body = Buffer.concat(chunks);
    const put = await fetchImpl(session, {
      method: "PUT",
      headers: {
        "Content-Length": String(body.length),
        "Content-Range": `bytes ${offset}-${end}/${size}`,
      },
      body,
    });
    if (put.status === 308) {
      const range = put.headers.get("range") || "";
      const uploaded = Number(String(range).split("-")[1] || end);
      offset = Number.isFinite(uploaded) ? uploaded + 1 : end + 1;
      continue;
    }
    const json = await put.json?.().catch(() => ({})) || {};
    if (!put.ok || !json.id) {
      return { ok: false, error: json.error?.message || "YouTube upload failed.", code: "UPLOAD_FAILED" };
    }
    videoId = json.id;
    offset = size;
  }
  return {
    ok: true,
    providerPostId: videoId,
    permalink: `https://www.youtube.com/watch?v=${videoId}`,
    providerStatus: "private",
    privacyStatus: "private",
  };
}
