import { createHash } from "node:crypto";

export function dryRunDuplicateKey(draft = {}) {
  const payload = [
    draft.id || "",
    draft.destinationAccountId || "",
    draft.platform || "",
    draft.scheduledFor || "",
    draft.caption || "",
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}
