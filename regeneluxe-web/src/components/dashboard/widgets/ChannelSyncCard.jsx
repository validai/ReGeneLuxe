// src/components/dashboard/widgets/ChannelSyncCard.jsx
const channels = [
  { name: "Meta Ads", status: "Synced" },
  { name: "TikTok Ads", status: "Synced" },
  { name: "YouTube", status: "Not linked" },
  { name: "Google Search", status: "Synced" },
  { name: "Email / CRM", status: "Synced" },
];

export default function ChannelSyncCard() {
  return (
    <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-6">
      <h3 className="text-sm font-semibold mb-3">Connected channels</h3>
      <ul className="space-y-2 text-xs">
        {channels.map((ch) => (
          <li
            key={ch.name}
            className="flex items-center justify-between bg-[var(--dash-bg)] rounded-lg px-3 py-2 border border-[var(--dash-border)]"
          >
            <span>{ch.name}</span>
            <span
              className={[
                "px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide",
                ch.status === "Synced"
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "bg-[var(--dash-border)] text-[var(--dash-muted)]",
              ].join(" ")}
            >
              {ch.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}


