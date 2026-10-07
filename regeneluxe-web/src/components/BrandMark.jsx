/**
 * Canonical ReGeneLuxe geometry from public/icon.svg.
 * Rendered as the product mark, never as a text glyph.
 */
const MARK_PATH = "M8 6h11.5c3.2 0 5.5 2.2 5.5 5.1 0 2.3-1.3 4.1-3.4 4.8L26 26h-4.2l-4.2-9.2H12V26H8V6zm4 3.2v7.2h7.1c1.7 0 2.8-1.1 2.8-2.7s-1.1-2.7-2.8-2.7H12z";

export default function BrandMark({ size = 28, className = "" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-rl_accent shadow-[0_0_0_1px_rgb(var(--accent-primary)/0.45)] ${className}`}
      style={{ width: size, height: size }}
      data-brand="regeneluxe"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        width={Math.round(size * 0.72)}
        height={Math.round(size * 0.72)}
        fill="none"
        aria-hidden="true"
      >
        <path fill="#F7F9FC" fillRule="evenodd" d={MARK_PATH} />
      </svg>
    </span>
  );
}
