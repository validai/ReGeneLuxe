export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="rl-label">{eyebrow}</p>
        )}
        <h1 className="rl-page-title mt-1">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-rl_muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
