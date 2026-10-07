"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import BrandTitle from "../BrandTitle.jsx";
import { NavIcon } from "./Icon.jsx";
import { useAppData } from "../../hooks/useAppData.js";
import { getSidebarCollapsed, setSidebarCollapsed } from "../../data/uiPrefs.js";
import ProfileSwitcher from "./ProfileSwitcher.jsx";
import OperatorMenu from "./OperatorMenu.jsx";
import SocialAccountPicker from "./SocialAccountPicker.jsx";

/**
 * Native App Router shell — expanded desktop, compact desktop rail, mobile drawer.
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

function navClass(isActive, compact, extra = "") {
  return [
    "group flex items-center rounded-lg text-sm font-medium tracking-tight transition-colors duration-rl",
    compact ? "h-10 w-10 justify-center px-0" : "gap-3 px-3 py-2.5",
    isActive
      ? "bg-rl_surfaceActive text-rl_text shadow-[inset_3px_0_0_0_rgb(var(--rl-accent))]"
      : "text-rl_muted hover:bg-rl_surfaceHover hover:text-rl_text",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function SidebarBody({
  compact,
  pathname,
  accounts,
  workingAccountId,
  onNavigate,
  onOpenCommand,
  onToggleCollapsed,
  collapsed,
  showCollapse = true,
}) {
  const router = useRouter();

  return (
    <>
      <div className={`flex items-center border-b border-rl_border py-3 ${compact ? "flex-col gap-2 px-2" : "justify-between gap-2 px-3"}`}>
        <Link href="/" className="min-w-0" title="ReGeneLuxe" onClick={onNavigate}>
          {compact ? (
            <span className="font-display text-xl font-bold tracking-tight text-rl_text" aria-label="ReGeneLuxe">R</span>
          ) : (
            <BrandTitle variant="header" />
          )}
        </Link>
        {showCollapse ? (
          <button
            type="button"
            className="rl-btn-icon h-8 w-8"
            onClick={onToggleCollapsed}
            aria-pressed={collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <NavIcon name={collapsed ? "expand" : "collapse"} size={16} />
          </button>
        ) : null}
      </div>

      <div className={`py-3 ${compact ? "flex justify-center px-2" : "px-3"}`}>
        <button
          type="button"
          className={compact ? "rl-btn-icon" : "rl-btn w-full"}
          onClick={() => {
            router.push("/content/new");
            onNavigate?.();
          }}
          title="Create"
          aria-label="Create"
        >
          <NavIcon name="create" size={compact ? 20 : 18} />
          {!compact && "Create"}
        </button>
      </div>

      <ProfileSwitcher collapsed={compact} />
      <SocialAccountPicker
        accounts={accounts}
        workingAccountId={workingAccountId}
        collapsed={compact}
      />

      <nav className={`flex-1 space-y-0.5 overflow-y-auto pb-3 ${compact ? "flex flex-col items-center px-2" : "px-2"}`} aria-label="Main">
        {LINKS.map((link) => {
          const isActive = linkActive(pathname, link.to, link.end);
          return (
            <Link
              key={link.to}
              href={link.to}
              title={link.label}
              aria-label={link.label}
              aria-current={isActive ? "page" : undefined}
              className={navClass(isActive, compact)}
              onClick={onNavigate}
            >
              <NavIcon name={link.icon} size={20} className={isActive ? "text-rl_text" : "text-current"} />
              {!compact && <span>{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={`mt-auto space-y-1 border-t border-rl_border py-3 ${compact ? "flex flex-col items-center px-2" : "px-2"}`}>
        <OperatorMenu collapsed={compact} />
        <Link
          href="/queue"
          title="Queue"
          aria-label="Queue"
          aria-current={linkActive(pathname, "/queue") ? "page" : undefined}
          className={navClass(linkActive(pathname, "/queue"), compact)}
          onClick={onNavigate}
        >
          <NavIcon name="queue" size={20} />
          {!compact && <span>Queue</span>}
        </Link>
        <button
          type="button"
          className={navClass(false, compact)}
          onClick={onOpenCommand}
          title="Search (⌘K)"
          aria-label="Search"
        >
          <NavIcon name="search" size={20} />
          {!compact && <span>Search</span>}
        </button>
        <Link
          href="/settings"
          title="Settings"
          aria-label="Settings"
          aria-current={linkActive(pathname, "/settings") ? "page" : undefined}
          className={navClass(linkActive(pathname, "/settings"), compact)}
          onClick={onNavigate}
        >
          <NavIcon name="settings" size={20} />
          {!compact && <span>Settings</span>}
        </Link>
      </div>
    </>
  );
}

export default function AppShellNext({ children, onOpenCommand }) {
  const pathname = usePathname() || "/";
  const { accounts, workingAccountId } = useAppData();
  const [collapsed, setCollapsed] = useState(() => getSidebarCollapsed());
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    setSidebarCollapsed(next);
  };

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-rl_bg text-rl_text lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-rl_accent focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <aside
        data-sidebar-state={collapsed ? "compact" : "expanded"}
        className={`sticky top-0 z-40 hidden h-screen flex-col overflow-x-hidden overflow-y-auto border-r border-rl_border bg-rl_surface transition-[width] duration-rl lg:flex ${
          collapsed ? "w-sidebar-collapsed" : "w-sidebar"
        }`}
      >
        <SidebarBody
          compact={collapsed}
          collapsed={collapsed}
          pathname={pathname}
          accounts={accounts}
          workingAccountId={workingAccountId}
          onOpenCommand={onOpenCommand}
          onToggleCollapsed={toggleCollapsed}
          showCollapse
        />
      </aside>

      <div className="sticky top-0 z-40 border-b border-rl_border bg-rl_surface/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="rl-btn-icon"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              title="Open navigation"
            >
              <NavIcon name="menu" size={18} />
            </button>
            <Link href="/" className="min-w-0 truncate"><BrandTitle variant="header" /></Link>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="rl-btn-icon" onClick={onOpenCommand} aria-label="Search" title="Search">
              <NavIcon name="search" size={18} />
            </button>
            <Link href="/content/new" className="rl-btn px-3 py-2" aria-label="Create">
              <NavIcon name="create" size={16} />
              Create
            </Link>
          </div>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" data-sidebar-state="drawer">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="relative flex h-full w-[min(18rem,88vw)] flex-col overflow-y-auto border-r border-rl_border bg-rl_surface shadow-rl_sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <div className="flex items-center justify-end px-2 pt-3">
              <button
                type="button"
                className="rl-btn-icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                title="Close navigation"
              >
                <NavIcon name="close" size={18} />
              </button>
            </div>
            <SidebarBody
              compact={false}
              collapsed={false}
              pathname={pathname}
              accounts={accounts}
              workingAccountId={workingAccountId}
              onNavigate={() => setMobileOpen(false)}
              onOpenCommand={() => {
                setMobileOpen(false);
                onOpenCommand?.();
              }}
              showCollapse={false}
            />
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <main id="main-content">{children}</main>
      </div>
    </div>
  );
}
