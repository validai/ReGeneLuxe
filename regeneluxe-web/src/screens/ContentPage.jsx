import { useMemo, useState } from "react";
import { Link, useAppSearchParams as useSearchParams } from "@/nav";
import PageShell from "../components/app/PageShell.jsx";
import PageHeader from "../components/app/PageHeader.jsx";
import StatusBadge from "../components/app/StatusBadge.jsx";
import SegmentedControl from "../components/app/SegmentedControl.jsx";
import EmptyState from "../components/app/EmptyState.jsx";
import FilterBar from "../components/app/FilterBar.jsx";
import SideSheet from "../components/app/SideSheet.jsx";
import { useAppData } from "../hooks/useAppData.js";
import { PLATFORMS, ASSET_TYPES } from "../data/models.js";
import { emptyContentItem } from "../data/domain.js";
import { saveContent, getContent } from "../data/collectionRepository.js";
import { filterByWorkingAccount } from "../data/workingContext.js";
import { getContentViewMode, setContentViewMode } from "../data/uiPrefs.js";
import { formatStamp } from "../utils/dates.js";
import { useToast } from "../components/app/useToast.js";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "ideas", label: "Ideas" },
  { id: "drafts", label: "Drafts" },
  { id: "READY", label: "Ready" },
  { id: "SCHEDULED", label: "Scheduled" },
  { id: "PUBLISHED", label: "Published" },
  { id: "FAILED", label: "Failed" },
];

const LAYOUT_OPTIONS = [
  { id: "list", label: "List" },
  { id: "grid", label: "Grid" },
];

const VALID = new Set(FILTERS.map((f) => f.id));

function matchesBucket(item, filter) {
  if (filter === "all") return true;
  if (filter === "ideas") return item.status === "IDEA";
  if (filter === "drafts") return item.status === "PLANNED" || item.status === "DRAFTING";
  return item.status === filter;
}

export default function ContentPage() {
  const toast = useToast();
  const { content, campaigns, accounts, workingAccountId } = useAppData();
  const [params, setParams] = useSearchParams();
  const statusParam = params.get("status");
  const filter = VALID.has(statusParam) ? statusParam : "all";
  const [layout, setLayout] = useState(() => getContentViewMode());
  const [query, setQuery] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [platform, setPlatform] = useState("");
  const [format, setFormat] = useState("");
  const [previewId, setPreviewId] = useState(null);

  const scoped = useMemo(
    () => filterByWorkingAccount(content, accounts, workingAccountId),
    [content, accounts, workingAccountId]
  );

  const items = useMemo(() => scoped.filter((item) => {
    if (!matchesBucket(item, filter)) return false;
    if (campaignId && item.campaignId !== campaignId) return false;
    if (format && item.format !== format) return false;
    if (platform) {
      const accountMatch = (item.accountIds || []).some((id) => accounts.find((account) => account.id === id)?.platform === platform);
      const variantMatch = (item.variants || []).some((variant) => variant.platform === platform);
      if (!accountMatch && !variantMatch) return false;
    }
    if (query && !`${item.title} ${item.caption} ${item.concept}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [scoped, filter, campaignId, platform, format, query, accounts]);

  const preview = previewId ? getContent(previewId) || items.find((i) => i.id === previewId) : null;
  const filtersActive = Boolean(query || campaignId || platform || format || (filter !== "all"));

  const onLayoutChange = (next) => {
    setLayout(next);
    setContentViewMode(next);
  };

  const setFilter = (next) => {
    const nextParams = new URLSearchParams(params);
    if (!next || next === "all") nextParams.delete("status");
    else nextParams.set("status", next);
    setParams(nextParams, { replace: true });
  };

  const duplicate = (item) => {
    const copy = emptyContentItem({
      ...item,
      id: undefined,
      title: item.title ? `${item.title} (copy)` : "Untitled (copy)",
      status: "DRAFTING",
      scheduledAt: "",
      publishedAt: "",
    });
    const saved = saveContent(copy);
    toast.push("Draft duplicated");
    setPreviewId(saved.id);
  };

  return (
    <PageShell>
      <PageHeader
        title="Content"
        description="Ideas, drafts, ready, scheduled, published."
        actions={<Link to="/content/new" className="rl-btn">Create</Link>}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedControl
          ariaLabel="Content status"
          options={FILTERS}
          value={filter}
          onChange={setFilter}
        />
        <SegmentedControl
          ariaLabel="Content layout"
          options={LAYOUT_OPTIONS}
          value={layout}
          onChange={onLayoutChange}
        />
      </div>

      <FilterBar
        onClear={filtersActive ? () => {
          setQuery("");
          setCampaignId("");
          setPlatform("");
          setFormat("");
          setFilter("all");
        } : undefined}
      >
        <input className="rl-input min-w-[10rem] flex-1" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="rl-input max-w-[12rem]" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          <option value="">All campaigns</option>
          {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
        </select>
        <select className="rl-input max-w-[10rem]" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="">All platforms</option>
          {PLATFORMS.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <select className="rl-input max-w-[10rem]" value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="">All formats</option>
          {ASSET_TYPES.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </FilterBar>

      {items.length === 0 ? (
        <EmptyState title="No content yet" body="Create a post to get started." action={<Link to="/content/new" className="rl-btn">Create</Link>} />
      ) : layout === "grid" ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setPreviewId(item.id)}
                className="block h-full w-full rounded-xl border border-rl_border bg-rl_surface px-4 py-4 text-left transition-colors duration-rl hover:border-rl_borderStrong"
              >
                <div className="mb-3 flex aspect-[4/3] items-end rounded-lg bg-rl_surfaceSoft p-3">
                  <p className="line-clamp-3 text-xs text-rl_muted">{item.caption || item.concept || "No preview"}</p>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-medium">{item.title || item.caption || "Untitled"}</p>
                  <StatusBadge value={item.status} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-rl_border border-y border-rl_border">
          {items.map((item) => {
            const targets = (item.accountIds || [])
              .map((id) => accounts.find((account) => account.id === id))
              .filter(Boolean)
              .map((account) => `${account.platform} · ${account.handle || account.displayName}`)
              .join(", ");
            return (
              <li key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setPreviewId(item.id)}>
                  <p className="truncate text-sm font-medium">{item.title || "Untitled"}</p>
                  <p className="mt-0.5 text-xs text-rl_muted">
                    {campaigns.find((campaign) => campaign.id === item.campaignId)?.name || "No campaign"}
                    {targets ? ` · ${targets}` : ""}
                    {` · ${item.format || "Post"}`}
                    {item.scheduledAt
                      ? ` · ${formatStamp(item.scheduledAt)}`
                      : item.publishedAt
                        ? ` · ${formatStamp(item.publishedAt)}`
                        : ""}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <StatusBadge value={item.status} />
                  <Link to={`/content/${item.id}`} className="text-xs uppercase tracking-[0.12em] text-rl_muted hover:text-rl_text">Edit</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SideSheet
        open={Boolean(preview)}
        title={preview?.title || "Untitled"}
        subtitle={preview ? `${preview.format || "Post"} · ${preview.status}` : ""}
        onClose={() => setPreviewId(null)}
        footer={preview && (
          <div className="flex flex-wrap gap-2">
            <Link to={`/content/${preview.id}`} className="rl-btn">Edit</Link>
            <button type="button" className="rl-btn-ghost" onClick={() => duplicate(preview)}>Duplicate</button>
            <Link to="/calendar" className="rl-btn-ghost">Calendar</Link>
          </div>
        )}
      >
        {preview && (
          <div className="space-y-4 text-sm">
            <p className="whitespace-pre-wrap text-rl_text">{preview.caption || preview.concept || "No caption yet."}</p>
            <p className="text-xs text-rl_muted">
              {campaigns.find((c) => c.id === preview.campaignId)?.name || "No campaign"}
              {preview.scheduledAt ? ` · ${formatStamp(preview.scheduledAt)}` : ""}
            </p>
          </div>
        )}
      </SideSheet>
    </PageShell>
  );
}
