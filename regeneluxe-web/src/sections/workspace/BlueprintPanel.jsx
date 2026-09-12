import { useState } from "react";
import { fieldClass } from "../../components/app/FormField.jsx";
import { updateCampaign } from "../../data/campaignRepository.js";
import { emptyBlueprint, emptyCreativeDirection } from "../../data/models.js";
import { deriveBlueprintFromIntake } from "../../data/campaignContext.js";

const FIELDS = [
  ["objective", "Objective"],
  ["audience", "Audience"],
  ["coreMessage", "Core message"],
  ["primaryAction", "Primary CTA"],
  ["campaignStructure", "Campaign structure"],
  ["channelStrategy", "Platform strategy"],
  ["contentFormats", "Content formats"],
  ["assetRequirements", "Asset requirements"],
  ["testingHypotheses", "Testing plan"],
  ["successCriteria", "Success criteria"],
];

export default function BlueprintPanel({ campaign, accounts }) {
  const derived = deriveBlueprintFromIntake(campaign, accounts);
  const [form, setForm] = useState(() => ({
    ...emptyBlueprint(),
    ...derived,
    ...campaign.blueprint,
    creativeDirection: {
      ...emptyCreativeDirection(),
      ...derived.creativeDirection,
      ...(campaign.blueprint?.creativeDirection || {}),
    },
  }));
  const [saved, setSaved] = useState(false);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value, edited: { ...prev.edited, [key]: true } }));
    setSaved(false);
  };

  const setDirection = (key, value) => {
    setForm((prev) => ({
      ...prev,
      creativeDirection: { ...emptyCreativeDirection(), ...prev.creativeDirection, [key]: value },
      edited: { ...prev.edited, creative: true },
    }));
    setSaved(false);
  };

  const handleSave = (event) => {
    event.preventDefault();
    updateCampaign(campaign.id, { blueprint: form });
    setSaved(true);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rl_accent">From intake</p>
        <p className="text-xs text-rl_muted">Read-only source. Change Intake to update this layer.</p>
        <dl className="space-y-3 text-sm">
          {FIELDS.map(([key, label]) => (
            <div key={key}>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-rl_muted">{label}</dt>
              <dd className="mt-1 text-rl_text">{derived[key] || "—"}</dd>
            </div>
          ))}
          <div>
            <dt className="text-[11px] uppercase tracking-[0.14em] text-rl_muted">Creative direction</dt>
            <dd className="mt-1 text-rl_text">
              {[derived.creativeDirection.tone, derived.creativeDirection.visual].filter(Boolean).join(" · ") || "—"}
            </dd>
          </div>
        </dl>
      </section>

      <form onSubmit={handleSave} className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rl_accent">Blueprint</p>
        <p className="text-xs text-rl_muted">Your edited strategy. A future agent can fill this later.</p>
        {FIELDS.map(([key, label]) => (
          <label key={key} className="block text-xs text-rl_muted">
            {label}
            <textarea
              className={`${fieldClass} mt-1`}
              rows={2}
              value={form[key] || ""}
              onChange={(e) => setField(key, e.target.value)}
            />
          </label>
        ))}
        <div className="grid gap-3 md:grid-cols-3">
          {["tone", "visual", "approach"].map((key) => (
            <label key={key} className="text-xs text-rl_muted">
              Creative: {key}
              <input
                className={`${fieldClass} mt-1`}
                value={form.creativeDirection?.[key] || ""}
                onChange={(e) => setDirection(key, e.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="rl-btn">Save blueprint</button>
          {saved && <p className="text-xs text-rl_ok">Saved.</p>}
        </div>
      </form>
    </div>
  );
}
