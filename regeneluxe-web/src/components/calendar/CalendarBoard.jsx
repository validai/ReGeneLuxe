import { useMemo, useState } from "react";
import { Link, useAppNavigate as useNavigate } from "@/nav";
import SideSheet from "../app/SideSheet.jsx";
import StatusBadge from "../app/StatusBadge.jsx";
import AccountBadge from "../app/AccountBadge.jsx";
import FormField, { fieldClass } from "../app/FormField.jsx";
import { useToast } from "../app/useToast.js";
import { emptyContentItem } from "../../data/domain.js";
import { saveContent, getContent } from "../../data/collectionRepository.js";
import { recordEvent } from "../../data/events.js";
import { addDays, formatStamp, startOfMonth, toDateKey } from "../../utils/dates.js";

const PLATFORM_ABBR = {
  Instagram: "IG",
  YouTube: "YT",
  TikTok: "TT",
  X: "X",
  Threads: "TH",
  Facebook: "FB",
  SoundCloud: "SC",
  LinkedIn: "LI",
  Other: "·",
};

function platformAbbr(platform) {
  if (!platform) return "·";
  return PLATFORM_ABBR[platform] || String(platform).slice(0, 2).toUpperCase();
}

function formatTimeOfDay(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  const match = String(value).match(/T(\d{1,2}:\d{2})/);
  return match ? match[1] : "";
}

function extractTimePart(value) {
  if (!value) return "12:00";
  const match = String(value).match(/T(\d{2}:\d{2}(?::\d{2})?)/);
  if (match) return match[1].slice(0, 5);
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  return "12:00";
}

function toDatetimeLocalValue(value) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw.slice(0, 16);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function primaryAccount(item, accounts) {
  const id = (item.accountIds || [])[0];
  if (!id) return null;
  return accounts.find((account) => account.id === id) || null;
}

function moveScheduledAt(item, dateKey) {
  const source = item.scheduledAt || item.publishedAt || `${dateKey}T12:00`;
  const time = extractTimePart(source);
  return `${dateKey}T${time}`;
}

function CalendarItemCard({ item, accounts, onOpen, draggable = false }) {
  const account = primaryAccount(item, accounts);
  const time = formatTimeOfDay(item.scheduledAt || item.publishedAt);
  const title = item.title || "Untitled";

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return;
        event.dataTransfer.setData("text/content-id", item.id);
        event.dataTransfer.setData("text/plain", item.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(item.id)}
      className="block w-full rounded px-1 py-1 text-left hover:bg-rl_surfaceSoft"
      title={title}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="min-w-0 truncate text-[11px] font-medium text-rl_text">{title}</p>
        {time && <span className="shrink-0 text-[10px] tabular-nums text-rl_muted">{time}</span>}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-rl_muted">
          {platformAbbr(account?.platform || item.variants?.[0]?.platform)}
        </span>
        {account && (
          <span className="truncate text-[10px] text-rl_muted">
            {account.handle || account.displayName}
          </span>
        )}
        <span className="scale-90 origin-left">
          <StatusBadge value={item.status} />
        </span>
      </div>
    </button>
  );
}

export default function CalendarBoard({ items, accounts, campaigns, view = "month" }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [cursor, setCursor] = useState(() => new Date());
  const [previewId, setPreviewId] = useState(null);
  const [rescheduleDraft, setRescheduleDraft] = useState({ id: null, value: "" });
  const [dropTarget, setDropTarget] = useState(null);
  const mode = view === "week" || view === "list" || view === "month" ? view : "month";

  const days = useMemo(() => {
    if (mode === "week") {
      const start = addDays(cursor, -cursor.getDay());
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }
    const start = startOfMonth(cursor);
    const pad = start.getDay();
    const origin = addDays(start, -pad);
    return Array.from({ length: 42 }, (_, index) => addDays(origin, index));
  }, [cursor, mode]);

  const byDay = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      const key = toDateKey(item.scheduledAt || item.publishedAt);
      if (!key) return;
      map[key] = map[key] || [];
      map[key].push(item);
    });
    return map;
  }, [items]);

  const preview = items.find((item) => item.id === previewId) || (previewId ? getContent(previewId) : null);
  const previewCampaign = preview ? campaigns.find((entry) => entry.id === preview.campaignId) : null;
  const rescheduleValue = preview && rescheduleDraft.id === preview.id
    ? rescheduleDraft.value
    : toDatetimeLocalValue(preview?.scheduledAt || preview?.publishedAt || "");

  const openPreview = (id) => {
    const item = items.find((entry) => entry.id === id) || getContent(id);
    setPreviewId(id);
    setRescheduleDraft({
      id,
      value: toDatetimeLocalValue(item?.scheduledAt || item?.publishedAt || ""),
    });
  };

  const persistMove = (item, scheduledAt, { toastMessage } = {}) => {
    const nextStatus = item.status === "PUBLISHED" || item.status === "FAILED"
      ? item.status
      : "SCHEDULED";
    const saved = saveContent({
      ...item,
      scheduledAt,
      status: nextStatus,
    });
    recordEvent("CONTENT_CHANGED", {
      campaignId: saved.campaignId,
      contentId: saved.id,
      message: `Rescheduled “${saved.title || "untitled"}”`,
    });
    if (toastMessage) toast.push(toastMessage);
    return saved;
  };

  const duplicatePreview = () => {
    if (!preview) return;
    const clone = emptyContentItem({
      ...preview,
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      title: preview.title ? `${preview.title} (copy)` : "Untitled copy",
      status: "DRAFTING",
      publishedAt: "",
      providerPostIds: {},
      parentId: preview.id,
      variants: (preview.variants || []).map((variant) => ({
        ...variant,
        id: undefined,
      })),
    });
    const saved = saveContent(clone);
    recordEvent("CONTENT_CREATED", {
      campaignId: saved.campaignId,
      contentId: saved.id,
      message: `Duplicated “${preview.title || "untitled"}”`,
    });
    toast.push("Duplicated.");
    setPreviewId(null);
    setRescheduleDraft({ id: null, value: "" });
    navigate(`/content/${saved.id}`);
  };

  const applyReschedule = () => {
    if (!preview) return;
    if (!rescheduleValue) {
      toast.push("Pick a date and time.");
      return;
    }
    const saved = persistMove(preview, rescheduleValue, { toastMessage: "Rescheduled." });
    setRescheduleDraft({ id: saved.id, value: toDatetimeLocalValue(saved.scheduledAt) });
  };

  const onDropOnDay = (event, dateKey) => {
    event.preventDefault();
    setDropTarget(null);
    const id = event.dataTransfer.getData("text/content-id") || event.dataTransfer.getData("text/plain");
    if (!id) return;
    const item = items.find((entry) => entry.id === id) || getContent(id);
    if (!item) return;
    const nextAt = moveScheduledAt(item, dateKey);
    if (toDateKey(item.scheduledAt || item.publishedAt) === dateKey) return;
    persistMove(item, nextAt, { toastMessage: `Moved to ${dateKey}` });
  };

  const openCreate = (dateKey) => {
    navigate(`/content/new?date=${dateKey}`);
  };

  const sheet = (
    <SideSheet
      open={Boolean(preview)}
      title={preview?.title || "Untitled"}
      subtitle={preview ? formatStamp(preview.scheduledAt || preview.publishedAt) : ""}
      onClose={() => {
        setPreviewId(null);
        setRescheduleDraft({ id: null, value: "" });
      }}
      footer={preview ? (
        <div className="flex flex-wrap gap-2">
          <Link to={`/content/${preview.id}`} className="rl-btn">Edit</Link>
          <button type="button" className="rl-btn-ghost" onClick={duplicatePreview}>Duplicate</button>
          <button
            type="button"
            className="rl-btn-ghost"
            onClick={() => {
              setPreviewId(null);
              setRescheduleDraft({ id: null, value: "" });
            }}
          >
            Close
          </button>
        </div>
      ) : null}
    >
      {preview && (
        <div className="space-y-4 text-sm">
          <div>
            <p className="rl-label">Status</p>
            <div className="mt-2">
              <StatusBadge value={preview.status} />
            </div>
          </div>
          <div>
            <p className="rl-label">Accounts</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(preview.accountIds || []).length === 0 ? (
                <p className="text-rl_muted">No accounts</p>
              ) : (
                (preview.accountIds || []).map((id) => (
                  <AccountBadge key={id} accountId={id} accounts={accounts} />
                ))
              )}
            </div>
          </div>
          <div>
            <p className="rl-label">Campaign</p>
            <p className="mt-2 text-rl_text">{previewCampaign?.name || "No campaign"}</p>
          </div>
          <div>
            <p className="rl-label">Scheduled</p>
            <p className="mt-2 text-rl_text">
              {preview.scheduledAt || preview.publishedAt
                ? formatStamp(preview.scheduledAt || preview.publishedAt)
                : "Not scheduled"}
            </p>
          </div>
          <FormField id="calendar-reschedule" label="Reschedule" hint="Updates schedule time and saves.">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="calendar-reschedule"
                type="datetime-local"
                className={fieldClass}
                value={rescheduleValue}
                onChange={(e) => setRescheduleDraft({ id: preview.id, value: e.target.value })}
              />
              <button type="button" className="rl-btn-ghost shrink-0" onClick={applyReschedule}>
                Save time
              </button>
            </div>
          </FormField>
        </div>
      )}
    </SideSheet>
  );

  if (mode === "list") {
    return (
      <div className="space-y-3">
        <ul className="divide-y divide-rl_border border-y border-rl_border">
          {items.length === 0 && <li className="py-6 text-sm text-rl_muted">Nothing scheduled.</li>}
          {items.map((item) => {
            const account = primaryAccount(item, accounts);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openPreview(item.id)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left hover:opacity-90"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title || "Untitled"}</p>
                    <p className="mt-0.5 text-xs text-rl_muted">
                      {platformAbbr(account?.platform)}
                      {account ? ` · ${account.handle || account.displayName}` : ""}
                      {" · "}
                      {formatStamp(item.scheduledAt || item.publishedAt)}
                    </p>
                  </div>
                  <StatusBadge value={item.status} />
                </button>
              </li>
            );
          })}
        </ul>
        {sheet}
      </div>
    );
  }

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const step = mode === "week" ? 7 : 30;
  const cellMin = mode === "week" ? "min-h-36" : "min-h-24";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button type="button" className="rl-btn-ghost px-2.5 py-1.5" onClick={() => setCursor(addDays(cursor, -step))}>
            Prev
          </button>
          <button type="button" className="rl-btn-ghost px-2.5 py-1.5" onClick={() => setCursor(new Date())}>
            Today
          </button>
          <button type="button" className="rl-btn-ghost px-2.5 py-1.5" onClick={() => setCursor(addDays(cursor, step))}>
            Next
          </button>
        </div>
        <p className="text-sm text-rl_muted">{monthLabel}</p>
      </div>

      <div className="grid grid-cols-7 gap-px border-y border-rl_border bg-rl_border">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <div key={label} className="bg-rl_bg px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-rl_muted">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const key = toDateKey(day);
          const dayItems = byDay[key] || [];
          const inMonth = mode === "week" || day.getMonth() === cursor.getMonth();
          const isDrop = dropTarget === key;
          return (
            <div
              key={key}
              className={`${cellMin} bg-rl_bg p-1.5 transition-colors ${inMonth ? "" : "opacity-40"} ${isDrop ? "bg-rl_accent/10" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (dropTarget !== key) setDropTarget(key);
              }}
              onDragLeave={() => {
                if (dropTarget === key) setDropTarget(null);
              }}
              onDrop={(event) => onDropOnDay(event, key)}
            >
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  className="text-[11px] tabular-nums text-rl_muted hover:text-rl_accent"
                  onClick={() => openCreate(key)}
                  title={`Create on ${key}`}
                >
                  {day.getDate()}
                </button>
                <button
                  type="button"
                  className="text-[11px] text-rl_muted hover:text-rl_accent"
                  onClick={() => openCreate(key)}
                  title={`Create on ${key}`}
                >
                  +
                </button>
              </div>
              <ul className="mt-1 space-y-0.5">
                {dayItems.map((item) => (
                  <li key={item.id}>
                    <CalendarItemCard
                      item={item}
                      accounts={accounts}
                      onOpen={openPreview}
                      draggable
                    />
                  </li>
                ))}
              </ul>
              {/* Empty cell hit target — month and week both create with date */}
              {dayItems.length === 0 && (
                <button
                  type="button"
                  className="mt-1 block h-full min-h-8 w-full rounded text-left"
                  onClick={() => openCreate(key)}
                  aria-label={`Create on ${key}`}
                />
              )}
            </div>
          );
        })}
      </div>
      {sheet}
    </div>
  );
}
