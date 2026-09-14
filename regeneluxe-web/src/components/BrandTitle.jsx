export default function BrandTitle({ variant = "header", className = "" }) {
  const base = "uppercase font-semibold text-rl_text relative";
  const size =
    variant === "hero"
      ? "font-display text-3xl sm:text-4xl lg:text-5xl tracking-[0.35em]"
      : "text-[11px] sm:text-xs tracking-[0.28em]";

  return <span className={`${base} ${size} ${className}`}>REGENELUXE</span>;
}
