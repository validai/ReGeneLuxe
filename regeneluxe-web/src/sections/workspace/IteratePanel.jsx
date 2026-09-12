import { useState } from "react";
import FormField, { fieldClass } from "../../components/app/FormField.jsx";
import { updateCampaign } from "../../data/campaignRepository.js";
import { emptyIteration } from "../../data/models.js";

const FIELDS = [
  ["whatWorked", "What worked"],
  ["whatDidnt", "What didn't"],
  ["whatWeLearned", "What we learned"],
  ["whatToChange", "What to change"],
  ["whatToRepeat", "What to repeat"],
  ["nextTest", "Next test"],
];

export default function IteratePanel({ campaign, onSaved }) {
  const [form, setForm] = useState(() => ({ ...emptyIteration(), ...campaign.iteration }));
  const [saved, setSaved] = useState(false);

  const handleSave = (event) => {
    event.preventDefault();
    const updated = updateCampaign(campaign.id, {
      iteration: form,
    });
    setSaved(true);
    onSaved?.(updated);
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {FIELDS.map(([key, label]) => (
        <FormField key={key} id={`iter-${key}`} label={label}>
          <textarea
            id={`iter-${key}`}
            className={fieldClass}
            rows={3}
            value={form[key] || ""}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, [key]: e.target.value }));
              setSaved(false);
            }}
          />
        </FormField>
      ))}
      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-full bg-rl_accent px-5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rl_bg">
          Save lessons
        </button>
        {saved && <p className="text-xs text-rl_ok">Saved.</p>}
      </div>
    </form>
  );
}
