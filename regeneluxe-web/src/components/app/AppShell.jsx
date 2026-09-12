import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import BrandTitle from "../BrandTitle.jsx";
import { useAppData } from "../../hooks/useAppData.js";
import { setWorkingAccountId, accountOptionLabel } from "../../data/workingContext.js";
import { getSidebarCollapsed, setSidebarCollapsed } from "../../data/uiPrefs.js";
import { getRuntimeStatus } from "../../data/runtimeClient.js";

function NavGlyph({ name }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    className: "shrink-0 opacity-80",
  };

  switch (name) {
    case "dash":
      return (
        <svg {...common}>
          <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="0.75" />
          <rect x="9" y="2.5" width="4.5" height="4.5" rx="0.75" />
          <rect x="2.5" y="9" width="4.5" height="4.5" rx="0.75" />
          <rect x="9" y="9" width="4.5" height="4.5" rx="0.75" />
        </svg>
      );
    case "cal":
      return (
        <svg {...common}>
          <rect x="2.5" y="3.5" width="11" height="10" rx="1" />
          <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" />
        </svg>
      );
    case "content":
      return (
        <svg {...common}>
          <path d="M3.5 3.5h9v9h-9z" />
          <path d="M5.5 6.5h5M5.5 9h3.5" />
        </svg>
      );
    case "camp":
      return (
        <svg {...common}>
          <path d="M3 12.5 8 3.5l5 9H3z" />
        </svg>
      );
    case "inbox":
      return (
        <svg {...common}>
          <path d="M2.5 4.5h11v7h-11z" />
          <path d="M2.5 9.5h3l1.25 1.5h2.5L10.5 9.5h3" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...common}>
          <path d="M3 12.5V8.5M6.5 12.5V5.5M10 12.5V7.5M13.5 12.5V3.5" />
        </svg>
      );
    case "accounts":
      return (
        <svg {...common}>
          <circle cx="8" cy="5.5" r="2.25" />
          <path d="M3.5 13c.75-2.5 2.5-3.75 4.5-3.75S11.75 10.5 12.5 13" />
        </svg>
      );
    case "queue":
      return (
        <svg {...common}>
          <path d="M3.5 4.5h9M3.5 8h9M3.5 11.5h6" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="3.25" />
          <path d="M9.5 9.5 13 13" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="2.25" />
          <path d="M8 2.5v1.5M8 12v1.5M2.5 8H4M12 8h1.5M4.2 4.2l1.1 1.1M10.7 10.7l1.1 1.1M11.8 4.2l-1.1 1.1M5.3 10.7l-1.1 1.1" />
        </svg>
      );
    case "expand":
      return (
        <svg {...common}>
          <path d="M6 3.5 10.5 8 6 12.5" />
        </svg>
      );
    case "collapse":
      return (
        <svg {...common}>
          <path d="M10 3.5 5.5 8 10 12.5" />
        </svg>
      );
    default:
      return <span className="w-4 text-center text-[10px] uppercase tracking-wide opacity-80" aria-hidden>{name.slice(0, 2)}</span>;
  }
}

const LINKS = [
  { to: "/", label: "Dashboard", end: true, icon: "dash" },
  { to: "/calendar", label: "Calendar", icon: "cal" },
  { to: "/content", label: "Content", icon: "content" },
  { to: "/campaigns", label: "Campaigns", icon: "camp" },
  { to: "/inbox", label: "Inbox", icon: "inbox" },
  { to: "/analytics", label: "Analytics", icon: "analytics" },
  { to: "/accounts", label: "Accounts", icon: "accounts" },
];

export default function AppShell({ children, onOpenCommand }) {
  const navigate = useNavigate();
  const { accounts, workingAccountId } = useAppData();
  const [collapsed, setCollapsed] = useState(() => getSidebarCollapsed());
  const [runtime, setRuntime] = useState({ running: false, aiConfigured: false });

  useEffect(() => {
    getRuntimeStatus().then(setRuntime).catch(() => {});
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    setSidebarCollapsed(next);
  };

  const runtimeLabel = useMemo(() => {
    if (!runtime.running) return "Offline";
    if (!runtime.aiConfigured) return "Local";
    return "Ready";
  }, [runtime]);

  return (
    <div className="min-h-screen bg-rl_bg text-rl_text lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-rl_accent focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-rl_bg"
      >
        Skip to main content
      </a>

      <aside
        className={`sticky top-0 z-40 flex h-screen flex-col border-r border-rl_border bg-rl_surface transition-[width] duration-rl ${
          collapsed ? "w-sidebar-collapsed" : "w-sidebar"
        } hidden lg:flex`}
      >
        <div className={`flex items-center gap-2 border-b border-rl_border px-3 py-4 ${collapsed ? "justify-center" : ""}`}>
          <NavLink to="/" className="min-w-0 truncate" title="ReGeneLuxe">
            {collapsed ? (
              <span className="font-display text-lg text-rl_accent">R</span>
            ) : (
              <BrandTitle variant="header" />
            )}
          </NavLink>
        </div>

        <div className="px-2 py-3">
          <button
            type="button"
            className={`rl-btn w-full ${collapsed ? "px-0" : ""}`}
            onClick={() => navigate("/content/new")}
            title="Create"
          >
            {collapsed ? "+" : "+ Create"}
          </button>
        </div>

        {accounts.length > 0 && (
          <div className={`pb-3 ${collapsed ? "px-1.5" : "px-3"}`}>
            <label className="block">
              <span className="sr-only">Account</span>
              <select
                className="rl-input py-1.5 text-xs"
                value={workingAccountId}
                onChange={(event) => setWorkingAccountId(event.target.value)}
                title={workingAccountId
                  ? accountOptionLabel(accounts.find((a) => a.id === workingAccountId) || {})
                  : "All accounts"}
              >
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {collapsed ? (account.platform?.[0] || "?") : accountOptionLabel(account)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3" aria-label="Main">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              title={link.label}
              aria-label={link.label}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-rl",
                  collapsed ? "justify-center" : "",
                  isActive
                    ? "bg-rl_surfaceActive text-rl_text"
                    : "text-rl_muted hover:bg-rl_surfaceHover hover:text-rl_text",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <NavGlyph name={link.icon} />
                  {!collapsed && <span className="font-medium tracking-tight">{link.label}</span>}
                  {!collapsed && isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-rl_accent" aria-hidden />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-1 border-t border-rl_border px-2 py-3">
          <NavLink
            to="/queue"
            title="Queue"
            aria-label="Queue"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${collapsed ? "justify-center" : ""} ${
                isActive ? "bg-rl_surfaceActive text-rl_text" : "text-rl_muted hover:bg-rl_surfaceHover hover:text-rl_text"
              }`
            }
          >
            <NavGlyph name="queue" />
            {!collapsed && <span>Queue</span>}
          </NavLink>
          <button
            type="button"
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-rl_muted hover:bg-rl_surfaceHover hover:text-rl_text ${collapsed ? "justify-center" : ""}`}
            onClick={onOpenCommand}
            title="Search (⌘K)"
            aria-label="Search"
          >
            <NavGlyph name="search" />
            {!collapsed && <span>Search</span>}
          </button>
          <NavLink
            to="/settings"
            title="Settings"
            aria-label="Settings"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${collapsed ? "justify-center" : ""} ${
                isActive ? "bg-rl_surfaceActive text-rl_text" : "text-rl_muted hover:bg-rl_surfaceHover hover:text-rl_text"
              }`
            }
          >
            <NavGlyph name="settings" />
            {!collapsed && <span>Settings</span>}
          </NavLink>
          <button
            type="button"
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-rl_muted hover:text-rl_text ${collapsed ? "justify-center" : ""}`}
            onClick={toggleCollapsed}
            aria-pressed={collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <NavGlyph name={collapsed ? "expand" : "collapse"} />
            {!collapsed && (
              <span className="flex w-full items-center justify-between">
                <span>Collapse</span>
                <span className="text-[10px] uppercase tracking-[0.14em]">{runtimeLabel}</span>
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 border-b border-rl_border bg-rl_surface/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <NavLink to="/"><BrandTitle variant="header" /></NavLink>
          <div className="flex items-center gap-2">
            <button type="button" className="rl-btn-ghost px-3 py-1.5" onClick={onOpenCommand} aria-label="Search">Search</button>
            <button type="button" className="rl-btn px-3 py-1.5" onClick={() => navigate("/content/new")}>+ Create</button>
          </div>
        </div>
        {accounts.length > 0 && (
          <div className="px-3 pb-2">
            <label className="block">
              <span className="sr-only">Account</span>
              <select
                className="rl-input py-1.5 text-xs"
                value={workingAccountId}
                onChange={(event) => setWorkingAccountId(event.target.value)}
              >
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {accountOptionLabel(account)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="Main mobile">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] ${
                  isActive ? "bg-rl_accent text-rl_bg" : "text-rl_muted"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <NavLink to="/queue" className="whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-rl_muted">
            Queue
          </NavLink>
          <NavLink to="/settings" className="whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-rl_muted">
            Settings
          </NavLink>
        </nav>
      </div>

      <div className="min-w-0 flex-1">
        <main id="main-content">{children}</main>
      </div>
    </div>
  );
}
