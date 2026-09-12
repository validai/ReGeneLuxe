export default function SectionPanel({ id, title, question, children }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4 border-b border-rl_border/70 pb-8 last:border-b-0 last:pb-0">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rl_accent">{title}</p>
        {question && <h2 className="mt-1 text-lg font-semibold text-rl_text">{question}</h2>}
      </header>
      {children}
    </section>
  );
}
