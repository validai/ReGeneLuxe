"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/nav";
import { useProfileSession } from "./ProfileSession.jsx";

const MENU = [
  { href: "/settings#account", label: "Account" },
  { href: "/settings/profile", label: "Edit account" },
  { href: "/settings#connections", label: "Connections" },
];

export default function ProfileSwitcher({ collapsed = false }) {
  const { activeProfile } = useProfileSession();
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

  const initial = (activeProfile.displayName || "?").slice(0, 1).toUpperCase();

  return (
    <div ref={rootRef} className={collapsed ? "relative px-1.5 pb-3" : "relative px-3 pb-3"}>
      <button
        type="button"
        className={`flex w-full items-center gap-2 rounded-lg border border-rl_border bg-rl_bg/40 text-left transition-colors hover:border-rl_accent/40 ${collapsed ? "justify-center px-1 py-2" : "px-2 py-2"}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={activeProfile.displayName}
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
