// src/components/dashboard/widgets/AudienceTuner.jsx
export default function AudienceTuner() {
  return (
    <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-6">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--dash-muted)]">
        Controls
      </p>
      <h3 className="text-sm font-semibold mt-1">Audience & placement tuner</h3>

      <div className="mt-4 grid gap-3 text-xs">
        <Field label="Primary region">
          <select className="field-select">
            <option>US only</option>
            <option>US + Canada</option>
            <option>North America + UK</option>
            <option>Global English</option>
          </select>
        </Field>

        <Field label="Objective">
          <select className="field-select">
            <option>Purchases</option>
            <option>Leads / calls</option>
            <option>Free trial signups</option>
            <option>Community growth</option>
          </select>
        </Field>

        <Field label="Optimisation style">
          <select className="field-select">
            <option>Balanced performance</option>
            <option>Aggressive scale</option>
            <option>Cost control first</option>
          </select>
        </Field>

        <Field label="Age band focus">
          <input type="range" min="0" max="100" className="w-full" />
          <p className="mt-1 text-[10px] text-[var(--dash-muted)]">
            Currently favouring 25–44. We&apos;ll rebalance if performance shifts.
          </p>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-[var(--dash-muted)]">{label}</p>
      {children}
    </div>
  );
}


