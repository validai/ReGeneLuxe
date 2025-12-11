// src/components/dashboard/widgets/QuickActionsPanel.jsx
import { FiPauseCircle, FiPlayCircle, FiCopy, FiRefreshCcw } from "react-icons/fi";

export default function QuickActionsPanel() {
  return (
    <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-6">
      <h3 className="text-sm font-semibold mb-3">Quick actions</h3>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <ActionButton icon={FiPauseCircle} label="Pause campaign" />
        <ActionButton icon={FiPlayCircle} label="Resume campaign" />
        <ActionButton icon={FiCopy} label="Duplicate as new test" />
        <ActionButton icon={FiRefreshCcw} label="Regenerate angles" />
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label }) {
  return (
    <button className="flex items-center gap-2 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-border)] px-3 py-2 hover:border-[var(--accent)] hover:text-[var(--accent)] transition">
      <Icon className="text-base" />
      <span>{label}</span>
    </button>
  );
}


