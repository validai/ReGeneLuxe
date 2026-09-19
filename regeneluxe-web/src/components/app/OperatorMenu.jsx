"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SignOut, GearSix, PlugsConnected } from "@phosphor-icons/react";
import { useProfileSession } from "./ProfileSession.jsx";
import { signOutOperator } from "../../../app/actions/auth";
import { displayGoogleIdentity } from "../../data/googleIdentity.js";

export default function OperatorMenu({ collapsed = false }) {
  const { operator, activeProfile } = useProfileSession();
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

  if (!operator) return null;

  const googleEmail = displayGoogleIdentity(activeProfile, operator);
  const initial = (googleEmail || "?").slice(0, 1).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-rl_muted transition-colors duration-rl hover:bg-rl_surfaceHover hover:text-rl_text ${collapsed ? "justify-center px-0" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={googleEmail}
      >
        {activeProfile?.avatarUrl || operator.avatarUrl ? (
          <img src={activeProfile?.avatarUrl || operator.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rl_surfaceActive text-xs font-semibold text-rl_text">
            {initial}
          </span>
        )}
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate font-medium text-rl_text">{googleEmail}</span>
            <span className="block truncate text-[11px]">Signed in</span>
          </span>
        )}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-2 right-2 z-50 mb-2 overflow-hidden rounded-xl border border-rl_border bg-rl_surfaceRaised shadow-lg"
        >
          <Link
            href="/settings#connections"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-rl_text hover:bg-rl_surfaceHover"
            onClick={() => setOpen(false)}
          >
            <GearSix size={16} />
            Google account
          </Link>
          <Link
            href="/settings#connections"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-rl_text hover:bg-rl_surfaceHover"
            onClick={() => setOpen(false)}
          >
            <PlugsConnected size={16} />
            Connections
          </Link>
          <form action={signOutOperator}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-rl_text hover:bg-rl_surfaceHover"
            >
              <SignOut size={16} />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
