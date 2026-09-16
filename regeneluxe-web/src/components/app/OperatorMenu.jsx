"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SignOut, GearSix, PlugsConnected } from "@phosphor-icons/react";
import { useProfileSession } from "./ProfileSession.jsx";
import { signOutOperator } from "../../../app/actions/auth";

export default function OperatorMenu({ collapsed = false }) {
  const { operator } = useProfileSession();
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

  const initial = (operator.name || operator.email || "?").slice(0, 1).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-rl_muted transition-colors duration-rl hover:bg-rl_surfaceHover hover:text-rl_text ${collapsed ? "justify-center px-0" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={operator.name || operator.email}
      >
        {operator.avatarUrl ? (
          <img src={operator.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rl_surfaceActive text-xs font-semibold text-rl_text">
            {initial}
          </span>
        )}
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate font-medium text-rl_text">{operator.name || "Operator"}</span>
            <span className="block truncate text-[11px] text-rl_text">Signed in with Google</span>
            <span className="block truncate text-[11px]">{operator.email}</span>
          </span>
        )}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-2 right-2 z-50 mb-2 overflow-hidden rounded-xl border border-rl_border bg-rl_surfaceRaised shadow-lg"
        >
          <Link
            href="/settings#account"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-rl_text hover:bg-rl_surfaceHover"
            onClick={() => setOpen(false)}
          >
            <GearSix size={16} />
            Account &amp; Security
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
