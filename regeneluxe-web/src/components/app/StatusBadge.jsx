import { CONTENT_STATUS_LABELS, CONNECTION_LABELS } from "../../data/domain.js";

const LABELS = {
  ...CONTENT_STATUS_LABELS,
  ...CONNECTION_LABELS,
  Active: "Active",
  Inactive: "Inactive",
  queued: "Queued",
  awaiting_approval: "Needs approval",
  manual_required: "Manual publish",
  failed: "Failed",
  completed_manual: "Done",
  completed: "Done",
  ACTION: "Action",
  WARNING: "Warning",
  ERROR: "Error",
  INFO: "Info",
};

const TONES = {
  Active: "bg-rl_ok/15 text-rl_ok",
  Inactive: "bg-rl_surfaceSoft text-rl_muted",
  IDEA: "bg-rl_surfaceSoft text-rl_muted",
  PLANNED: "bg-rl_surfaceSoft text-rl_textSecondary",
  DRAFTING: "bg-rl_surfaceSoft text-rl_textSecondary",
  READY: "bg-rl_accent/15 text-rl_accent",
  SCHEDULED: "bg-rl_info/15 text-rl_info",
  PUBLISHED: "bg-rl_ok/15 text-rl_ok",
  FAILED: "bg-rl_danger/15 text-rl_danger",
  SKIPPED: "bg-rl_surfaceSoft text-rl_muted",
  CONNECTED: "bg-rl_ok/15 text-rl_ok",
  MANUAL_ONLY: "bg-rl_surfaceSoft text-rl_muted",
  UNCONNECTED: "bg-rl_warning/15 text-rl_warning",
  AUTH_EXPIRED: "bg-rl_danger/15 text-rl_danger",
  ERROR: "bg-rl_danger/15 text-rl_danger",
  queued: "bg-rl_info/15 text-rl_info",
  awaiting_approval: "bg-rl_accent/15 text-rl_accent",
  manual_required: "bg-rl_warning/15 text-rl_warning",
  failed: "bg-rl_danger/15 text-rl_danger",
  completed: "bg-rl_ok/15 text-rl_ok",
  completed_manual: "bg-rl_ok/15 text-rl_ok",
  ACTION: "bg-rl_accent/15 text-rl_accent",
  WARNING: "bg-rl_warning/15 text-rl_warning",
  INFO: "bg-rl_surfaceSoft text-rl_muted",
};

export default function StatusBadge({ value, label, tone }) {
  if (!value && !label) return null;
  const key = value || label;
  const text = label || LABELS[value] || String(value).replaceAll("_", " ");
  const className = tone || TONES[key] || TONES[label] || "bg-rl_surfaceSoft text-rl_muted";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${className}`}>
      {text}
    </span>
  );
}
