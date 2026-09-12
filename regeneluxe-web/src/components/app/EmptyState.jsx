export default function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-rl_border bg-rl_surface px-6 py-10 text-center">
      <h2 className="text-base font-semibold text-rl_text">{title}</h2>
      {body && <p className="mx-auto mt-2 max-w-md text-sm text-rl_muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
