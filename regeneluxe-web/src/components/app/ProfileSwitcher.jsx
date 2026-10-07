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
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!activeProfile) return null;

  const initial = (activeProfile.displayName || "?").slice(0, 1).toUpperCase();

  return (
    <div ref={rootRef} className={`relative ${collapsed ? "px-2 pb-3" : "px-3 pb-3"}`}>
      <button
        type="button"
        className={`flex items-center rounded-lg text-left transition-colors hover:bg-rl_surfaceHover ${
          collapsed
            ? "h-10 w-10 justify-center"
            : "w-full gap-2.5 px-2 py-1.5"
        }`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={activeProfile.displayName}
        title={activeProfile.displayName}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rl_surfaceActive">
          {activeProfile.avatarUrl ? (
            <img src={activeProfile.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-semibold">{initial}</span>
          )}
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-rl_text">{activeProfile.displayName}</span>
          </span>
        )}
      </button>
      {open ? (
        <div
          role="menu"
          className={`absolute z-50 mt-1 overflow-hidden rounded-xl border border-rl_border bg-rl_surfaceRaised shadow-lg ${
            collapsed ? "left-2 w-56" : "left-3 right-3"
          }`}
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
