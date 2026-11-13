"use client";

import { useState } from "react";
import { authorizeCreateAnotherProfile } from "../../../app/actions/auth";
import { CREATE_ANOTHER_PROFILE_HINT } from "../../data/profileModels.js";

/**
 * Compact authorize form used in menus and Settings.
 */
export default function CreateAnotherProfileForm({
  layout = "menu",
  onCancel,
} = {}) {
  const [email, setEmail] = useState("");
  const compact = layout === "menu";

  return (
    <div className={compact ? "space-y-2 border-t border-rl_border px-3 py-3" : "space-y-3"}>
      <p className={`leading-5 text-rl_muted ${compact ? "text-xs" : "text-sm"}`}>
        {CREATE_ANOTHER_PROFILE_HINT}
      </p>
      <form action={authorizeCreateAnotherProfile} className="space-y-2">
        <label className="block">
          <span className={`mb-1 block font-medium text-rl_text ${compact ? "text-xs" : "text-sm"}`}>
            Google email for new profile
          </span>
          <input
            type="email"
            name="inviteEmail"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="artist@example.com"
            className="rl-input w-full px-2 py-1.5 text-sm"
          />
        </label>
        <div className="flex gap-2">
          <button type="submit" className={`rl-btn flex-1 ${compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"}`}>
            Continue with Google
          </button>
          {onCancel ? (
            <button
              type="button"
              className={`rl-btn-ghost flex-1 ${compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"}`}
              onClick={onCancel}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
