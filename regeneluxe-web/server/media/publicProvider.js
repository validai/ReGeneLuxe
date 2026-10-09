import { classifyMediaUrl } from "../../src/data/mediaReadiness.js";

const BLOB_API = "https://blob.vercel-storage.com";

let providerOverride = null;

export function setPublicMediaProviderForTests(provider) {
  providerOverride = provider;
}

export function publicMediaReadiness() {
  if (providerOverride?.name === "memory") return { status: "READY", provider: "memory" };
  const selected = String(process.env.PUBLIC_MEDIA_PROVIDER || "").trim();
  if (selected !== "vercel_blob") return { status: "NOT_CONFIGURED", provider: selected };
  const token = String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
  if (!token) return { status: "NOT_CONFIGURED", provider: "vercel_blob" };
  return { status: "READY", provider: "vercel_blob" };
}

export function createMemoryMediaProvider() {
  const objects = new Map();
  return {
    name: "memory",
    objects,
    async health() {
      return { ok: true, status: "READY" };
    },
    async prepare({ objectKey, body, mimeType }) {
      const publicUrl = `https://media.test.example/${objectKey}`;
      objects.set(objectKey, { body, mimeType, publicUrl });
      return { ok: true, publicUrl, objectKey };
    },
    async remove({ objectKey }) {
      const existed = objects.delete(objectKey);
      return { ok: true, alreadyGone: !existed };
    },
  };
}

export function createVercelBlobProvider({
  token = process.env.BLOB_READ_WRITE_TOKEN || "",
  fetchImpl = fetch,
} = {}) {
  const secret = String(token || "").trim();
  return {
    name: "vercel_blob",
    async health() {
      if (!secret) return { ok: false, status: "NOT_CONFIGURED" };
      return { ok: true, status: "READY" };
    },
    async prepare({ objectKey, body, mimeType }) {
      if (!secret) return { ok: false, code: "MEDIA_NOT_PUBLIC", error: "Public media delivery is not configured." };
      const url = new URL(`${BLOB_API}/${objectKey.split("/").map(encodeURIComponent).join("/")}`);
      const response = await fetchImpl(url, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${secret}`,
          "x-api-version": "7",
          "x-content-type": mimeType,
          "x-vercel-blob-access": "public",
        },
        body,
      });
      const json = await response.json().catch(() => ({}));
      const publicUrl = String(json.url || "");
      if (!response.ok || classifyMediaUrl(publicUrl) !== "PUBLIC_PROVIDER_MEDIA") {
        return { ok: false, code: "MEDIA_NOT_PUBLIC", error: "The media host did not return a public HTTPS URL." };
      }
      return { ok: true, publicUrl, objectKey: json.pathname || objectKey };
    },
    async remove({ objectKey, publicUrl }) {
      if (!secret) return { ok: false, code: "MEDIA_NOT_PUBLIC" };
      const response = await fetchImpl(`${BLOB_API}/delete`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "x-api-version": "7",
          "content-type": "application/json",
        },
        body: JSON.stringify({ urls: [publicUrl].filter(Boolean) }),
      });
      if (response.status === 404) return { ok: true, alreadyGone: true };
      if (!response.ok) return { ok: false, code: "PROVIDER_UNAVAILABLE" };
      return { ok: true, alreadyGone: false, objectKey };
    },
  };
}

export function resolvePublicMediaProvider() {
  if (providerOverride) return providerOverride;
  const readiness = publicMediaReadiness();
  if (readiness.status !== "READY" || readiness.provider !== "vercel_blob") return null;
  return createVercelBlobProvider();
}
