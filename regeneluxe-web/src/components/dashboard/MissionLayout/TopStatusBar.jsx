// src/components/dashboard/MissionLayout/TopStatusBar.jsx
import { FiClock, FiActivity } from "react-icons/fi";

export default function TopStatusBar() {
  // Later wire this to real campaign data
  const status = "Live";
  const countdown = "12d 04h 33m";
  const spendToday = "$1,420";

  return (
    <header className="h-16 bg-[var(--dash-surface)] border-b border-[var(--dash-border)] flex items-center justify-between px-8">
      <div className="flex items-center gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--dash-muted)]">
            Active campaign
          </p>
          <h2 className="text-sm font-semibold tracking-wide">
            Q1 Launch – Signature Blueprint
          </h2>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--success)]" />
          </span>
          <span className="uppercase tracking-[0.18em] text-[var(--dash-muted)] flex items-center gap-1">
            <FiActivity className="text-[var(--success)]" />
            {status}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <FiClock />
          <span>
            Ends in <span className="font-semibold">{countdown}</span>
          </span>
        </div>
        <div className="h-8 w-px bg-[var(--dash-border)]" />
        <div className="text-xs">
          <p className="text-[var(--dash-muted)]">Today&apos;s spend</p>
          <p className="font-semibold">{spendToday}</p>
        </div>
      </div>
    </header>
  );
}


