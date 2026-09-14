import { describe, expect, it } from "vitest";
import {
  toUtcIso,
  fromZonedLocalInput,
  formatInTimeZone,
  startOfZonedDay,
  endOfZonedDay,
  zonedDayKey,
  getZonedParts,
} from "../../src/data/time.js";

const TZ = "America/New_York";

describe("src/data/time", () => {
  it("toUtcIso stores UTC", () => {
    const iso = toUtcIso(new Date("2026-06-15T18:30:00.000Z"));
    expect(iso).toBe("2026-06-15T18:30:00.000Z");
    expect(iso.endsWith("Z")).toBe(true);
  });

  it("DST spring forward 2026-03-08 America/New_York", () => {
    // 2:30 AM does not exist; resolver should land on a valid UTC instant.
    const gap = fromZonedLocalInput(
      { year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0 },
      TZ,
    );
    expect(gap).toMatch(/Z$/);
    const parts = getZonedParts(new Date(gap), TZ);
    // After spring forward, clocks are on EDT (UTC-4).
    expect(parts.month).toBe(3);
    expect(parts.day).toBe(8);
    expect(parts.hour === 1 || parts.hour === 2 || parts.hour === 3).toBe(true);

    const before = fromZonedLocalInput(
      { year: 2026, month: 3, day: 8, hour: 1, minute: 30, second: 0 },
      TZ,
    );
    const after = fromZonedLocalInput(
      { year: 2026, month: 3, day: 8, hour: 3, minute: 30, second: 0 },
      TZ,
    );
    expect(new Date(after) - new Date(before)).toBe(60 * 60 * 1000);
  });

  it("DST fall back 2026-11-01 America/New_York", () => {
    const first = fromZonedLocalInput(
      { year: 2026, month: 11, day: 1, hour: 1, minute: 30, second: 0 },
      TZ,
    );
    expect(first).toMatch(/Z$/);
    const parts = getZonedParts(new Date(first), TZ);
    expect(parts.hour).toBe(1);
    expect(parts.minute).toBe(30);

    const afternoon = fromZonedLocalInput(
      { year: 2026, month: 11, day: 1, hour: 15, minute: 0, second: 0 },
      TZ,
    );
    expect(formatInTimeZone(afternoon, TZ, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })).toMatch(/15:00/);
  });

  it("midnight crossing and day bounds", () => {
    const late = fromZonedLocalInput(
      { year: 2026, month: 6, day: 10, hour: 23, minute: 30, second: 0 },
      TZ,
    );
    const start = startOfZonedDay(late, TZ);
    const end = endOfZonedDay(late, TZ);
    expect(zonedDayKey(start, TZ)).toBe("2026-06-10");
    expect(zonedDayKey(end, TZ)).toBe("2026-06-10");
    expect(zonedDayKey(late, TZ)).toBe("2026-06-10");

    const nextMorning = fromZonedLocalInput(
      { year: 2026, month: 6, day: 11, hour: 0, minute: 15, second: 0 },
      TZ,
    );
    expect(zonedDayKey(nextMorning, TZ)).toBe("2026-06-11");
    expect(new Date(nextMorning) > new Date(end)).toBe(true);
  });

  it("month and year boundaries", () => {
    const nye = fromZonedLocalInput(
      { year: 2026, month: 12, day: 31, hour: 23, minute: 45, second: 0 },
      TZ,
    );
    expect(zonedDayKey(nye, TZ)).toBe("2026-12-31");
    const startJan = startOfZonedDay(
      fromZonedLocalInput({ year: 2027, month: 1, day: 1, hour: 12 }, TZ),
      TZ,
    );
    expect(zonedDayKey(startJan, TZ)).toBe("2027-01-01");
    expect(new Date(startJan) > new Date(nye)).toBe(true);

    const endFeb = endOfZonedDay(
      fromZonedLocalInput({ year: 2026, month: 2, day: 28, hour: 8 }, TZ),
      TZ,
    );
    expect(zonedDayKey(endFeb, TZ)).toBe("2026-02-28");
  });

  it("UTC storage round-trip display", () => {
    const utc = "2026-07-04T16:00:00.000Z";
    const shown = formatInTimeZone(utc, TZ, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    expect(shown).toMatch(/07/);
    expect(toUtcIso(utc)).toBe(utc);
  });
});
