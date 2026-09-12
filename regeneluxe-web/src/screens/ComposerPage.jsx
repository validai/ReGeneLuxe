import { useMemo, useState } from "react";
import { Link, useAppNavigate as useNavigate, useAppParams as useParams, useAppSearchParams as useSearchParams } from "@/nav";
import PageShell from "../components/app/PageShell.jsx";
import PageHeader from "../components/app/PageHeader.jsx";
import FormField, { fieldClass } from "../components/app/FormField.jsx";
import Tabs from "../components/app/Tabs.jsx";
import { useToast } from "../components/app/useToast.js";
import { useAppData } from "../hooks/useAppData.js";
import { emptyContentItem, emptyVariant } from "../data/domain.js";
import { saveContent, getContent } from "../data/collectionRepository.js";
import { scheduleContent, requestPublish, markPublished } from "../data/publishing.js";
import { ASSET_TYPES } from "../data/models.js";
import { recordEvent } from "../data/events.js";

function shortenCaption(text, max = 120) {
  const trimmed = String(text || "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, Math.max(1, max - 1));
  const boundary = slice.lastIndexOf(" ");
  const cut = boundary > Math.floor(max * 0.4) ? slice.slice(0, boundary) : slice;
  return `${cut.trimEnd()}…`;
}

function firstSentence(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  if (match) return match[1].trim();
  const line = trimmed.split(/\n/)[0] || trimmed;
  return line.trim();
}

function rewriteHookLine(sentence) {
  let line = String(sentence || "").trim();
  line = line.replace(/^(so|well|just|um|okay|ok|hey|hi|hello)[,!.\s]+/i, "").trim();
  if (!line) return "Stop scrolling.";
  line = line.charAt(0).toUpperCase() + line.slice(1);
  line = line.replace(/[.]+$/, "");
  if (!/[!?]$/.test(line) && line.length < 72) {
    if (/^(why|how|what|when|where|who|is|are|do|does|can|should)\b/i.test(line)) {
      line = `${line}?`;
    }
  }
  return line;
}

function buildHookSuggestion(caption) {
  const text = String(caption || "").trim();
  if (!text) return "";
  const first = firstSentence(text);
  const hook = rewriteHookLine(first);
  const rest = text.slice(first.length).replace(/^\s+/, "");
  if (rest) return `${hook}\n\n${rest}`;
  if (hook === first || hook === first.replace(/[.]+$/, "")) {
    return `${hook}\n\n${text}`;
  }
  return hook;
}

function pickCtaLine(caption) {
  const options = [
    "Save this for later.",
    "Follow for more.",
    "Link in bio.",
    "Tell me what you think.",
  ];
  const text = String(caption || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash + text.charCodeAt(i)) % options.length;
  return options[hash] || options[0];
}

function buildCtaSuggestion(caption) {
  const text = String(caption || "").trim();
  const cta = pickCtaLine(text);
  if (!text) return cta;
  if (/(save this for later|follow for more|link in bio|tell me what you think)/i.test(text)) {
    return text;
  }
  return `${text}\n\n${cta}`;
}

function tailorCaptionForPlatform(caption, platform) {
  const text = String(caption || "").trim();
  if (!text) return "";
  const key = String(platform || "").toLowerCase();
  if (key === "youtube") {
    const title = firstSentence(text).replace(/[.!?…]+$/, "").slice(0, 70);
    if (!title) return text;
    if (text.startsWith(title)) return text;
    return `${title}\n\n${text}`;
  }
  if (key === "tiktok") {
    return shortenCaption(text, 100);
  }
  return text;
}

function SuggestionBar({ suggestion, onAccept, onReplace, onUndo, onDismiss }) {
  if (!suggestion) return null;
  const canUndo = Boolean(suggestion.previous != null && suggestion.applied);
  return (
    <div className="rounded-lg border border-rl_border bg-rl_surfaceSoft px-3 py-2.5 text-sm">
      {!suggestion.applied && (
        <p className="whitespace-pre-wrap text-rl_textSecondary">{suggestion.proposed}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {!suggestion.applied && (
          <>
            <button type="button" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rl_accent hover:text-rl_accentHover" onClick={onAccept}>
              Accept
            </button>
            {suggestion.allowReplace && (
              <button type="button" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rl_muted hover:text-rl_text" onClick={onReplace}>
                Replace
              </button>
            )}
            <button type="button" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rl_muted hover:text-rl_text" onClick={onDismiss}>
              Dismiss
            </button>
          </>
        )}
        {canUndo && (
          <button type="button" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rl_muted hover:text-rl_text" onClick={onUndo}>
            Undo
          </button>
        )}
        {suggestion.applied && (
          <span className="text-[11px] text-rl_muted">Applied</span>
        )}
      </div>
    </div>
  );
}

export default function ComposerPage() {
  const { contentId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { accounts, campaigns } = useAppData();
  const existing = contentId ? getContent(contentId) : null;
  const [form, setForm] = useState(() => emptyContentItem(existing || {
    status: "DRAFTING",
    campaignId: params.get("campaignId") || "",
    scheduledAt: params.get("date") ? `${params.get("date")}T12:00` : "",
  }));
  const [message, setMessage] = useState("");
  const [variantTab, setVariantTab] = useState("base");
  const [suggestion, setSuggestion] = useState(null);
  const [pendingVariants, setPendingVariants] = useState({});
  const [mediaDraft, setMediaDraft] = useState("");
  const [mediaDragIndex, setMediaDragIndex] = useState(null);

  const selectedAccounts = useMemo(
    () => accounts.filter((account) => form.accountIds.includes(account.id)),
    [accounts, form.accountIds]
  );

  const variantTabs = useMemo(() => {
    const tabs = [{ id: "base", label: "Base" }];
    selectedAccounts.forEach((account) => {
      const variant = form.variants.find((item) => item.accountId === account.id);
      const customized = Boolean(
        variant
        && String(variant.caption || "").trim()
        && String(variant.caption || "").trim() !== String(form.caption || "").trim()
      );
      tabs.push({
        id: account.id,
        label: customized ? `${account.platform} · customized` : account.platform,
      });
    });
    return tabs;
  }, [selectedAccounts, form.variants, form.caption]);

  const activeVariant = useMemo(() => {
    if (variantTab === "base") return null;
    return form.variants.find((item) => item.accountId === variantTab)
      || emptyVariant({
        accountId: variantTab,
        platform: selectedAccounts.find((account) => account.id === variantTab)?.platform || "",
        caption: form.caption,
        cta: form.cta,
        title: form.title,
      });
  }, [variantTab, form, selectedAccounts]);

  const previewCaption = variantTab === "base"
    ? form.caption
    : (activeVariant?.caption || form.caption);

  const patch = (partial) => setForm((prev) => ({ ...prev, ...partial }));

  const toggleAccount = (id) => {
    const next = new Set(form.accountIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const accountIds = [...next];
    const variants = accountIds.map((accountId) => {
      const current = form.variants.find((item) => item.accountId === accountId);
      const account = accounts.find((item) => item.id === accountId);
      return current || emptyVariant({
        accountId,
        platform: account?.platform || "",
        caption: form.caption,
        cta: form.cta,
        title: form.title,
      });
    });
    patch({ accountIds, variants });
    if (variantTab !== "base" && !accountIds.includes(variantTab)) {
      setVariantTab("base");
    }
  };

  const setVariant = (accountId, key, value) => {
    setForm((prev) => {
      const account = accounts.find((item) => item.id === accountId);
      const exists = prev.variants.some((item) => item.accountId === accountId);
      const variants = exists
        ? prev.variants.map((item) => (item.accountId === accountId ? { ...item, [key]: value } : item))
        : [
          ...prev.variants,
          emptyVariant({
            accountId,
            platform: account?.platform || "",
            caption: prev.caption,
            cta: prev.cta,
            title: prev.title,
            [key]: value,
          }),
        ];
      return { ...prev, variants };
    });
  };

  const persist = (next = form) => {
    const isNew = !getContent(next.id);
    const saved = saveContent(next);
    setForm(saved);
    setMessage("Saved.");
    recordEvent(isNew ? "CONTENT_CREATED" : "CONTENT_CHANGED", {
      campaignId: saved.campaignId,
      contentId: saved.id,
      message: `${isNew ? "Created" : "Updated"} “${saved.title || "untitled"}”`,
    });
    return saved;
  };

  const proposeCaption = (proposed, { allowReplace = false, kind = "edit" } = {}) => {
    if (!proposed || proposed === form.caption) {
      toast.push(kind === "shorten" ? "Already short enough." : "Nothing to suggest.");
      return;
    }
    setSuggestion({
      previous: form.caption,
      proposed,
      allowReplace,
      applied: false,
      kind,
    });
  };

  const acceptSuggestion = () => {
    if (!suggestion?.proposed) return;
    patch({
      caption: suggestion.proposed,
      title: form.title || suggestion.proposed.slice(0, 48),
    });
    setSuggestion((prev) => (prev ? { ...prev, applied: true } : null));
  };

  const replaceWithSuggestion = () => {
    if (!suggestion?.proposed) return;
    const hookOnly = rewriteHookLine(firstSentence(suggestion.proposed));
    patch({
      caption: hookOnly,
      hook: hookOnly,
      title: form.title || hookOnly.slice(0, 48),
    });
    setSuggestion((prev) => (prev ? { ...prev, previous: form.caption, proposed: hookOnly, applied: true } : null));
  };

  const undoSuggestion = () => {
    if (!suggestion || suggestion.previous == null) return;
    patch({ caption: suggestion.previous });
    setSuggestion(null);
  };

  const adaptForPlatforms = () => {
    if (selectedAccounts.length < 2) {
      toast.push("Select more than one account first.");
      return;
    }
    if (!form.caption?.trim()) {
      toast.push("Write a caption first.");
      return;
    }
    let filled = 0;
    const pending = {};
    const variants = selectedAccounts.map((account) => {
      const current = form.variants.find((item) => item.accountId === account.id)
        || emptyVariant({ accountId: account.id, platform: account.platform });
      const tailored = tailorCaptionForPlatform(form.caption, account.platform);
      const empty = !String(current.caption || "").trim();
      if (empty) {
        filled += 1;
        return { ...current, caption: tailored, platform: account.platform || current.platform };
      }
      if (String(current.caption || "").trim() !== tailored) {
        pending[account.id] = tailored;
      }
      return current;
    });
    patch({ variants });
    setPendingVariants(pending);
    setVariantTab(selectedAccounts[0]?.id || "base");
    const pendingCount = Object.keys(pending).length;
    if (filled && pendingCount) {
      toast.push(`Filled ${filled} empty · ${pendingCount} need accept.`);
    } else if (filled) {
      toast.push(`Adapted ${filled} empty variant${filled === 1 ? "" : "s"}.`);
    } else if (pendingCount) {
      toast.push(`${pendingCount} customized — accept to replace.`);
    } else {
      toast.push("Variants already match.");
    }
  };

  const addMediaNote = (raw) => {
    const value = String(raw || "").trim();
    if (!value) return;
    if (form.mediaRefs.includes(value)) {
      toast.push("Already added.");
      return;
    }
    patch({ mediaRefs: [...form.mediaRefs, value] });
    setMediaDraft("");
  };

  const removeMediaNote = (index) => {
    patch({ mediaRefs: form.mediaRefs.filter((_, i) => i !== index) });
  };

  const moveMediaNote = (from, to) => {
    if (to < 0 || to >= form.mediaRefs.length || from === to) return;
    const next = [...form.mediaRefs];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    patch({ mediaRefs: next });
  };

  const scheduleLabel = form.scheduledAt
    ? form.status === "SCHEDULED"
      ? `Scheduled · ${form.scheduledAt.replace("T", " ")}`
      : `Set · ${form.scheduledAt.replace("T", " ")}`
    : "Not scheduled";

  return (
    <PageShell width="composer">
      <PageHeader
        title={existing ? "Edit post" : "Create"}
        description="Accounts, content, then publish."
        actions={<Link to="/content" className="rl-btn-ghost">Library</Link>}
      />

      <form
        className="pb-28"
        onSubmit={(event) => {
          event.preventDefault();
          const saved = persist({ ...form, status: form.status === "IDEA" ? "DRAFTING" : form.status });
          if (!contentId) navigate(`/content/${saved.id}`, { replace: true });
        }}
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div className="space-y-10 min-w-0">
            <section className="space-y-4">
              <h2 className="rl-label">Accounts</h2>
              {accounts.length === 0 ? (
                <p className="text-sm text-rl_muted">
                  Add an account first. <Link to="/accounts" className="underline underline-offset-4">Open accounts</Link>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {accounts.map((account) => {
                    const active = form.accountIds.includes(account.id);
                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => toggleAccount(account.id)}
                        aria-pressed={active}
                        className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                          active
                            ? "border-rl_accent bg-rl_accent/10 text-rl_text"
                            : "border-rl_border text-rl_muted hover:border-rl_borderStrong hover:text-rl_text"
                        }`}
                      >
                        {account.platform}
                        <span className="ml-1.5 text-rl_muted">{account.handle || account.displayName}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="rl-label">Content</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rl_muted hover:text-rl_text"
                    onClick={() => {
                      if (!form.caption?.trim()) {
                        toast.push("Write a caption first.");
                        return;
                      }
                      proposeCaption(shortenCaption(form.caption), { kind: "shorten" });
                    }}
                  >
                    Shorten
                  </button>
                  <button
                    type="button"
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rl_muted hover:text-rl_text"
                    onClick={() => {
                      if (!form.caption?.trim()) {
                        toast.push("Write a caption first.");
                        return;
                      }
                      proposeCaption(buildHookSuggestion(form.caption), { allowReplace: true, kind: "hook" });
                    }}
                  >
                    Improve hook
                  </button>
                  <button
                    type="button"
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rl_muted hover:text-rl_text"
                    onClick={() => proposeCaption(buildCtaSuggestion(form.caption), { kind: "cta" })}
                  >
                    Suggest CTA
                  </button>
                  <button
                    type="button"
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rl_muted hover:text-rl_text"
                    onClick={adaptForPlatforms}
                  >
                    Adapt for platforms
                  </button>
                </div>
              </div>

              {selectedAccounts.length > 1 && (
                <Tabs
                  tabs={variantTabs}
                  value={variantTabs.some((tab) => tab.id === variantTab) ? variantTab : "base"}
                  onChange={setVariantTab}
                />
              )}

              {variantTab === "base" ? (
                <>
                  <FormField id="caption" label="Caption">
                    <textarea
                      id="caption"
                      className={fieldClass}
                      rows={6}
                      placeholder="Write the post…"
                      value={form.caption}
                      onChange={(e) => {
                        setSuggestion(null);
                        patch({ caption: e.target.value, title: form.title || e.target.value.slice(0, 48) });
                      }}
                    />
                  </FormField>
                  <SuggestionBar
                    suggestion={suggestion}
                    onAccept={acceptSuggestion}
                    onReplace={replaceWithSuggestion}
                    onUndo={undoSuggestion}
                    onDismiss={() => setSuggestion(null)}
                  />
                </>
              ) : (
                <div className="space-y-3">
                  <FormField id={`variant-caption-${variantTab}`} label="Platform caption">
                    <textarea
                      id={`variant-caption-${variantTab}`}
                      className={fieldClass}
                      rows={5}
                      placeholder="Platform caption"
                      value={activeVariant?.caption || ""}
                      onChange={(e) => setVariant(variantTab, "caption", e.target.value)}
                    />
                  </FormField>
                  {pendingVariants[variantTab] && (
                    <div className="rounded-lg border border-rl_border bg-rl_surfaceSoft px-3 py-2.5 text-sm">
                      <p className="rl-label mb-1">Suggested adapt</p>
                      <p className="whitespace-pre-wrap text-rl_textSecondary">{pendingVariants[variantTab]}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rl_accent hover:text-rl_accentHover"
                          onClick={() => {
                            setVariant(variantTab, "caption", pendingVariants[variantTab]);
                            setPendingVariants((prev) => {
                              const next = { ...prev };
                              delete next[variantTab];
                              return next;
                            });
                          }}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rl_muted hover:text-rl_text"
                          onClick={() => {
                            setPendingVariants((prev) => {
                              const next = { ...prev };
                              delete next[variantTab];
                              return next;
                            });
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                  <FormField id={`variant-tags-${variantTab}`} label="Hashtags">
                    <input
                      id={`variant-tags-${variantTab}`}
                      className={fieldClass}
                      placeholder="Hashtags"
                      value={(activeVariant?.hashtags || []).join(" ")}
                      onChange={(e) => setVariant(variantTab, "hashtags", e.target.value.split(/\s+/).filter(Boolean))}
                    />
                  </FormField>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <FormField id="format" label="Format">
                  <select id="format" className={fieldClass} value={form.format} onChange={(e) => patch({ format: e.target.value })}>
                    <option value="">Select</option>
                    {ASSET_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </FormField>
                <FormField id="title" label="Title">
                  <input id="title" className={fieldClass} value={form.title} onChange={(e) => patch({ title: e.target.value })} />
                </FormField>
              </div>

              <FormField id="media" label="Media notes / links" hint="URLs or production notes — not file upload.">
                <div
                  className="rounded-lg border border-dashed border-rl_border bg-rl_surfaceSoft/40 px-3 py-3"
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const uri = event.dataTransfer.getData("text/uri-list")?.split("\n").find((line) => line && !line.startsWith("#"));
                    const text = uri || event.dataTransfer.getData("text/plain");
                    if (text?.trim()) addMediaNote(text.trim());
                  }}
                >
                  {form.mediaRefs.length === 0 ? (
                    <p className="text-sm text-rl_muted">Drop a link, or add a note below.</p>
                  ) : (
                    <ul className="space-y-2">
                      {form.mediaRefs.map((ref, index) => (
                        <li
                          key={`${ref}-${index}`}
                          draggable
                          onDragStart={() => setMediaDragIndex(index)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (mediaDragIndex == null) return;
                            moveMediaNote(mediaDragIndex, index);
                            setMediaDragIndex(null);
                          }}
                          onDragEnd={() => setMediaDragIndex(null)}
                          className="flex items-center gap-2 rounded-md border border-rl_border bg-rl_bg px-2.5 py-1.5 text-sm"
                        >
                          <span className="cursor-grab text-rl_muted" title="Drag to reorder">⋮⋮</span>
                          <span className="min-w-0 flex-1 truncate text-rl_text">{ref}</span>
                          <button
                            type="button"
                            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rl_muted hover:text-rl_danger"
                            onClick={() => removeMediaNote(index)}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex gap-2">
                    <input
                      id="media"
                      className={fieldClass}
                      placeholder="https://… or note"
                      value={mediaDraft}
                      onChange={(e) => setMediaDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addMediaNote(mediaDraft);
                        }
                      }}
                    />
                    <button type="button" className="rl-btn-ghost shrink-0" onClick={() => addMediaNote(mediaDraft)}>
                      Add
                    </button>
                  </div>
                </div>
              </FormField>

              <FormField id="campaign" label="Campaign">
                <select
                  id="campaign"
                  className={fieldClass}
                  value={form.campaignId}
                  onChange={(e) => patch({ campaignId: e.target.value })}
                >
                  <option value="">None</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </FormField>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField id="hook" label="Hook">
                  <input id="hook" className={fieldClass} value={form.hook} onChange={(e) => patch({ hook: e.target.value })} />
                </FormField>
                <FormField id="cta" label="CTA">
                  <input id="cta" className={fieldClass} value={form.cta} onChange={(e) => patch({ cta: e.target.value })} />
                </FormField>
              </div>
              <FormField id="concept" label="Concept note">
                <input id="concept" className={fieldClass} value={form.concept} onChange={(e) => patch({ concept: e.target.value })} />
              </FormField>
            </section>

            <section className="space-y-4">
              <h2 className="rl-label">Publish</h2>
              <FormField id="when" label="Schedule">
                <input
                  id="when"
                  type="datetime-local"
                  className={fieldClass}
                  value={form.scheduledAt}
                  onChange={(e) => patch({ scheduledAt: e.target.value })}
                />
              </FormField>
              {message && <p className="text-sm text-rl_muted">{message}</p>}
            </section>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-4 rounded-xl border border-rl_border bg-rl_surface p-4">
              <p className="rl-label">Preview</p>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-rl_muted">Accounts</p>
                {selectedAccounts.length === 0 ? (
                  <p className="mt-2 text-sm text-rl_muted">None selected</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {selectedAccounts.map((account) => (
                      <li key={account.id} className="text-sm text-rl_text">
                        {account.platform}
                        <span className="ml-1.5 text-rl_muted">{account.handle || account.displayName}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-rl_muted">Caption</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-rl_textSecondary">
                  {previewCaption?.trim() || "Nothing written yet."}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-rl_muted">Schedule</p>
                <p className="mt-2 text-sm text-rl_text">{scheduleLabel}</p>
              </div>
              {form.mediaRefs.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-rl_muted">Media notes</p>
                  <p className="mt-2 text-sm text-rl_muted">{form.mediaRefs.length} linked</p>
                </div>
              )}
            </div>
          </aside>
        </div>

        <div className="sticky bottom-0 z-10 -mx-4 border-t border-rl_border bg-rl_bg/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="rl-btn">Save draft</button>
            <button
              type="button"
              className="rl-btn-ghost"
              onClick={() => {
                if (!form.scheduledAt) {
                  setMessage("Pick a time first.");
                  return;
                }
                persist(scheduleContent(form, form.scheduledAt));
                setMessage("Scheduled.");
              }}
            >
              Schedule
            </button>
            <button
              type="button"
              className="rl-btn-ghost"
              onClick={() => {
                const account = selectedAccounts[0];
                const result = requestPublish(form, account);
                setMessage(result.error || (result.pendingApproval ? "Ready for approval." : "Saved."));
                if (result.content) setForm(result.content);
              }}
            >
              Publish
            </button>
            <button
              type="button"
              className="rl-btn-ghost"
              onClick={() => {
                persist(markPublished(form));
                setMessage("Marked published (manual).");
              }}
            >
              Mark published
            </button>
          </div>
        </div>
      </form>
    </PageShell>
  );
}
