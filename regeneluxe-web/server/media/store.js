import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, realpathSync } from "node:fs";
import { join, resolve, sep } from "node:path";
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

export function detectImageMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
    && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) {
    return "image/png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  const riff = buffer.toString("ascii", 0, 4);
  const webp = buffer.toString("ascii", 8, 12);
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return null;
}

function confinedFilePath(dir, name) {
  const safeName = String(name || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeName || safeName.includes("..") || safeName.startsWith(".")) return null;
  let root;
  try {
    root = existsSync(/* turbopackIgnore: true */ dir) ? realpathSync(/* turbopackIgnore: true */ dir) : resolve(dir);
  } catch {
    root = resolve(dir);
  }
  const candidate = resolve(root, safeName);
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (candidate !== root && !candidate.startsWith(prefix)) return null;
  return candidate;
}

function isInsideMediaDir(dir, filePath) {
  try {
    const root = realpathSync(/* turbopackIgnore: true */ dir);
    const resolved = realpathSync(/* turbopackIgnore: true */ filePath);
    const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
    return resolved === root || resolved.startsWith(prefix);
  } catch {
    return false;
  }
}

export async function saveProfileImageBuffer({ buffer, mimeType, originalName = "", managedProfileId = "" }) {
  const fakeFile = { size: buffer.length, type: mimeType, name: originalName };
  const check = validateProfileImageFile(fakeFile);
  if (!check.ok) {
    const error = new Error(check.error);
    error.code = check.code;
    throw error;
  }
  const detected = detectImageMime(buffer);
  if (!detected || detected !== check.mime) {
    const error = new Error("PNG, JPG, or WebP images are supported.");
    error.code = "mime";
    throw error;
  }
  const dir = ensureMediaDir();
  const id = `med_${createId("med")}`;
  const ext = PROFILE_IMAGE_MIME[check.mime];
  const storedName = `${id}.${ext}`;
  const filePath = confinedFilePath(dir, storedName);
  const metaPath = confinedFilePath(dir, `${id}.json`);
  if (!filePath || !metaPath) {
    const error = new Error("Could not store this image.");
    error.code = "path";
    throw error;
  }
  writeFileSync(/* turbopackIgnore: true */ filePath, buffer);
  const meta = {
    id,
    storedName,
    mimeType: check.mime,
    bytes: buffer.length,
    originalName: String(originalName || storedName).replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 120),
    createdAt: new Date().toISOString(),
    managedProfileId: managedProfileId || "",
  };
  writeFileSync(/* turbopackIgnore: true */ metaPath, JSON.stringify(meta, null, 2));
  return {
    ...meta,
    url: `/api/media/${id}`,
  };
}

export function readLocalMedia(id, { workspaceId = null } = {}) {
  const safeId = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) return null;
  const dir = mediaDir();
  const metaPath = confinedFilePath(dir, `${safeId}.json`);
  if (!metaPath || !existsSync(/* turbopackIgnore: true */ metaPath)) return null;
  let meta;
  try {
    meta = JSON.parse(readFileSync(/* turbopackIgnore: true */ metaPath, "utf8"));
  } catch {
    return null;
  }
  if (workspaceId && meta.managedProfileId && meta.managedProfileId !== workspaceId) {
    return null;
  }
  const allowedName = `${safeId}.${PROFILE_IMAGE_MIME[meta.mimeType] || "bin"}`;
  const storedName = String(meta.storedName || allowedName);
  if (storedName !== allowedName) return null;
  const filePath = confinedFilePath(dir, storedName);
  if (!filePath || !existsSync(/* turbopackIgnore: true */ filePath)) return null;
  if (!isInsideMediaDir(dir, filePath)) return null;
  if (!PROFILE_IMAGE_MIME[meta.mimeType]) return null;
  return {
    ...meta,
    mimeType: meta.mimeType,
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
