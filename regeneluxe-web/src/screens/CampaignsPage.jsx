import { useState } from "react";
import { Link, useAppNavigate as useNavigate } from "@/nav";
import PageShell from "../components/app/PageShell.jsx";
import PageHeader from "../components/app/PageHeader.jsx";
import StatusBadge from "../components/app/StatusBadge.jsx";
import EmptyState from "../components/app/EmptyState.jsx";
import ConfirmDialog from "../components/app/ConfirmDialog.jsx";
import SegmentedControl from "../components/app/SegmentedControl.jsx";
import FormField, { fieldClass } from "../components/app/FormField.jsx";
import { useAppData } from "../hooks/useAppData.js";
import { createCampaign, deleteCampaign, setActiveCampaignId, setCampaignActive, updateCampaign } from "../data/campaignRepository.js";
import { optionLabels, GOAL_OPTIONS } from "../data/options.js";
import { buildCampaignStateSnapshot } from "../data/campaignMonitor.js";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export default function CampaignsPage() {
  const navigate = useNavigate();
  const { campaigns, accounts, content, workingAccountId } = useAppData();
  const [filter, setFilter] = useState("active");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    promoting: "",
    goal: "",
    accountIds: [],
    notes: "",
  });

  const scopedCampaigns = workingAccountId
    ? campaigns.filter((campaign) => (campaign.accountIds || []).includes(workingAccountId))
    : campaigns;

  const visible = scopedCampaigns.filter((campaign) => {
    if (filter === "active") return campaign.active !== false;
    if (filter === "inactive") return campaign.active === false;
    return true;
  });

  const toggleDraftAccount = (id) => {
    setDraft((prev) => {
      const set = new Set(prev.accountIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, accountIds: [...set] };
    });
  };

  const createFast = () => {
    const campaign = createCampaign({
      name: draft.name.trim() || "Untitled campaign",
      active: true,
      objective: draft.goal || draft.promoting,
      accountIds: draft.accountIds,
    });
    updateCampaign(campaign.id, {
      objective: draft.goal || draft.promoting,
      accountIds: draft.accountIds,
      intake: {
        promoted: { title: draft.promoting },
        goals: draft.goal ? [draft.goal] : [],
        notes: draft.notes,
      },
    });
    setCreating(false);
    setDraft({ name: "", promoting: "", goal: "", accountIds: [], notes: "" });
    navigate(`/campaigns/${campaign.id}`);
  };

  return (
    <PageShell>
      <PageHeader
        title="Campaigns"
        description="Strategy for a launch — not the whole app."
        actions={<button type="button" onClick={() => setCreating(true)} className="rl-btn">New campaign</button>}
      />

      {creating && (
        <section className="space-y-4 rounded-xl border border-rl_border bg-rl_surface/40 p-5">
          <div>
            <h2 className="rl-section-title">Quick start</h2>
            <p className="mt-1 text-sm text-rl_muted">Enough to begin. Deep strategy can wait.</p>
          </div>
          <FormField id="camp-name" label="Campaign name">
            <input id="camp-name" className={fieldClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Teotihuacan Album Launch" />
          </FormField>
          <FormField id="camp-promoting" label="What are you promoting?">
            <input id="camp-promoting" className={fieldClass} value={draft.promoting} onChange={(e) => setDraft({ ...draft, promoting: e.target.value })} />
          </FormField>
          <FormField id="camp-goal" label="Main goal">
            <select id="camp-goal" className={fieldClass} value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })}>
              <option value="">Select</option>
              {GOAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FormField>
          <fieldset>
            <legend className="mb-2 text-xs text-rl_muted">Accounts</legend>
            <div className="flex flex-wrap gap-2">
              {accounts.map((account) => {
                const active = draft.accountIds.includes(account.id);
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => toggleDraftAccount(account.id)}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      active ? "border-rl_accent bg-rl_accent/10 text-rl_text" : "border-rl_border text-rl_muted"
                    }`}
                  >
                    {account.platform} · {account.handle || account.displayName}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <FormField id="camp-notes" label="Anything else? (optional)">
            <textarea id="camp-notes" className={fieldClass} rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </FormField>
          <div className="flex gap-2">
            <button type="button" className="rl-btn" onClick={createFast}>Create campaign</button>
            <button type="button" className="rl-btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </section>
      )}

      <SegmentedControl
        ariaLabel="Campaign filter"
        value={filter}
        onChange={setFilter}
        options={[
          { id: "active", label: "Active" },
          { id: "inactive", label: "Inactive" },
          { id: "all", label: "All" },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          title={filter === "inactive" ? "No inactive campaigns" : "No campaigns"}
          body="Create one to organize strategy and content."
          action={<button type="button" onClick={() => setCreating(true)} className="rl-btn">New campaign</button>}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((campaign) => {
            const linked = (campaign.accountIds || [])
              .map((id) => accounts.find((account) => account.id === id))
              .filter(Boolean);
            const goals = optionLabels(GOAL_OPTIONS, campaign.intake?.goals || []).slice(0, 2).join(" · ");
            const snap = buildCampaignStateSnapshot(campaign, { accounts, content });
            const next = snap.nextActions?.[0];
            const summary = snap.summary
              ? snap.summary.split(/(?<=\.)\s+/).slice(0, 2).join(" ")
              : "";
            return (
              <li key={campaign.id} className="rounded-xl border border-rl_border/80 px-5 py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/campaigns/${campaign.id}`}
                        onClick={() => setActiveCampaignId(campaign.id)}
                        className="text-base font-semibold tracking-tight hover:underline"
                      >
                        {campaign.name}
                      </Link>
                      <StatusBadge label={campaign.active !== false ? "Active" : "Inactive"} />
                      <span className="text-xs text-rl_muted">{snap.progressLabel}</span>
                    </div>
                    <p className="text-sm text-rl_muted">
                      {goals || campaign.objective || campaign.intake?.promoted?.title || "No goal yet"}
                    </p>
                    {linked.length > 0 && (
                      <p className="rl-meta">
                        {linked.map((account) => `${account.platform} · ${account.handle || account.displayName}`).join(" · ")}
                      </p>
                    )}
                    {summary && <p className="max-w-2xl text-sm text-rl_textSecondary">{summary}</p>}
                    {next && (
                      <Link to={next.href || `/campaigns/${campaign.id}`} className="inline-block text-sm text-rl_accent hover:underline">
                        Next: {next.label}
                      </Link>
                    )}
                    <p className="rl-meta">Updated {formatDate(campaign.updatedAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCampaignActive(campaign.id, campaign.active === false)}
                      className="text-xs uppercase tracking-[0.12em] text-rl_muted hover:text-rl_text"
                    >
                      {campaign.active !== false ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(campaign)}
                      className="text-xs uppercase tracking-[0.12em] text-rl_danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete campaign?"
        body="Content stays in the library unless you remove it separately."
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteCampaign(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </PageShell>
  );
}
