"use client";

import Icon from "./Icon.jsx";

export default function EmptyState({ title, body, action, icon = "sparkle" }) {
  return (
    <div className="rounded-2xl border border-dashed border-rl_border bg-rl_surfaceRaised/80 px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-rl_accent/20 bg-rl_surfaceActive text-rl_text">
        <Icon name={icon} size={24} weight="bold" />
      </div>
      <h2 className="font-display text-lg font-semibold tracking-tight text-rl_text">{title}</h2>
      {body && <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-rl_muted">{body}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
