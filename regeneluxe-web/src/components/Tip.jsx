// regeneluxe-web/src/components/Tip.jsx
export default function Tip({ text }) {
    return (
      <span className="ml-2 inline-block align-middle">
        <span className="group relative inline-flex h-5 w-5 items-center justify-center rounded-full border border-rl_border text-[0.7rem]">
          i
          <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden w-64 -translate-x-1/2 rounded-xl border border-rl_border bg-white p-3 text-xs leading-relaxed text-rl_muted shadow-rl_soft group-hover:block">
            {text}
          </span>
        </span>
      </span>
    );
  }
  