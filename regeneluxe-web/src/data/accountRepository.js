import { emptyAccount, nowIso } from "./models.js";
import { migrateAccountRecord } from "./migrate.js";
import { readJson, writeJson, STORAGE_KEYS } from "./storage.js";
import { recordEvent } from "./events.js";

function persist(accounts) {
  return writeJson(STORAGE_KEYS.accounts, accounts);
}

function accountNeedsMigration(item) {
  return !item || typeof item !== "object" || typeof item.active !== "boolean" || !item.connectionState;
}

export function listAccounts() {
  const raw = readJson(STORAGE_KEYS.accounts, []);
  if (!Array.isArray(raw)) return [];
  const filtered = raw.filter((item) => item && typeof item === "object" && item.id);
  if (filtered.some(accountNeedsMigration)) {
    const migrated = filtered.map(migrateAccountRecord);
    persist(migrated);
    return migrated;
  }
  return filtered.map(migrateAccountRecord);
}

export function getAccount(id) {
  if (!id) return null;
  return listAccounts().find((account) => account.id === id) || null;
}

export function createAccount(partial = {}) {
  const account = emptyAccount(partial);
  const accounts = listAccounts();
  accounts.unshift(account);
  persist(accounts);
  return account;
}

export function updateAccount(id, patch) {
  const accounts = listAccounts();
  const index = accounts.findIndex((account) => account.id === id);
  if (index === -1) return null;

  const previous = accounts[index];
  const next = {
    ...previous,
    ...patch,
    id: previous.id,
    createdAt: previous.createdAt,
    connectionMethod: patch.connectionMethod || previous.connectionMethod || "MANUAL",
    updatedAt: nowIso(),
  };

  accounts[index] = next;
  persist(accounts);

  if (patch.connectionState && patch.connectionState !== previous.connectionState) {
    if (patch.connectionState === "CONNECTED") {
      recordEvent("ACCOUNT_CONNECTED", {
        accountId: next.id,
        message: `Connected ${next.handle || next.displayName || next.platform}`,
      });
    } else if (patch.connectionState === "AUTH_EXPIRED") {
      recordEvent("CONNECTION_EXPIRED", {
        accountId: next.id,
        message: `Connection expired for ${next.handle || next.displayName || next.platform}`,
      });
    } else if (["DISCONNECTED", "MANUAL_ONLY", "ERROR"].includes(patch.connectionState) && previous.connectionState === "CONNECTED") {
      recordEvent("ACCOUNT_DISCONNECTED", {
        accountId: next.id,
        message: `Disconnected ${next.handle || next.displayName || next.platform}`,
      });
    }
  }

  return next;
}

export function deleteAccount(id) {
  persist(listAccounts().filter((account) => account.id !== id));
  return true;
}

export function replaceAccounts(accounts) {
  return persist(Array.isArray(accounts) ? accounts : []);
}

export function resolveAccount(id, accounts = listAccounts()) {
  if (!id) return null;
  return accounts.find((account) => account.id === id) || null;
}
