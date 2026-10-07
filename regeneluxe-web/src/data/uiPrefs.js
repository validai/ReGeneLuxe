import { readString, writeString } from "./storage.js";

/** UI preference only. Not operational SQLite state. */
const SIDEBAR_KEY = "regeneluxe.sidebarCollapsed";
const LEGACY_SIDEBAR_KEY = "rl_sidebar_collapsed";
const CONTENT_VIEW_KEY = "rl_content_view";
const CALENDAR_VIEW_KEY = "rl_calendar_view";

export function getSidebarCollapsed() {
  const current = readString(SIDEBAR_KEY);
  if (current === "1" || current === "true") return true;
  if (current === "0" || current === "false") return false;
  return readString(LEGACY_SIDEBAR_KEY) === "1";
}

export function setSidebarCollapsed(collapsed) {
  writeString(SIDEBAR_KEY, collapsed ? "1" : "0");
}

export function getContentViewMode() {
  return readString(CONTENT_VIEW_KEY) === "grid" ? "grid" : "list";
}

export function setContentViewMode(mode) {
  writeString(CONTENT_VIEW_KEY, mode === "grid" ? "grid" : "list");
}

export function getCalendarViewMode() {
  const value = readString(CALENDAR_VIEW_KEY);
  return ["month", "week", "list"].includes(value) ? value : "month";
}

export function setCalendarViewMode(mode) {
  writeString(CALENDAR_VIEW_KEY, ["month", "week", "list"].includes(mode) ? mode : "month");
}
