// src/components/dashboard/MissionLayout/RightAICommander.jsx
import { useState } from "react";
import { FiChevronLeft, FiSend } from "react-icons/fi";

export default function RightAICommander() {
  const [open, setOpen] = useState(true);

  return (
    <aside
      className={`${
        open ? "w-96" : "w-11"
      } bg-[var(--dash-surface)] border-l border-[var(--dash-border)] transition-all duration-300 flex flex-col`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 hover:bg-[var(--dash-border)] transition flex items-center justify-center"
      >
        <FiChevronLeft
          className={`text-lg text-[var(--dash-muted)] transition-transform ${
            open ? "" : "rotate-180"
          }`}
        />
      </button>

      {open && (
        <div className="flex flex-col flex-1 p-4 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--dash-muted)]">
              AI Commander
            </p>
            <h3 className="text-sm font-semibold mt-1">
              Campaign tuning assistant
            </h3>
            <p className="text-xs text-[var(--dash-muted)] mt-1">
              Ask ReGeneLuxe to diagnose drops, suggest angles, or design new
              tests. This is where you co-pilot the campaign.
            </p>
          </div>

          <div className="flex-1 bg-[var(--dash-bg)] rounded-lg border border-[var(--dash-border)] p-3 overflow-y-auto text-xs space-y-2">
            <div className="text-[var(--dash-muted)] italic">
              AI conversation feed will appear here. For now this is a visual
              placeholder.
            </div>

            <div className="space-y-2 pt-2 border-t border-dashed border-[var(--dash-border)]">
              <QuickChip text="Why did CTR drop this week?" />
              <QuickChip text="Suggest 3 new hooks for TikTok" />
              <QuickChip text="Find fatigue in my audiences" />
            </div>
          </div>

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              className="flex-1 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="Ask ReGeneLuxe AI anything about this campaign…"
            />
            <button
              type="submit"
              className="p-2 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--dash-bg)] transition"
            >
              <FiSend />
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}

function QuickChip({ text }) {
  return (
    <button className="px-3 py-1.5 rounded-full bg-[var(--dash-surface-alt)] border border-[var(--dash-border)] text-[10px] text-[var(--dash-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition">
      {text}
    </button>
  );
}


