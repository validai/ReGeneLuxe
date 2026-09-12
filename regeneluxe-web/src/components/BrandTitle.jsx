export default function BrandTitle({ variant = "header", className = "" }) {
  const base = "uppercase font-semibold text-rl_text relative";
  const size =
    variant === "hero"
      ? "text-3xl sm:text-4xl lg:text-5xl tracking-[0.4em]"
      : "text-xs sm:text-sm tracking-[0.25em]";

  return <span className={`${base} ${size} ${className}`}>REGENELUXE</span>;
}
