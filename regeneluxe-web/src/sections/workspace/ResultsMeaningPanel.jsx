import { useState } from "react";
import FormField, { fieldClass } from "../../components/app/FormField.jsx";
import IteratePanel from "./IteratePanel.jsx";
import { updateCampaign } from "../../data/campaignRepository.js";
import { emptyInterpretation } from "../../data/domain.js";
import { proposeIteration, persistProposedDecision } from "../../data/ai/campaignBrain.js";
import { listSnapshots } from "../../data/collectionRepository.js";

const FIELDS = [
  ["winningPlatform", "Winning platform"],
  ["winningContent", "Winning content"],
  ["winningFormat", "Winning format"],
  ["winningCreative", "Winning creative direction"],
  ["winningCta", "Winning CTA"],
  ["failedApproach", "Failed approach"],
  ["successfulHypothesis", "Successful hypothesis"],
  ["failedHypothesis", "Failed hypothesis"],
  ["lessons", "Lessons"],
  ["recommendations", "Future recommendations"],
];

export default function ResultsMeaningPanel({ campaign }) {
  const [form, setForm] = useState(() => ({ ...emptyInterpretation(), ...(campaign.interpretation || {}) }));
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-rl_muted">What did it mean?</p>
        <p className="text-sm text-rl_muted">Interpretation only. Metrics stay on Analytics.</p>
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            updateCampaign(campaign.id, { interpretation: { ...form, source: "MANUAL" } });
            setSaved(true);
          }}
        >
          {FIELDS.map(([key, label]) => (
            <FormField key={key} id={`meaning-${key}`} label={label}>
              <textarea
                id={`meaning-${key}`}
                className={fieldClass}
                rows={2}
                value={form[key] || ""}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, [key]: e.target.value }));
                  setSaved(false);
                }}
              />
            </FormField>
          ))}
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" className="rl-btn">Save interpretation</button>
            <button
              type="button"
              className="rl-btn-ghost"
              onClick={() => {
                const proposal = proposeIteration(campaign, listSnapshots());
                if (!proposal.available) {
                  setNote(proposal.reason);
                  return;
                }
                persistProposedDecision(proposal.decision);
                setNote(proposal.decision.decision);
              }}
            >
              Propose next change
            </button>
            {saved && <p className="text-xs text-rl_ok">Saved.</p>}
          </div>
        </form>
        {note && <p className="text-sm text-rl_muted">{note}</p>}
      </section>
      <IteratePanel campaign={campaign} />
    </div>
  );
}
