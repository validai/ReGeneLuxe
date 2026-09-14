/**
 * Canonical time helpers for ReGeneLuxe.
 * STORE operational timestamps as UTC ISO-8601 strings.
 * DISPLAY using IANA time zones (e.g. America/New_York), never fixed offsets alone.
 */

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function assertIanaTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== "string") {
    throw new Error("IANA time zone required");
  }
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    throw new Error(`Invalid IANA time zone: ${timeZone}`);
  }
  return timeZone;
}

/** Always persist UTC. */
export function toUtcIso(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date.toISOString();
}

export function isUtcIso(value) {
  return typeof value === "string" && ISO_RE.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * Interpret a local civil datetime in a zone as UTC ISO.
 * localParts: { year, month (1-12), day, hour=0, minute=0, second=0 }
 */
export function zonedLocalToUtcIso(localParts, timeZone) {
  assertIanaTimeZone(timeZone);
  const {
    year,
    month,
    day,
    hour = 0,
    minute = 0,
    second = 0,
  } = localParts;

  // Iterate to resolve offset at that civil time (handles DST gaps/folds).
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i += 1) {
    const parts = getZonedParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const desired = Date.UTC(year, month - 1, day, hour, minute, second);
    const diff = desired - asUtc;
    guess += diff;
    if (diff === 0) break;
  }
  return new Date(guess).toISOString();
}

export function getZonedParts(date, timeZone) {
  assertIanaTimeZone(timeZone);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const bag = Object.fromEntries(fmt.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

export function formatInTimeZone(isoOrDate, timeZone, options = {}) {
  assertIanaTimeZone(timeZone);
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  return new Intl.DateTimeFormat(options.locale || "en-US", {
    timeZone,
    ...options,
  }).format(date);
}

export function startOfZonedDay(isoOrDate, timeZone) {
  const parts = getZonedParts(new Date(isoOrDate), timeZone);
  return zonedLocalToUtcIso({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 0,
    minute: 0,
    second: 0,
  }, timeZone);
}

export function endOfZonedDay(isoOrDate, timeZone) {
  const parts = getZonedParts(new Date(isoOrDate), timeZone);
  return zonedLocalToUtcIso({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 23,
    minute: 59,
    second: 59,
  }, timeZone);
}

/** Calendar day key YYYY-MM-DD in the given zone (for calendar placement). */
export function zonedDayKey(isoOrDate, timeZone) {
  const p = getZonedParts(new Date(isoOrDate), timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function addDaysUtc(iso, days) {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Alias used by scheduling UI / tests. */
export function fromZonedLocalInput(localParts, timeZone) {
  return zonedLocalToUtcIso(localParts, timeZone);
}
