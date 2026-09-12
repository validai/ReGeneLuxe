/**
 * Deterministic performance comparisons for AI + analytics UI.
 * Never invent baselines without enough history.
 */

export function averageMetrics(snapshots = []) {
  const totals = {};
  const counts = {};
  snapshots.forEach((snap) => {
    Object.entries(snap.metrics || {}).forEach(([key, value]) => {
      const number = Number(value);
      if (Number.isNaN(number)) return;
      totals[key] = (totals[key] || 0) + number;
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  const averages = {};
  Object.keys(totals).forEach((key) => {
    averages[key] = totals[key] / counts[key];
  });
  return { averages, sampleSize: snapshots.length, counts };
}

export function buildAccountBaseline(snapshots = [], { minSamples = 3 } = {}) {
  if (snapshots.length < minSamples) {
    return { available: false, reason: "INSUFFICIENT_DATA", sampleSize: snapshots.length };
  }
  const { averages, sampleSize, counts } = averageMetrics(snapshots);
  return {
    available: true,
    source: "CALCULATED",
    kind: "account_recent_average",
    sampleSize,
    averages,
    counts,
  };
}

export function compareAgainstBaseline(currentMetrics = {}, baseline) {
  if (!baseline?.available) {
    return { available: false, reason: baseline?.reason || "INSUFFICIENT_DATA", comparisons: [] };
  }
  const comparisons = Object.entries(currentMetrics).map(([key, value]) => {
    const number = Number(value);
    const base = baseline.averages[key];
    if (base == null || Number.isNaN(number)) {
      return { key, classification: "INSUFFICIENT_DATA" };
    }
    const delta = number - base;
    const relative = base === 0 ? (number === 0 ? 0 : 1) : delta / Math.abs(base);
    let classification = "NORMAL";
    if (Math.abs(relative) >= 0.2 && Math.abs(delta) >= 3) {
      classification = relative > 0 ? "MEANINGFUL_UP" : "MEANINGFUL_DOWN";
    }
    if (Math.abs(relative) >= 0.75 && Math.abs(delta) >= 5) {
      classification = "OUTLIER";
    }
    return {
      key,
      value: number,
      baseline: base,
      delta,
      relative,
      classification,
      source: "CALCULATED",
    };
  });
  return { available: true, comparisons };
}

export function platformTotals(snapshots = []) {
  const byPlatform = {};
  snapshots.forEach((snap) => {
    const platform = snap.platform || "Unknown";
    byPlatform[platform] = byPlatform[platform] || { count: 0, metrics: {} };
    byPlatform[platform].count += 1;
    Object.entries(snap.metrics || {}).forEach(([key, value]) => {
      const number = Number(value);
      if (Number.isNaN(number)) return;
      byPlatform[platform].metrics[key] = (byPlatform[platform].metrics[key] || 0) + number;
    });
  });
  return byPlatform;
}

export function formatFactLine(comparison) {
  if (!comparison || comparison.classification === "INSUFFICIENT_DATA") return null;
  const pct = Math.round((comparison.relative || 0) * 100);
  const direction = pct >= 0 ? `+${pct}%` : `${pct}%`;
  return `${comparison.key} ${direction} vs recent account average.`;
}
