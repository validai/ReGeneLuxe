"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/nav";
import { useProfileSession } from "./ProfileSession.jsx";

const MENU = [
  { href: "/settings#profile", label: "View profile" },
  { href: "/settings/profile", label: "Edit profile" },
  { href: "/settings#connections", label: "Connections" },
  { href: "/settings/profile", label: "Profile settings" },
];

export default function ProfileSwitcher({ collapsed = false }) {
  const { profiles, activeProfile, setActiveProfile } = useProfileSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!activeProfile) return null;

  const count = profiles.length;
  const initial = (activeProfile.displayName || "?").slice(0, 1).toUpperCase();

  return (
    <div ref={rootRef} className={collapsed ? "relative px-1.5 pb-3" : "relative px-3 pb-3"}>
      <p className={collapsed ? "sr-only" : "mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-rl_muted"}>
        Active profile
      </p>
      {count > 1 ? (
        <label className="mb-2 block">
          <span className="sr-only">Switch profile</span>
          <select
            className="rl-input py-1.5 text-xs"
            value={activeProfile.id}
            onChange={(event) => setActiveProfile(event.target.value)}
            title={activeProfile.displayName}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {collapsed ? (profile.displayName?.[0] || "?") : profile.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        className={`flex w-full items-center gap-2 rounded-lg border border-rl_border bg-rl_bg/40 text-left transition-colors hover:border-rl_accent/40 ${collapsed ? "justify-center px-1 py-2" : "px-2 py-2"}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={`${activeProfile.displayName} · Active profile`}
      >
        {activeProfile.avatarUrl ? (
          <img src={activeProfile.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rl_surfaceActive text-xs font-semibold">
            {initial}
          </span>
        )}
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-rl_text">{activeProfile.displayName}</span>
            <span className="block truncate text-[11px] text-rl_muted">Active profile</span>
          </span>
        )}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-2 right-2 z-50 mt-1 overflow-hidden rounded-xl border border-rl_border bg-rl_surfaceRaised shadow-lg"
        >
          {MENU.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              role="menuitem"
              className="block px-3 py-2.5 text-sm text-rl_text hover:bg-rl_surfaceHover"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
