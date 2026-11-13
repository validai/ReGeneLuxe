"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/nav";
import { useProfileSession } from "./ProfileSession.jsx";
import { signOutOperator } from "../../../app/actions/auth";
import { normalizeWorkspacePurpose } from "../../data/profileModels.js";
import CreateAnotherProfileForm from "./CreateAnotherProfileForm.jsx";

const MENU = [
  { href: "/settings#account", label: "Account" },
  { href: "/settings/profile", label: "Edit account" },
  { href: "/settings#connections", label: "Connections" },
  { href: "/settings#certification", label: "Connection Certification" },
];

function TestBadge({ compact = false }) {
  return (
    <span
      className={`inline-flex items-center rounded border border-amber-500/40 bg-amber-500/10 font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300 ${
        compact ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[10px]"
      }`}
      title="TEST WORKSPACE"
    >
      {compact ? "TEST" : "TEST WORKSPACE"}
    </span>
  );
}

export default function ProfileSwitcher({ collapsed = false, layout = "stack", showDetail = true }) {
  const { activeProfile } = useProfileSession();
  const [open, setOpen] = useState(false);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const rootRef = useRef(null);
  const purpose = normalizeWorkspacePurpose(activeProfile?.workspacePurpose);
  const isTest = purpose === "TEST";

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setConfirmCreate(false);
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        setConfirmCreate(false);
      }
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
  const avatar = (
    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rl_surfaceActive">
      {activeProfile.avatarUrl ? (
        <img src={activeProfile.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-semibold">{initial}</span>
      )}
    </span>
  );

  const menuBody = (
    <>
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
      {confirmCreate ? (
        <CreateAnotherProfileForm layout="menu" onCancel={() => setConfirmCreate(false)} />
      ) : (
        <button
          type="button"
          role="menuitem"
          className="block w-full px-3 py-2.5 text-left text-sm text-rl_text hover:bg-rl_surfaceHover"
          onClick={() => setConfirmCreate(true)}
        >
          Create another profile
        </button>
      )}
      <form action={signOutOperator} className="border-t border-rl_border">
        <button
          type="submit"
          role="menuitem"
          className="block w-full px-3 py-2.5 text-left text-sm text-rl_text hover:bg-rl_surfaceHover"
        >
          Sign out / Switch account
        </button>
      </form>
    </>
  );

  if (layout === "split") {
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          className="flex w-full items-center py-1 text-left transition-colors hover:bg-rl_surfaceHover"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={activeProfile.displayName}
          title={activeProfile.displayName}
        >
          <span className="flex h-10 w-[4.5rem] shrink-0 items-center justify-center">{avatar}</span>
          {showDetail ? (
            <span className="min-w-0 flex-1 pr-3">
              <span className="rl-label flex items-center gap-2">
                Workspace
                {isTest ? <TestBadge compact /> : null}
              </span>
              <span className="block truncate text-sm font-medium text-rl_text">{activeProfile.displayName}</span>
            </span>
          ) : null}
        </button>
        {open ? (
          <div
            role="menu"
            className={`absolute z-50 mt-1 w-64 overflow-hidden rounded-xl border border-rl_border bg-rl_surfaceRaised shadow-lg ${
              showDetail ? "left-[4.5rem]" : "left-full ml-2"
            }`}
          >
            {menuBody}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`relative ${collapsed ? "px-2 pb-3" : "px-3 pb-3"}`}>
      <button
        type="button"
        className={`flex items-center text-left transition-colors ${
          collapsed
            ? "h-10 w-10 justify-center rounded-lg hover:bg-rl_surfaceHover"
            : "w-full gap-2.5 rounded-xl border border-rl_border bg-[rgb(var(--bg-hover))] px-2.5 py-2 hover:border-rl_borderStrong"
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
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="block truncate text-sm font-medium text-rl_text">{activeProfile.displayName}</span>
              {isTest ? <TestBadge compact /> : null}
            </span>
          </span>
        )}
      </button>
      {collapsed && isTest ? (
        <p className="mt-1 text-center">
          <TestBadge compact />
        </p>
      ) : null}
      {open ? (
        <div
          role="menu"
          className={`absolute z-50 mt-1 overflow-hidden rounded-xl border border-rl_border bg-rl_surfaceRaised shadow-lg ${
            collapsed ? "left-2 w-64" : "left-3 right-3"
          }`}
        >
          {menuBody}
        </div>
      ) : null}
    </div>
  );
}
