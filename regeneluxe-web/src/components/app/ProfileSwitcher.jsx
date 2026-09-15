"use client";

import { useProfileSession } from "./ProfileSession.jsx";

export default function ProfileSwitcher({ collapsed = false }) {
  const { profiles, activeProfile, setActiveProfile } = useProfileSession();
  if (!activeProfile) return null;

  const count = profiles.length;
  const initial = (activeProfile.displayName || "?").slice(0, 1).toUpperCase();

  return (
    <div className={collapsed ? "px-1.5 pb-3" : "px-3 pb-3"}>
      <p className={collapsed ? "sr-only" : "mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-rl_muted"}>
        Profile
      </p>
      {count > 1 ? (
        <label className="block">
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
      ) : (
        <div
          className={`flex items-center gap-2 rounded-lg border border-rl_border bg-rl_bg/40 ${collapsed ? "justify-center px-1 py-2" : "px-2 py-2"}`}
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
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-rl_text">{activeProfile.displayName}</p>
              <p className="truncate text-[11px] text-rl_muted">Active profile</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
