import { useMemo, useState } from "react";
import { Link, useAppSearchParams as useSearchParams } from "@/nav";
import PageShell from "../components/app/PageShell.jsx";
import PageHeader from "../components/app/PageHeader.jsx";
import SegmentedControl from "../components/app/SegmentedControl.jsx";
import CalendarBoard from "../components/calendar/CalendarBoard.jsx";
import { useAppData } from "../hooks/useAppData.js";
import { CONTENT_STATUS_LABELS } from "../data/domain.js";
import { PLATFORMS } from "../data/models.js";
import { filterByWorkingAccount } from "../data/workingContext.js";
import { getCalendarViewMode, setCalendarViewMode } from "../data/uiPrefs.js";

const SIMPLE_STATUSES = [
  ["DRAFTING", "Draft"],
  ["READY", "Ready"],
  ["SCHEDULED", "Scheduled"],
  ["PUBLISHED", "Published"],
  ["FAILED", "Failed"],
];

const VIEW_OPTIONS = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "list", label: "List" },
];

function resolveView(raw) {
  return ["month", "week", "list"].includes(raw) ? raw : null;
}

export default function CalendarPage() {
  const { content, accounts, campaigns, workingAccountId } = useAppData();
  const [params, setParams] = useSearchParams();
  const [campaignId, setCampaignId] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState("");

  const view = resolveView(params.get("view")) || getCalendarViewMode();

  const scoped = useMemo(
    () => filterByWorkingAccount(content, accounts, workingAccountId),
    [content, accounts, workingAccountId]
  );

  const items = useMemo(() => scoped.filter((item) => {
    if (campaignId && item.campaignId !== campaignId) return false;
    if (status === "DRAFTING") {
      if (!["PLANNED", "DRAFTING", "IDEA"].includes(item.status)) return false;
    } else if (status && item.status !== status) return false;
    if (platform) {
      const accountMatch = (item.accountIds || []).some((id) => accounts.find((account) => account.id === id)?.platform === platform);
      const variantMatch = (item.variants || []).some((variant) => variant.platform === platform);
      if (!accountMatch && !variantMatch) return false;
    }
    return Boolean(item.scheduledAt || item.publishedAt || item.status === "READY");
  }), [scoped, campaignId, platform, status, accounts]);

  const onViewChange = (next) => {
    const resolved = resolveView(next) || "month";
    setCalendarViewMode(resolved);
    setParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      if (nextParams.get("view") === resolved) return prev;
      nextParams.set("view", resolved);
      return nextParams;
    }, { replace: true });
  };

  return (
    <PageShell>
      <PageHeader
        title="Calendar"
        description="What is going out, where, and when."
        actions={<Link to="/content/new" className="rl-btn">Create</Link>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <SegmentedControl
          ariaLabel="Calendar view"
          options={VIEW_OPTIONS}
          value={view}
          onChange={onViewChange}
        />
        <div className="flex flex-wrap gap-2">
          <select className="rl-input max-w-[11rem] py-1.5 text-xs" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">All campaigns</option>
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </select>
          <select className="rl-input max-w-[9rem] py-1.5 text-xs" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">All platforms</option>
            {PLATFORMS.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
          <select className="rl-input max-w-[9rem] py-1.5 text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All states</option>
            {SIMPLE_STATUSES.map(([id, label]) => (
              <option key={id} value={id}>{label || CONTENT_STATUS_LABELS[id]}</option>
            ))}
          </select>
        </div>
      </div>

      <CalendarBoard view={view} items={items} accounts={accounts} campaigns={campaigns} />
    </PageShell>
  );
}
