import { readString, writeString, STORAGE_KEYS } from "../data/storage.js";

export function getWorkingAccountId() {
  return readString(STORAGE_KEYS.workingAccountId) || "";
}

export function setWorkingAccountId(id) {
  return writeString(STORAGE_KEYS.workingAccountId, id || null);
}

export function filterByWorkingAccount(items, accounts, workingAccountId, getAccountIds = (item) => item.accountIds || []) {
  if (!workingAccountId) return items;
  return items.filter((item) => {
    const ids = getAccountIds(item);
    if (Array.isArray(ids) && ids.includes(workingAccountId)) return true;
    if (item.accountId === workingAccountId) return true;
    const platforms = (item.variants || []).map((variant) => variant.accountId);
    return platforms.includes(workingAccountId);
  });
}

export function accountOptionLabel(account) {
  if (!account) return "All accounts";
  return `${account.platform} — ${account.handle || account.displayName || "Untitled"}`;
}
