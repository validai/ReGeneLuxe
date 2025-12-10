// FILE: src/pages/Start.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { Auth } from "../utils/auth";
import { Onboarding } from "../utils/onboarding";
import { Analytics } from "../utils/analytics";
import { Drafts } from "../utils/drafts";
import TermsModal from "../components/TermsModal";

// -----------------------------
// Static configuration
// -----------------------------
// PLATFORM_CHOICES is used in the "Primary channel" step to power the
// pill-style multi-select + "Other" free-text input.
// Keeping this centralized makes it easy to expand supported platforms later.
const PLATFORM_CHOICES = [
  "Instagram",
  "Facebook",
  "TikTok",
  "YouTube",
  "X / Twitter",
  "LinkedIn",
  "Google Search",
  "Google Ads",
  "YouTube Ads",
  "Podcast",
  "Friend / Referral",
  "Email Newsletter",
  "Blog Article",
  "Reddit",
  "Discord",
  "Slack Community",
  "Product Hunt",
  "Indie Hackers",
  "Online Course",
  "Conference / Event",
  "Webinar",
  "TikTok Ads",
  "Instagram Ads",
  "LinkedIn Ads",
  "Affiliate Partner",
  "Other",
];

// -----------------------------
// Multi-step wizard schema
// -----------------------------
// Each `step` entry defines the fields rendered on that page of the
// onboarding flow. Validation is *step-local* (we only validate the
// currently visible fields), which keeps the UX focused and avoids
// blocking users on unrelated questions.
const steps = [
  {
    key: "identity",
    title: "You & your brand",
    fields: [
      {
        key: "fullName",
        label: "Full name",
        type: "text",
        required: true,
        ph: "First Last",
        help: "Who our team will speak with.",
      },
      {
        key: "workEmail",
        label: "Work email",
        type: "email",
        required: true,
        ph: "you@brand.com",
        help: "Confirmation + follow-ups.",
      },
      {
        key: "company",
        label: "Company / Brand",
        type: "text",
        required: true,
        ph: "ReGeneLuxe Labs",
      },
      {
        key: "website",
        label: "Website or social",
        type: "text",
        required: false,
        ph: "https://...",
      },
    ],
  },
  {
    key: "project",
    title: "What are we launching?",
    fields: [
      {
        key: "campaignName",
        label: "Campaign name",
        type: "text",
        required: true,
        ph: 'Spring "Glow Serum"',
      },
      {
        key: "offer",
        label: "Offer / Product",
        type: "textarea",
        required: true,
        ph: "What it is + key benefit.",
      },
      {
        key: "objective",
        label: "Primary objective",
        type: "text",
        required: true,
        ph: "Sales / Leads / Waitlist / Installs / Awareness",
      },
    ],
  },
  {
    key: "audience",
    title: "Who is this for?",
    fields: [
      {
        key: "idealCustomer",
        label: "Ideal customer",
        type: "textarea",
        required: true,
        ph: "Age, interests, problems, jobs, locations",
      },
      {
        key: "geo",
        label: "Target locations",
        type: "text",
        required: false,
        ph: "Cities, regions, or Worldwide",
      },
      {
        key: "channels",
        label: "Primary channels",
        type: "checkboxes", // rendered as dropdown+Add+pills UI
        required: true,
        help: "Pick at least one source. This helps us understand where founders discover ReGeneLuxe.",
      },
    ],
  },
  {
    key: "constraints",
    title: "Budget, timing, proof",
    fields: [
      {
        key: "budget",
        label: "Budget (range/month)",
        type: "text",
        required: true,
        ph: "$1k–$5k / $5k–$20k",
      },
      {
        key: "timeline",
        label: "Timeline",
        type: "text",
        required: true,
        ph: "ASAP / 2 weeks / 30 days / planning",
      },
      {
        key: "caseProof",
        label: "Proof you're real",
        type: "textarea",
        required: true,
        ph: "1–2 links (site, LinkedIn, product page, press, etc.)",
      },
    ],
  },
  {
    key: "consent",
    title: "Confirm & consent",
    fields: [
      {
        key: "age16",
        label: "I confirm I am 16+.",
        type: "checkbox",
        required: true,
      },
      {
        key: "terms",
        label: "I agree to the Terms & Privacy.",
        type: "checkbox",
        required: true,
      },
      {
        key: "marketing",
        label: "Email me updates (optional).",
        type: "checkbox",
        required: false,
      },
      {
        key: "heardAbout",
        label: "How did you hear about us?",
        type: "textarea",
        required: false,
        ph: "Quick note: podcast, friend, Twitter thread, newsletter, etc.",
      },
    ],
  },
];

// -----------------------------
// Start
// -----------------------------
// Main onboarding wizard entry point.
//
// Responsibilities:
// - Enforce that users land here intentionally (from Home/Login/Dashboard).
// - Restore any saved in-progress draft from localStorage (via Drafts).
// - Track the current step in the 4-step flow.
// - Validate the *current* step before moving forward.
// - Soft-register the user (Auth.signIn) on submit if they are not yet authed.
// - Mark onboarding complete (Onboarding.complete) and send them to /thank-you.
// - Keep everything analytics-friendly with granular event logging.
export default function Start() {
  console.log("[Start] mounted");
  const navigate = useNavigate();
  const authed = Auth.isSignedIn();

  const [step, setStep] = useState(0);

  // Single object for all form fields across steps.
  // This keeps autosave, validation, and Analytics payloads simple:
  // - Drafts.save() always gets the same shape.
  // - validateStep() can look at a stable `form` snapshot per step.
  const [form, setForm] = useState({
    fullName: "",
    workEmail: Auth.user() || "",
    company: "",
    website: "",
    campaignName: "",
    offer: "",
    objective: "",
    idealCustomer: "",
    geo: "",
    channels: new Set(),
    budget: "",
    timeline: "",
    caseProof: "",
    age16: false,
    terms: false,
    marketing: false,
    heardAbout: "",
  });
  const [err, setErr] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState("");

  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [customPlatform, setCustomPlatform] = useState("");
  const [showTerms, setShowTerms] = useState(false);

  // Draft restore on mount
  // ----------------------
  // If the user has a saved onboarding draft in localStorage, we restore it
  // *only* when the stored email matches the current user (or the typed
  // workEmail). This prevents cross-account leakage when multiple brands
  // use the same browser.
  useEffect(() => {
    try {
      const draft = Drafts.load();
      if (!draft) return;

      const storedEmail = (draft.email || "").trim().toLowerCase();
      const currentEmail = (Auth.user() || form.workEmail || "")
        .trim()
        .toLowerCase();

      // If both emails exist and don't match, ignore this draft
      if (storedEmail && currentEmail && storedEmail !== currentEmail) {
        return;
      }

      setForm((prev) => ({
        ...prev,
        ...(draft.form || {}),
      }));

      if (
        typeof draft.step === "number" &&
        draft.step >= 0 &&
        draft.step < steps.length
      ) {
        setStep(draft.step);
      }

      Analytics.event("start_draft_restored", {
        step: draft.step ?? 0,
      });
    } catch (e) {
      Analytics.error("start_draft_restore_failed", {
        message: e?.message,
        name: e?.name,
      });
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Central field updater with inline autosave.
  // Any input should call this rather than setForm directly so that:
  // - Drafts.save() keeps a fresh copy of the wizard state.
  // - Analytics can attribute draft-save failures to a specific field.
  const setField = (k, v) => {
    setForm((s) => {
      const next = { ...s, [k]: v };
      try {
        const email = next.workEmail || Auth.user();
        Drafts.save(email, next, step);
      } catch (e) {
        Analytics.error("start_draft_save_failed", {
          field: k,
          message: e?.message,
        });
      }
      return next;
    });
  };

  // Validate ONLY the currently active step.
  // This keeps error messaging tight and avoids overwhelming the user.
  const validateStep = () => {
    const schema = steps[step];
    const e = {};
    for (const f of schema.fields) {
      if (!f.required) continue;
      if (f.type === "checkboxes") {
        const setVal = form.channels;
        if (!setVal || setVal.size === 0) e[f.key] = "Pick at least one.";
      } else if (f.type === "checkbox") {
        if (!form[f.key]) e[f.key] = "Required.";
      } else {
        const v = (form[f.key] ?? "").toString().trim();
        if (!v) e[f.key] = "Required.";
        if (f.type === "email" && v && !/^\S+@\S+\.\S+$/.test(v)) {
          e[f.key] = "Enter a valid email.";
        }
      }
    }
    setErr(e);
    if (Object.keys(e).length > 0) {
      Analytics.event("start_step_errors", {
        step,
        fields: Object.keys(e),
      });
    }
    return Object.keys(e).length === 0;
  };

  // Move forward one step if the current step passes validation.
  // Also persists the current `step` into the Drafts store so reloads
  // can resume at the correct page.
  const next = () => {
    if (!validateStep()) {
      Analytics.event("start_step_validation_failed", { step });
      return;
    }

    const nextStep = step + 1;
    Analytics.event("start_step_change", { from: step, to: nextStep });
    console.log(`[Start] step ${step} → ${nextStep}`);

    if (step < steps.length - 1) {
      setStep(nextStep);
      try {
        Drafts.save(form.workEmail || Auth.user(), form, nextStep);
      } catch (e) {
        Analytics.error("start_draft_save_failed", {
          where: "next",
          message: e?.message,
        });
      }
    }
  };

  // Move backward a single step (never below 0).
  // We also update the draft so that reloads respect the last viewed step.
  const back = () => {
    const target = Math.max(0, step - 1);
    Analytics.event("start_step_back", { from: step, to: target });
    console.log(`[Start] step ${step} → ${target}`);

    setStep(target);
    try {
      Drafts.save(form.workEmail || Auth.user(), form, target);
    } catch (e) {
      Analytics.error("start_draft_save_failed", {
        where: "back",
        message: e?.message,
      });
    }
  };

  // Final submit for the onboarding flow.
  //
  // Guardrails:
  // - Ignores double-clicks while `submitting` is true.
  // - Re-runs validateStep() to avoid submitting a stale/invalid screen.
  // - Requires a non-empty workEmail (used as the durable onboarding key).
  //
  // Side effects on success:
  // - Soft-registers the user via Auth.signIn() if they were not already authed.
  // - Marks onboarding complete for that email via Onboarding.complete().
  // - Clears the Drafts entry for that email to prevent stale reloads.
  // - Sends the user to /thank-you.
  const submit = async () => {
    if (submitting) {
      Analytics.event("start_submit_ignored_already_submitting", { step });
      return;
    }

    if (!validateStep()) {
      Analytics.event("start_submit_blocked_validation", { step });
      return;
    }

    if (!form.workEmail || !form.workEmail.trim()) {
      Analytics.event("start_submit_blocked_missing_email", { step });
      console.warn("[Start] submit blocked: missing workEmail");
      setFailed("Please enter your work email before finishing onboarding.");
      return;
    }

    setSubmitting(true);
    setFailed("");
    Analytics.event("start_submit_attempt", { step, email: form.workEmail });

    try {
      if (!authed) {
        console.log("[Start] soft-register → Auth.signIn(", form.workEmail, ")");
        Auth.signIn(form.workEmail);
      }

      Onboarding.complete(form.workEmail);
      console.log("[Start] onboarding complete → /thank-you");

      Analytics.event("start_submit_success", { email: form.workEmail });

      try {
        Drafts.clear(form.workEmail);
      } catch (e) {
        Analytics.error("start_draft_clear_failed", {
          message: e?.message,
        });
      }

      navigate("/thank-you");
    } catch (e) {
      Analytics.error("start_submit_error", {
        message: e?.message,
        name: e?.name,
      });
      console.error("[Start] submit error", e);
      setFailed("Could not finalize onboarding. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };  

  // Step 3 helper: add the currently selected platform/channel
  // into the `channels` Set. Handles the special "Other" case by
  // pulling from the free-text `customPlatform` field.
  const addPlatform = () => {
    let platform = selectedPlatform;
    if (!platform) return;

    if (platform === "Other") {
      const trimmed = customPlatform.trim();
      if (!trimmed) return;
      platform = trimmed;
    }

    const current = form.channels || new Set();
    if (current.has(platform)) return;

    const nextSet = new Set(current);
    nextSet.add(platform);
    setField("channels", nextSet);

    if (selectedPlatform === "Other") {
      setCustomPlatform("");
    }
    setSelectedPlatform("");
  };

  // Step 3 helper: remove a previously selected platform from the Set.
  // This powers the removable "chips" UI shown under "Selected sources".
  const removePlatform = (name) => {
    const current = form.channels || new Set();
    if (!current.has(name)) return;
    const nextSet = new Set(current);
    nextSet.delete(name);
    setField("channels", nextSet);
  };

  // Field renderer for the current step.
  //
  // Most field types share the same text/checkbox layout, but a few have
  // custom UI:
  // - key === "terms": checkbox + "Read Terms & Agreements" button
  // - type === "checkboxes": the primary-channel multi-select with pills
  //   and an optional "Other" text input.
  const renderField = (f) => {
    const common =
      "mt-2 w-full rounded-lg border border-rl_border bg-rl_surface px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70 " +
      (err[f.key]
        ? "border-red-400 bg-red-50"
        : "");

        if (f.type === "checkbox") {
            // Special layout for the "Terms" checkbox:
            // we pair the checkbox with a button that opens the TermsModal,
            // so users can quickly review the agreements without leaving the flow.
            if (f.key === "terms") {
              return (
                <label className="mt-1 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 accent-rl_accent"
                    checked={!!form[f.key]}
                    onChange={(e) => setField(f.key, e.target.checked)}
                  />
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{f.label}</span>
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className="text-xs font-semibold text-amber-500 underline underline-offset-2 hover:text-amber-600"
                    >
                      Read Terms &amp; Agreements
                    </button>
                  </span>
                </label>
              );
            }
      
            // Default checkbox for all others
            return (
              <label className="mt-1 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 accent-black"
                  checked={!!form[f.key]}
                  onChange={(e) => setField(f.key, e.target.checked)}
                />
                <span>{f.label}</span>
              </label>
            );
          }
      

    if (f.type === "checkbox") {
      return (
        <label className="mt-1 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1 accent-black"
            checked={!!form[f.key]}
            onChange={(e) => setField(f.key, e.target.checked)}
          />
          <span>{f.label}</span>
        </label>
      );
    }

    // Step 3: custom "Primary channel" UI
    // -----------------------------------
    // This replaces the default text/checkbox renderer with:
    // - A <select> driven by PLATFORM_CHOICES
    // - An "Add" button to push the selection into a Set
    // - An optional "Other" text box when the user picks "Other"
    // - A row of removable chips representing chosen sources
    //
    // The underlying data is still stored on `form.channels` but is
    // manipulated via a Set to keep adds/removals idempotent.
    if (f.type === "checkboxes") {
      const selected = Array.from(form.channels || new Set());
      return (
        <div className="mt-2 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="w-full rounded-lg border border-rl_border bg-rl_surface px-4 py-2 text-sm text-rl_text focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
            >
              <option value="">Choose a platform or channel...</option>
              {PLATFORM_CHOICES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={addPlatform}
              disabled={
                !selectedPlatform ||
                (selectedPlatform === "Other" && !customPlatform.trim())
              }
              className={`inline-flex shrink-0 items-center justify-center rounded-full px-5 py-2 text-xs font-semibold tracking-[0.18em] transition-all ${
                !selectedPlatform ||
                (selectedPlatform === "Other" && !customPlatform.trim())
                  ? "bg-rl_border text-rl_muted cursor-not-allowed"
                  : "bg-rl_accent text-rl_bg shadow-rl_soft hover:shadow-md"
              }`}
            >
              Add
            </button>
          </div>

          {selectedPlatform === "Other" && (
            <div>
              <input
                type="text"
                value={customPlatform}
                onChange={(e) => setCustomPlatform(e.target.value)}
                placeholder="Briefly describe where you heard about us..."
                className="w-full rounded-lg border border-rl_border bg-rl_surface px-4 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              />
              <p className="mt-1 text-xs text-rl_muted">
                Example: &quot;Heard on a niche marketing podcast&quot; or
                &quot;Recommended in a Slack community&quot;.
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-rl_muted">
              Selected sources
            </p>
            {selected.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-rl_border bg-rl_surfaceSoft/30 px-4 py-3 text-xs text-rl_muted">
                Once you add a source, it will appear here as a removable tag.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-rl_border bg-rl_surface px-3 py-1 text-xs text-rl_text"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => removePlatform(item)}
                      className="text-zinc-400 hover:text-zinc-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <input
        type={f.type}
        value={form[f.key]}
        onChange={(e) => setField(f.key, e.target.value)}
        placeholder={f.ph}
        className={common}
      />
    );
  };

  const s = steps[step];

  // ------------- Render -------------
  // Layout:
  // - SiteHeader at the top (state-aware auth nav).
  // - Progress dots showing how many steps and which one is active.
  // - Step title + dynamically rendered fields for this step.
  // - Back / Continue / Finish buttons with disabled states.
  // - TermsModal pinned at the bottom of the component tree.
  return (
    <div className="min-h-screen bg-rl_bg text-rl_text">
      <SiteHeader />
      <main className="mx-auto max-w-shell px-4 md:px-6 py-10 md:py-14">
        {/* progress dots */}
        <div className="mb-6 flex items-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${
                i <= step ? "bg-rl_text" : "bg-rl_border"
              }`}
            />
          ))}
        </div>

        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-rl_text">
          {s.title}
        </h1>

        <form
          className="mt-6 grid gap-8 md:grid-cols-2"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="space-y-5 md:col-span-2">
            {s.fields.map((f) => (
              <div key={f.key}>
                {f.type !== "checkbox" && f.type !== "checkboxes" && (
                  <label className="block text-xs font-medium uppercase tracking-[0.2em] text-rl_muted">
                    {f.label} {f.required ? "*" : ""}
                  </label>
                )}
                {renderField(f)}
                {f.help && (
                  <p className="mt-1 text-xs text-rl_muted">{f.help}</p>
                )}
                {err[f.key] && (
                  <p className="mt-1 text-xs text-red-600">{err[f.key]}</p>
                )}
              </div>
            ))}
          </div>
        </form>

        {/* navigation buttons */}
        <div className="mt-8 flex flex-wrap gap-3">
          {step > 0 && (
            <button
              onClick={back}
              className="inline-flex items-center justify-center rounded-full border border-rl_border px-5 py-2 text-xs font-medium tracking-[0.2em] text-rl_muted hover:text-rl_text transition-colors"
            >
              BACK
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              onClick={next}
              className="inline-flex items-center justify-center rounded-full bg-rl_accent px-6 py-2.5 text-xs md:text-sm font-semibold tracking-[0.18em] text-rl_bg shadow-rl_soft hover:shadow-md transition-all"
            >
              CONTINUE
            </button>
          ) : (
            <button
              disabled={submitting}
              onClick={submit}
              className={`inline-flex items-center justify-center rounded-full px-6 py-2.5 text-xs md:text-sm font-semibold tracking-[0.18em] transition-all ${
                submitting
                  ? "bg-rl_border text-rl_muted cursor-not-allowed"
                  : "rounded-full bg-rl_accent text-rl_bg shadow-rl_soft hover:shadow-md"
              }`}
            >
              {submitting ? "FINISHING…" : "FINISH ONBOARDING"}
            </button>
          )}
        </div>

        {failed && (
          <p className="mt-3 text-sm text-red-600">{failed}</p>
        )}
      </main>

      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
    </div>
  );
}