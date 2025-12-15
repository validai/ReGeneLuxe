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
    <aside className="w-60 border-r border-rl_border/30 bg-rl_surfaceSoft/80 backdrop-blur-sm flex flex-col justify-between">
      <div className="px-4 pt-5 pb-4">
        <div className="text-[10px] tracking-[0.28em] text-rl_muted uppercase">
          REGENELUXE
        </div>
        <div className="mt-1 text-xs font-medium tracking-[0.24em] text-rl_text uppercase">
          RGL Engine
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleViewChange(item.id)}
              className={[
                "w-full flex items-center gap-2 rounded-xl px-4 py-2 text-xs transition-colors",
                isActive
                  ? "border border-rl_border/50 bg-rl_surface text-rl_accent font-medium"
                  : "text-rl_muted hover:bg-rl_surfaceSoft hover:text-rl_text",
              ].join(" ")}
            >
              <Icon className="text-lg" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="pb-4" />
    </aside>
  );
}


