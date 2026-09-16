import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { regeneluxeDir, ensureDirs } from "../db/paths.js";
import { createId } from "../../src/data/ids.js";
import { PROFILE_IMAGE_MIME, sanitizeAvatarUrl, validateProfileImageFile } from "../../src/data/profileImage.js";

export function mediaDir() {
  if (process.env.RL_MEDIA_DIR) return process.env.RL_MEDIA_DIR;
  return join(regeneluxeDir(), "media");
}

function ensureMediaDir() {
  ensureDirs();
  const dir = mediaDir();
  if (!existsSync(/* turbopackIgnore: true */ dir)) {
    mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true });
  }
  return dir;
}

export async function saveProfileImageBuffer({ buffer, mimeType, originalName = "" }) {
  const fakeFile = { size: buffer.length, type: mimeType, name: originalName };
  const check = validateProfileImageFile(fakeFile);
  if (!check.ok) {
    const error = new Error(check.error);
    error.code = check.code;
    throw error;
  }
  const dir = ensureMediaDir();
  const id = `med_${createId("med")}`;
  const ext = PROFILE_IMAGE_MIME[check.mime];
  const storedName = `${id}.${ext}`;
  writeFileSync(/* turbopackIgnore: true */ join(dir, storedName), buffer);
  const meta = {
    id,
    storedName,
    mimeType: check.mime,
    bytes: buffer.length,
    originalName: originalName || storedName,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(/* turbopackIgnore: true */ join(dir, `${id}.json`), JSON.stringify(meta, null, 2));
  return {
    ...meta,
    url: `/api/media/${id}`,
  };
}

export function readLocalMedia(id) {
  const safeId = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) return null;
  const dir = mediaDir();
  const metaPath = join(dir, `${safeId}.json`);
  if (!existsSync(/* turbopackIgnore: true */ metaPath)) return null;
  const meta = JSON.parse(readFileSync(/* turbopackIgnore: true */ metaPath, "utf8"));
  const filePath = join(dir, meta.storedName);
  if (!existsSync(/* turbopackIgnore: true */ filePath)) return null;
  return {
    ...meta,
    buffer: readFileSync(/* turbopackIgnore: true */ filePath),
  };
}

export function listLocalMediaIds() {
  const dir = mediaDir();
  if (!existsSync(/* turbopackIgnore: true */ dir)) return [];
  return readdirSync(/* turbopackIgnore: true */ dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""));
}

export { sanitizeAvatarUrl };
