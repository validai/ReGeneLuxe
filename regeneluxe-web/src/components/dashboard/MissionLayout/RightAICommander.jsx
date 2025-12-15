// src/components/dashboard/MissionLayout/RightAICommander.jsx
import { useState } from "react";
import { FiChevronLeft, FiSend } from "react-icons/fi";

export default function RightAICommander() {
  const [open, setOpen] = useState(true);

  return (
    <aside
      className={`${
        open ? "w-96" : "w-11"
      } bg-rl_surface border-l border-rl_border/30 transition-all duration-300 flex flex-col`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 hover:bg-rl_surfaceSoft transition flex items-center justify-center"
      >
        <FiChevronLeft
          className={`text-lg text-rl_muted transition-transform ${
            open ? "" : "rotate-180"
          }`}
        />
      </button>

      {open && (
        <div className="flex flex-col flex-1 p-4 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-rl_muted">
              AI Commander
            </p>
            <h3 className="text-sm font-semibold mt-1 text-rl_text">
              Campaign tuning assistant
            </h3>
            <p className="text-xs text-rl_muted mt-1">
              Ask ReGeneLuxe to diagnose drops, suggest angles, or design new
              tests. This is where you co-pilot the campaign.
            </p>
          </div>

          <div className="flex-1 bg-rl_bg rounded-lg border border-rl_border/30 p-3 overflow-y-auto text-xs space-y-2">
            <div className="text-rl_muted italic">
              AI conversation feed will appear here. For now this is a visual
              placeholder.
            </div>

            <div className="space-y-2 pt-2 border-t border-dashed border-rl_border/30">
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
              className="flex-1 bg-rl_bg border border-rl_border rounded-lg px-3 py-2 text-xs text-rl_text focus:outline-none focus:ring-1 focus:ring-rl_accent/70 focus:border-rl_accent"
              placeholder="Ask ReGeneLuxe AI anything about this campaign…"
            />
            <button
              type="submit"
              className="p-2 rounded-lg bg-[var(--accent-soft)] text-rl_accent hover:bg-rl_accent hover:text-rl_bg transition"
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
    <button className="px-3 py-1.5 rounded-full bg-rl_surfaceSoft border border-rl_border/30 text-[10px] text-rl_muted hover:border-rl_accent hover:text-rl_accent transition">
      {text}
    </button>
  );
}


