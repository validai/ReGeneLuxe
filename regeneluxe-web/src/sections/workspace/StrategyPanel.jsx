import { useState } from "react";
import { buildCampaignStrategySummary, missingStrategyEssentials } from "../../data/campaignSummary.js";
import IntakePanel from "./IntakePanel.jsx";
import BlueprintPanel from "./BlueprintPanel.jsx";

export default function StrategyPanel({ campaign, accounts }) {
  const [mode, setMode] = useState("summary");
  const summary = buildCampaignStrategySummary(campaign, accounts);
  const questions = missingStrategyEssentials(campaign, accounts);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[
          ["summary", "Summary"],
          ["edit", "Edit strategy"],
          ["blueprint", "Blueprint"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition-colors duration-rl ${
              mode === id ? "bg-rl_accent text-white" : "text-rl_muted hover:text-rl_text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "summary" && (
        <div className="space-y-5">
          <dl className="space-y-4">
            {summary.lines.length === 0 && (
              <p className="text-sm text-rl_muted">No strategy yet. Start with a short definition.</p>
            )}
            {summary.lines.map((line) => (
              <div key={line.label}>
                <dt className="rl-label">{line.label}</dt>
                <dd className="mt-1 text-sm text-rl_text">{line.value}</dd>
              </div>
            ))}
          </dl>
          {questions.length > 0 && (
            <div>
              <p className="rl-label">Still needs</p>
              <ul className="mt-2 space-y-1 text-sm text-rl_text">
                {questions.map((question) => <li key={question}>{question}</li>)}
              </ul>
            </div>
          )}
          <button type="button" className="rl-btn" onClick={() => setMode("edit")}>
            Edit strategy
          </button>
        </div>
      )}

      {mode === "edit" && (
        <div className="space-y-4">
          <p className="text-sm text-rl_muted">
            Essentials first — Purpose, Content, and Audience. Reveal the rest when you need them.
          </p>
          <IntakePanel campaign={campaign} accounts={accounts} essentialsOnly />
        </div>
      )}

      {mode === "blueprint" && <BlueprintPanel campaign={campaign} accounts={accounts} />}
    </div>
  );
}
