"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import BrandTitle from "../BrandTitle.jsx";
import { NavIcon } from "./Icon.jsx";
import { useAppData } from "../../hooks/useAppData.js";
import { setWorkingAccountId, accountOptionLabel } from "../../data/workingContext.js";
import { getSidebarCollapsed, setSidebarCollapsed } from "../../data/uiPrefs.js";
import { getRuntimeStatus } from "../../data/runtimeClient.js";
import ProfileSwitcher from "./ProfileSwitcher.jsx";
import OperatorMenu from "./OperatorMenu.jsx";

/**
 * Native App Router shell — structure preserved; visual language refreshed.
 */

const LINKS = [
  { to: "/", label: "Dashboard", end: true, icon: "dash" },
  { to: "/calendar", label: "Calendar", icon: "cal" },
  { to: "/content", label: "Content", icon: "content" },
  { to: "/campaigns", label: "Campaigns", icon: "camp" },
  { to: "/inbox", label: "Inbox", icon: "inbox" },
  { to: "/analytics", label: "Analytics", icon: "analytics" },
  { to: "/accounts", label: "Accounts", icon: "accounts" },
];

function linkActive(pathname, to, end) {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function navClass(isActive, collapsed, extra = "") {
  return [
    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium tracking-tight transition-colors duration-rl",
    collapsed ? "justify-center" : "",
    isActive
      ? "bg-rl_surfaceActive text-rl_text shadow-[inset_3px_0_0_0_rgb(var(--rl-accent))]"
      : "text-rl_muted hover:bg-rl_surfaceHover hover:text-rl_text",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export default function AppShellNext({ children, onOpenCommand }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
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
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-rl_accent focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <aside
        className={`sticky top-0 z-40 flex h-screen flex-col border-r border-rl_border bg-rl_surface transition-[width] duration-rl ${
          collapsed ? "w-sidebar-collapsed" : "w-sidebar"
        } hidden lg:flex`}
      >
        <div className={`flex items-center gap-2 border-b border-rl_border px-3 py-4 ${collapsed ? "justify-center" : ""}`}>
          <Link href="/" className="min-w-0 truncate" title="ReGeneLuxe">
            {collapsed ? (
              <span className="font-display text-xl font-bold tracking-tight text-rl_text" aria-label="ReGeneLuxe">R</span>
            ) : (
              <BrandTitle variant="header" />
            )}
          </Link>
        </div>

        <div className="px-2 py-3">
          <button
            type="button"
            className={`rl-btn w-full ${collapsed ? "px-0" : ""}`}
            onClick={() => router.push("/content/new")}
            title="Create"
            aria-label="Create"
          >
            {collapsed ? <NavIcon name="create" size={20} /> : (
              <>
                <NavIcon name="create" size={18} />
                Create
              </>
            )}
          </button>
        </div>

        <ProfileSwitcher collapsed={collapsed} />

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
          {LINKS.map((link) => {
            const isActive = linkActive(pathname, link.to, link.end);
            return (
              <Link
                key={link.to}
                href={link.to}
                title={link.label}
                aria-label={link.label}
                aria-current={isActive ? "page" : undefined}
                className={navClass(isActive, collapsed)}
              >
                <NavIcon name={link.icon} size={20} className={isActive ? "text-rl_text" : "text-current"} />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1 border-t border-rl_border px-2 py-3">
          <OperatorMenu collapsed={collapsed} />
          <Link
            href="/queue"
            title="Queue"
            aria-label="Queue"
            aria-current={linkActive(pathname, "/queue") ? "page" : undefined}
            className={navClass(linkActive(pathname, "/queue"), collapsed, "py-2")}
          >
            <NavIcon name="queue" size={20} />
            {!collapsed && <span>Queue</span>}
          </Link>
          <button
            type="button"
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-rl_muted transition-colors duration-rl hover:bg-rl_surfaceHover hover:text-rl_text ${collapsed ? "justify-center" : ""}`}
            onClick={onOpenCommand}
            title="Search (⌘K)"
            aria-label="Search"
          >
            <NavIcon name="search" size={20} />
            {!collapsed && <span>Search</span>}
          </button>
          <Link
            href="/settings"
            title="Settings"
            aria-label="Settings"
            aria-current={linkActive(pathname, "/settings") ? "page" : undefined}
            className={navClass(linkActive(pathname, "/settings"), collapsed, "py-2")}
          >
            <NavIcon name="settings" size={20} />
            {!collapsed && <span>Settings</span>}
          </Link>
          <button
            type="button"
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-rl_muted transition-colors duration-rl hover:bg-rl_surfaceHover hover:text-rl_text ${collapsed ? "justify-center" : ""}`}
            onClick={toggleCollapsed}
            aria-pressed={collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <NavIcon name={collapsed ? "expand" : "collapse"} size={20} />
            {!collapsed && (
              <span className="flex w-full items-center justify-between">
                <span>Collapse</span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-rl_muted">{runtimeLabel}</span>
              </span>
            )}
          </button>
        </div>
      </aside>

      <div className="sticky top-0 z-40 border-b border-rl_border bg-rl_surface/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <Link href="/"><BrandTitle variant="header" /></Link>
          <div className="flex items-center gap-2">
            <button type="button" className="rl-btn-icon" onClick={onOpenCommand} aria-label="Search">
              <NavIcon name="search" size={18} />
            </button>
            <button type="button" className="rl-btn px-3 py-2" onClick={() => router.push("/content/new")} aria-label="Create">
              <NavIcon name="create" size={16} />
              Create
            </button>
          </div>
        </div>
        <div className="px-3 pb-2 lg:hidden">
          <ProfileSwitcher />
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
          {LINKS.map((link) => {
            const isActive = linkActive(pathname, link.to, link.end);
            return (
              <Link
                key={link.to}
                href={link.to}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors duration-rl ${
                  isActive ? "bg-rl_accent text-white" : "text-rl_muted hover:text-rl_text"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link href="/queue" className="whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-rl_muted">
            Queue
          </Link>
          <Link href="/settings" className="whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-rl_muted">
            Settings
          </Link>
        </nav>
      </div>

      <div className="min-w-0 flex-1">
        <main id="main-content">{children}</main>
      </div>
    </div>
  );
}
