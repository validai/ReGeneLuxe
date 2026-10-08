"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import BrandMark from "../BrandMark.jsx";
import { NavIcon } from "./Icon.jsx";
import { useAppData } from "../../hooks/useAppData.js";
import { getSidebarCollapsed, setSidebarCollapsed } from "../../data/uiPrefs.js";
import ProfileSwitcher from "./ProfileSwitcher.jsx";
import OperatorMenu from "./OperatorMenu.jsx";
import SocialAccountPicker from "./SocialAccountPicker.jsx";

/**
 * Native App Router shell.
 * Desktop: permanent 72px icon rail plus a collapsible detail panel.
 * Mobile: drawer. The desktop rail never collapses away.
 */

const SIDEBAR_EVENT = "regeneluxe-sidebar";

function subscribeSidebar(onStoreChange) {
  window.addEventListener(SIDEBAR_EVENT, onStoreChange);
  return () => window.removeEventListener(SIDEBAR_EVENT, onStoreChange);
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

function linkActive(pathname, to, end) {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function navClass(isActive, compact) {
  return [
    "group flex items-center rounded-lg text-sm font-medium tracking-tight transition-colors duration-rl",
    compact ? "h-10 w-10 justify-center" : "gap-3 px-2.5 py-2",
    isActive
      ? "bg-[rgb(var(--accent-primary)/0.16)] text-rl_text shadow-[inset_2px_0_0_0_rgb(var(--rl-accent))]"
      : "text-rl_textSecondary hover:bg-rl_surfaceHover hover:text-rl_text",
  ].join(" ");
}

function desktopItemClass(isActive) {
  return [
    "flex w-full items-center text-left text-sm font-medium tracking-tight transition-colors duration-rl",
    isActive
      ? "bg-[rgb(var(--accent-primary)/0.16)] text-rl_text shadow-[inset_2px_0_0_0_rgb(var(--rl-accent))]"
      : "text-rl_textSecondary hover:bg-rl_surfaceHover hover:text-rl_text",
  ].join(" ");
}

function AppBrand({ compact, onNavigate }) {
  return (
    <Link
      href="/"
      title="ReGeneLuxe"
      aria-label="ReGeneLuxe"
      onClick={onNavigate}
      className={compact ? "flex h-10 w-10 items-center justify-center" : "flex min-w-0 items-center"}
    >
      {compact ? (
        <BrandMark size={32} />
      ) : (
        <span className="truncate font-display text-base font-semibold tracking-tight text-rl_text">
          ReGeneLuxe
        </span>
      )}
    </Link>
  );
}

function SeamChevron({ collapsed, onClick }) {
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={collapsed}
      aria-label={label}
      title={label}
      data-sidebar-chevron={collapsed ? "right" : "left"}
      className="absolute left-[4.5rem] top-[3.25rem] z-50 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-rl_border bg-rl_surface text-rl_text shadow-[0_0_0_3px_rgb(var(--bg-surface))] hover:border-rl_accent hover:text-[rgb(var(--accent-secondary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--focus-ring)/0.55)]"
    >
      <NavIcon name={collapsed ? "expand" : "collapse"} size={14} />
    </button>
  );
}

function SidebarBody({
  compact,
  pathname,
  accounts,
  workingAccountId,
  onNavigate,
  onOpenCommand,
}) {
  const router = useRouter();

  return (
    <>
      <div className={`shrink-0 ${compact ? "flex justify-center px-2 pt-4" : "px-3 pt-4"}`}>
        <AppBrand compact={compact} onNavigate={onNavigate} />
      </div>

      <div className={`shrink-0 ${compact ? "flex justify-center px-2 py-3" : "px-3 py-3"}`}>
        <button
          type="button"
          className={compact
            ? "flex h-10 w-10 items-center justify-center rounded-lg bg-rl_accent text-white hover:bg-rl_accentHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--focus-ring)/0.55)]"
            : "rl-btn w-full"}
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

      {!compact && <p className="rl-label shrink-0 px-5 pb-1">Workspace</p>}
      <div className="shrink-0">
        <ProfileSwitcher collapsed={compact} />
      </div>
      {compact ? <div className="mx-auto mb-2 h-px w-6 shrink-0 bg-rl_border" role="separator" /> : null}
      <SocialAccountPicker
        accounts={accounts}
        workingAccountId={workingAccountId}
        collapsed={compact}
      />

      <nav className={`min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-2 ${compact ? "flex flex-col items-center px-2" : "px-2"}`} aria-label="Main">
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
              <NavIcon name={link.icon} size={20} className={isActive ? "text-[rgb(var(--accent-secondary))]" : "text-current"} />
              {!compact && <span>{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={`mt-auto shrink-0 space-y-0.5 border-t border-rl_border py-2 ${compact ? "flex flex-col items-center px-2" : "px-2"}`}>
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
        <OperatorMenu collapsed={compact} />
      </div>
    </>
  );
}

export default function AppShellNext({ children, onOpenCommand }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { accounts, workingAccountId } = useAppData();
  const collapsed = useSyncExternalStore(subscribeSidebar, getSidebarCollapsed, () => false);
  const chromeReady = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    setSidebarCollapsed(!collapsed);
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
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
        data-sidebar-rail="permanent"
        data-sidebar-panel={collapsed ? "hidden" : "open"}
        className={`sticky top-0 z-40 hidden h-screen shrink-0 overflow-visible lg:flex ${
          collapsed ? "w-sidebar-collapsed min-w-[4.5rem]" : "w-sidebar min-w-[15rem]"
        }`}
      >
        <SeamChevron collapsed={collapsed} onClick={toggleCollapsed} />
        <div className="relative flex h-full w-full flex-col overflow-x-hidden overflow-y-hidden border-r border-rl_border bg-rl_surface pb-16">
          <Link
            href="/"
            title="ReGeneLuxe"
            aria-label="ReGeneLuxe"
            className="flex items-center pt-4"
          >
            <span className="flex h-10 w-[4.5rem] shrink-0 items-center justify-center">
              <BrandMark size={32} />
            </span>
            {!collapsed ? (
              <span className="min-w-0 flex-1 truncate pl-2 pr-3 font-display text-base font-semibold tracking-tight text-rl_text">
                ReGeneLuxe
              </span>
            ) : null}
          </Link>

          <button
            type="button"
            className="mt-6 flex w-full items-center"
            onClick={() => router.push("/content/new")}
            title="Create"
            aria-label="Create"
          >
            <span className="flex h-10 w-[4.5rem] shrink-0 items-center justify-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rl_accent text-white">
                <NavIcon name="create" size={20} />
              </span>
            </span>
            {!collapsed ? (
              <span className="mr-3 flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-rl_accent text-sm font-semibold text-white">
                Create
              </span>
            ) : null}
          </button>

          <div className="mt-3">
            <ProfileSwitcher layout="split" showDetail={!collapsed} />
          </div>
          <div className="mx-3 my-2 h-px shrink-0 bg-rl_border" role="separator" />
          <SocialAccountPicker
            accounts={chromeReady ? accounts : []}
            workingAccountId={workingAccountId}
            layout="split"
            showDetail={!collapsed}
          />

          <nav className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-2" aria-label="Main">
            {LINKS.map((link) => {
              const isActive = linkActive(pathname, link.to, link.end);
              return (
                <Link
                  key={link.to}
                  href={link.to}
                  title={link.label}
                  aria-label={link.label}
                  aria-current={isActive ? "page" : undefined}
                  className={desktopItemClass(isActive)}
                >
                  <span className="flex h-10 w-[4.5rem] shrink-0 items-center justify-center">
                    <NavIcon name={link.icon} size={20} className={isActive ? "text-[rgb(var(--accent-secondary))]" : "text-current"} />
                  </span>
                  {!collapsed ? <span className="min-w-0 flex-1 truncate pr-3">{link.label}</span> : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto shrink-0 space-y-0.5 border-t border-rl_border py-2">
            <Link
              href="/queue"
              title="Queue"
              aria-label="Queue"
              aria-current={linkActive(pathname, "/queue") ? "page" : undefined}
              className={desktopItemClass(linkActive(pathname, "/queue"))}
            >
              <span className="flex h-10 w-[4.5rem] shrink-0 items-center justify-center">
                <NavIcon name="queue" size={20} />
              </span>
              {!collapsed ? <span className="min-w-0 flex-1 truncate pr-3">Queue</span> : null}
            </Link>
            <button
              type="button"
              className={desktopItemClass(false)}
              onClick={onOpenCommand}
              title="Search (⌘K)"
              aria-label="Search"
            >
              <span className="flex h-10 w-[4.5rem] shrink-0 items-center justify-center">
                <NavIcon name="search" size={20} />
              </span>
              {!collapsed ? <span className="min-w-0 flex-1 truncate pr-3">Search</span> : null}
            </button>
            <Link
              href="/settings"
              title="Settings"
              aria-label="Settings"
              aria-current={linkActive(pathname, "/settings") ? "page" : undefined}
              className={desktopItemClass(linkActive(pathname, "/settings"))}
            >
              <span className="flex h-10 w-[4.5rem] shrink-0 items-center justify-center">
                <NavIcon name="settings" size={20} />
              </span>
              {!collapsed ? <span className="min-w-0 flex-1 truncate pr-3">Settings</span> : null}
            </Link>
            <OperatorMenu layout="split" showDetail={!collapsed} />
          </div>
        </div>
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
            <Link href="/" className="min-w-0 truncate font-display text-sm font-semibold tracking-tight text-rl_text" aria-label="ReGeneLuxe">
              ReGeneLuxe
            </Link>
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
            className="relative flex h-full w-[min(18rem,88vw)] flex-col overflow-y-auto border-r border-rl_border bg-rl_surface pb-24 shadow-rl_sheet"
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
              pathname={pathname}
              accounts={chromeReady ? accounts : []}
              workingAccountId={workingAccountId}
              onNavigate={() => setMobileOpen(false)}
              onOpenCommand={() => {
                setMobileOpen(false);
                onOpenCommand?.();
              }}
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
