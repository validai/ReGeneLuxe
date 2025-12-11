// src/components/dashboard/MissionLayout/SidebarNav.jsx
import { FiGrid, FiBarChart2, FiUsers, FiSettings } from "react-icons/fi";
import { Analytics } from "../../../utils/analytics";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: FiGrid },
  { id: "analytics", label: "Analytics", icon: FiBarChart2 },
  { id: "audience", label: "Audience", icon: FiUsers },
  { id: "settings", label: "Settings", icon: FiSettings },
];

export default function SidebarNav({ activeView, setActiveView }) {
  const handleViewChange = (viewId) => {
    setActiveView(viewId);
    Analytics.track("mission_view_change", {
      view: viewId,
    });
  };

  return (
    <aside className="w-60 bg-[var(--dash-surface)] border-r border-[var(--dash-border)] flex flex-col py-6">
      <div className="px-6 pb-6">
        <p className="text-xs tracking-[0.3em] text-[var(--dash-muted)] uppercase">
          Regeneluxe
        </p>
        {/* Intentionally no secondary label here – dashboard should feel calmer */}
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleViewChange(item.id)}
              className={[
                "w-full flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition",
                isActive
                  ? "bg-[var(--dash-bg)] text-[var(--accent)] border border-[var(--dash-border)]"
                  : "text-[var(--dash-muted)] hover:bg-[var(--dash-border)]",
              ].join(" ")}
            >
              <Icon className="text-lg" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-6 pt-4 text-[10px] text-[var(--dash-muted)] uppercase tracking-[0.16em]">
        Campaign cockpit
      </div>
    </aside>
  );
}


