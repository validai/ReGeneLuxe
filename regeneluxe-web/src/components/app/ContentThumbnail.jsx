import { useState } from "react";
import { resolveContentThumbnail } from "../../data/contentThumbnail.js";

const FRAME = {
  dense: "h-6 w-6 rounded",
  compact: "h-10 w-10 rounded-md",
  standard: "h-16 w-16 rounded-lg",
  large: "aspect-video w-full max-h-56 rounded-xl",
};

/**
 * Shared content preview. Renders nothing unless a real image or poster exists.
 */
export default function ContentThumbnail({ content, size = "compact", className = "" }) {
  const model = resolveContentThumbnail(content);
  const [failed, setFailed] = useState(false);
  if (!model.src || failed) return null;
  const frame = FRAME[size] || FRAME.compact;
  const count = model.count > 1 ? model.count : 0;
  return (
    <span className={`relative inline-block shrink-0 overflow-hidden border border-rl_border bg-rl_surfaceSoft ${frame} ${className}`}>
      <img
        src={model.src}
        alt={model.alt}
        loading={size === "large" ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
      {model.kind === "video" && size !== "dense" && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">Play</span>
        </span>
      )}
      {model.duration && (size === "standard" || size === "large") && (
        <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/55 px-1 text-[10px] tabular-nums text-white">
          {model.duration}
        </span>
      )}
      {count > 0 && size !== "dense" && (
        <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/55 px-1 text-[10px] font-semibold tabular-nums text-white">
          {count}
        </span>
      )}
    </span>
  );
}
