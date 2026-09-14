import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** regeneluxe-web package root (parent of server/). */
export function projectRoot() {
  return join(__dirname, "..", "..");
}

export function regeneluxeDir() {
  return join(projectRoot(), ".regeneluxe");
}

export function dbPath() {
  return join(regeneluxeDir(), "local.db");
}

export function backupsDir() {
  return join(regeneluxeDir(), "backups");
}

export function quarantineDir() {
  return join(regeneluxeDir(), "quarantine");
}

/** Ensure .regeneluxe, backups, and quarantine directories exist. */
export function ensureDirs() {
  for (const dir of [regeneluxeDir(), backupsDir(), quarantineDir()]) {
    if (!existsSync(/*turbopackIgnore: true*/ dir)) {
      mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
    }
  }
  return {
    root: projectRoot(),
    regeneluxe: regeneluxeDir(),
    db: dbPath(),
    backups: backupsDir(),
    quarantine: quarantineDir(),
  };
}
