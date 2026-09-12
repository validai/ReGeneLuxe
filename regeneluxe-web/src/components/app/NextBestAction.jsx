import { Link } from "@/nav";

export default function NextBestAction({ title = "Next", message, href, actionLabel = "Open", onAction }) {
  if (!message) return null;

  return (
    <section className="rounded-xl border border-rl_accent/30 bg-rl_accent/5 px-5 py-5">
      <p className="rl-label text-rl_accent">{title}</p>
      <p className="mt-2 max-w-2xl text-lg font-semibold tracking-tight text-rl_text sm:text-xl">
        {message}
      </p>
      {href ? (
        <Link to={href} className="mt-4 inline-flex rl-btn">{actionLabel}</Link>
      ) : onAction ? (
        <button type="button" className="mt-4 rl-btn" onClick={onAction}>{actionLabel}</button>
      ) : null}
    </section>
  );
}
