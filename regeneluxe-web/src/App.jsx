import "./index.css";

function App() {
  return (
    <div className="min-h-screen bg-rl_bg text-rl_ink flex items-center justify-center">
      <div className="rounded-3xl border border-black/5 bg-white/80 px-10 py-8 shadow-rl_soft">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-rl_muted">
          ReGeneLuxe
        </p>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.04em]">
          Clean, minimal, future-forward.
        </h1>
        <p className="mt-3 max-w-md text-sm text-rl_muted">
          If you can see this card centered on a soft off-white background,
          Tailwind is working and our base theme is wired correctly.
        </p>
      </div>
    </div>
  );
}

export default App;
