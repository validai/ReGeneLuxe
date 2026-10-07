"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PlatformIcon, NavIcon } from "./Icon.jsx";
import { setWorkingAccountId, accountOptionLabel } from "../../data/workingContext.js";
import { displayConnectionState } from "../../data/connectionStatus.js";

/**
 * Filters the working SOCIAL CHANNEL. Not a workspace / brand / account switcher.
 */
export default function SocialAccountPicker({
  accounts = [],
  workingAccountId = "",
  collapsed = false,
}) {
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

  const selected = accounts.find((account) => account.id === workingAccountId) || null;
  const selectedLabel = selected
    ? accountOptionLabel(selected)
    : accounts.length
      ? "All social accounts"
      : "No social accounts";

  if (collapsed) return null;

  if (!accounts.length) {
    return (
      <div className={collapsed ? "px-2 pb-3" : "px-3 pb-3"}>
        <Link
          href="/accounts"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-rl_muted transition-colors hover:bg-rl_surfaceHover hover:text-rl_text"
          title="Add social account"
          aria-label="Add social account"
        >
          <NavIcon name="create" size={18} />
          {!collapsed && <span>Add social account</span>}
        </Link>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`relative ${collapsed ? "px-2 pb-3" : "px-3 pb-3"}`}>
      {!collapsed && (
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-rl_muted">
          Social channel
        </p>
      )}
      <button
        type="button"
        className="flex w-full items-center gap-2.5 rounded-xl border border-rl_border bg-rl_bg/40 px-2.5 py-2 text-left transition-colors hover:border-rl_borderStrong"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Social channel filter: ${selectedLabel}`}
        title={selectedLabel}
      >
        {selected ? (
          <PlatformIcon platform={selected.platform} size={18} />
        ) : (
          <NavIcon name="accounts" size={18} />
        )}
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate text-sm text-rl_text">{selectedLabel}</span>
        )}
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Social channels"
          className={`absolute z-50 mt-1 overflow-hidden rounded-xl border border-rl_border bg-rl_surfaceRaised shadow-lg ${
            collapsed ? "left-2 w-56" : "left-3 right-3"
          }`}
        >
          <button
            type="button"
            role="option"
            aria-selected={!selected}
            className="block w-full px-3 py-2.5 text-left text-sm text-rl_text hover:bg-rl_surfaceHover"
            onClick={() => {
              setWorkingAccountId("");
              setOpen(false);
            }}
          >
            All social accounts
          </button>
          {accounts.map((account) => {
            const view = displayConnectionState(account);
            const label = account.displayName || account.handle || account.platform;
            return (
              <button
                key={account.id}
                type="button"
                role="option"
                aria-selected={account.id === workingAccountId}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-rl_text hover:bg-rl_surfaceHover"
                onClick={() => {
                  setWorkingAccountId(account.id);
                  setOpen(false);
                }}
              >
                <PlatformIcon platform={account.platform} size={16} />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <span className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-rl_muted">
                  {view.label}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
