import { useMemo, useState } from "react";
import FormField, { fieldClass } from "../../components/app/FormField.jsx";
import AccountBadge from "../../components/app/AccountBadge.jsx";
import EmptyState from "../../components/app/EmptyState.jsx";
import { updateCampaign } from "../../data/campaignRepository.js";
import { PLATFORM_METRICS, RESULT_METRIC_KEYS, emptyResult } from "../../data/models.js";

const NOTE_FIELDS = [
  ["whatWorked", "What worked"],
  ["whatFailed", "What failed"],
  ["unexpected", "Unexpected result"],
  ["audienceResponse", "Audience response"],
  ["timingIssue", "Timing issue"],
  ["creativeIssue", "Creative issue"],
  ["platformIssue", "Platform issue"],
  ["lesson", "Lesson"],
];

function metricLabel(key) {
  return String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function metricsForAccount(account) {
  if (!account) return RESULT_METRIC_KEYS;
  return PLATFORM_METRICS[account.platform] || RESULT_METRIC_KEYS;
}

export default function ResultsPanel({ campaign, accounts, onSaved }) {
  const [draft, setDraft] = useState(() => emptyResult());

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === draft.accountId) || null,
    [accounts, draft.accountId]
  );
  const metricKeys = metricsForAccount(selectedAccount);

  const saveResults = (results) => {
    onSaved?.(updateCampaign(campaign.id, { results }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const next = emptyResult(draft);
    saveResults([next, ...campaign.results]);
    setDraft(emptyResult());
  };

  const removeResult = (id) => {
    saveResults(campaign.results.filter((result) => result.id !== id));
  };

  const setMetric = (key, value) => {
    setDraft((prev) => ({
      ...prev,
      metrics: { ...prev.metrics, [key]: value },
    }));
  };

  const setNote = (key, value) => {
    setDraft((prev) => ({
      ...prev,
      notes: { ...prev.notes, [key]: value },
    }));
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-rl_border bg-rl_surface p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField id="result-asset" label="Asset">
            <select
              id="result-asset"
              className={fieldClass}
              value={draft.assetId}
              onChange={(e) => {
                const asset = campaign.assets.find((item) => item.id === e.target.value);
                setDraft((prev) => ({
                  ...prev,
                  assetId: e.target.value,
                  accountId: asset?.accountId || prev.accountId,
                }));
              }}
            >
              <option value="">Campaign-level (no asset)</option>
              {campaign.assets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.name}</option>
              ))}
            </select>
          </FormField>
          <FormField id="result-account" label="Account / platform">
            <select
              id="result-account"
              className={fieldClass}
              value={draft.accountId}
              onChange={(e) => setDraft((prev) => ({ ...prev, accountId: e.target.value }))}
            >
              <option value="">Unassigned</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.platform} · {account.handle || account.displayName}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metricKeys.map((key) => (
            <FormField key={key} id={`metric-${key}`} label={metricLabel(key)}>
              <input
                id={`metric-${key}`}
                className={fieldClass}
                inputMode="decimal"
                value={draft.metrics?.[key] ?? ""}
                onChange={(e) => setMetric(key, e.target.value)}
              />
            </FormField>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {NOTE_FIELDS.map(([key, label]) => (
            <FormField key={key} id={`note-${key}`} label={label}>
              <textarea
                id={`note-${key}`}
                className={fieldClass}
                rows={2}
                value={draft.notes?.[key] || ""}
                onChange={(e) => setNote(key, e.target.value)}
              />
            </FormField>
          ))}
        </div>

        <button type="submit" className="rounded-full bg-rl_accent px-5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
          Save result
        </button>
      </form>

      {campaign.results.length === 0 ? (
        <EmptyState title="No results yet" body="Launch the work externally, then record what actually happened." />
      ) : (
        <ul className="space-y-3">
          {campaign.results.map((result) => {
            const asset = campaign.assets.find((item) => item.id === result.assetId);
            const metricEntries = Object.entries(result.metrics || {}).filter(([, value]) => value !== "" && value != null);
            return (
              <li key={result.id} className="rounded-xl border border-rl_border bg-rl_surface px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-rl_text">
                    {asset ? asset.name : "Campaign-level result"}
                  </p>
                  <button type="button" onClick={() => removeResult(result.id)} className="text-xs uppercase tracking-[0.12em] text-rl_danger">
                    Remove
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <AccountBadge accountId={result.accountId} accounts={accounts} />
                  <span className="text-[11px] text-rl_muted">
                    {result.recordedAt ? new Date(result.recordedAt).toLocaleString() : ""}
                  </span>
                </div>
                {metricEntries.length > 0 && (
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    {metricEntries.map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-rl_muted">{metricLabel(key)}</dt>
                        <dd className="font-medium text-rl_text">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {result.notes?.lesson && (
                  <p className="mt-2 text-sm text-rl_text">{result.notes.lesson}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
