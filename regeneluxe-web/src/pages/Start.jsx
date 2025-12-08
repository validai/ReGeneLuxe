// FILE: src/pages/Start.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { Auth } from "../utils/auth";
import { Onboarding } from "../utils/onboarding";
import { Analytics } from "../utils/analytics";
import { Drafts } from "../utils/drafts";
import TermsModal from "../components/TermsModal";

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


export default function Start() {
  console.log("[Start] mounted");
  const navigate = useNavigate();
  const authed = Auth.isSignedIn();

  const [step, setStep] = useState(0);
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

  const removePlatform = (name) => {
    const current = form.channels || new Set();
    if (!current.has(name)) return;
    const nextSet = new Set(current);
    nextSet.delete(name);
    setField("channels", nextSet);
  };

  const renderField = (f) => {
    const common =
      "mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:bg-white " +
      (err[f.key]
        ? "border-red-400 bg-red-50"
        : "border-rl_border bg-rl_accentSoft/40");

        if (f.type === "checkbox") {
            // Special layout for the Terms checkbox
            if (f.key === "terms") {
              return (
                <label className="mt-1 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 accent-black"
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

    // Step 3: custom "Primary channels" UI
    if (f.type === "checkboxes") {
      const selected = Array.from(form.channels || new Set());
      return (
        <div className="mt-2 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="w-full rounded-full border border-rl_border bg-rl_accentSoft/40 px-4 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/80"
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
              className={`inline-flex shrink-0 items-center justify-center rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white ${
                !selectedPlatform ||
                (selectedPlatform === "Other" && !customPlatform.trim())
                  ? "bg-zinc-400 cursor-not-allowed"
                  : "bg-black hover:bg-zinc-900"
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
                className="w-full rounded-xl border border-rl_border bg-rl_accentSoft/40 px-4 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/80"
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
              <p className="mt-2 rounded-xl border border-dashed border-rl_border bg-rl_accentSoft/30 px-4 py-3 text-xs text-rl_muted">
                Once you add a source, it will appear here as a removable tag.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-rl_border bg-white px-3 py-1 text-xs text-rl_ink"
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

  return (
    <div className="min-h-screen bg-page text-rl_ink">
      <SiteHeader />
      <main className="mx-auto max-w-container px-6 pb-16 pt-12">
        {/* progress dots */}
        <div className="mb-6 flex items-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${
                i <= step ? "bg-black" : "bg-rl_border"
              }`}
            />
          ))}
        </div>

        <h1 className="text-2xl font-extrabold tracking-[-0.02em]">
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
              className="rounded-full border border-rl_border px-5 py-2 text-xs font-medium uppercase tracking-[0.18em]"
            >
              Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              onClick={next}
              className="rounded-full bg-black px-5 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white transition-colors hover:bg-zinc-900"
            >
              Continue
            </button>
          ) : (
            <button
              disabled={submitting}
              onClick={submit}
              className={`rounded-full px-5 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white ${
                submitting
                  ? "bg-zinc-400 cursor-not-allowed"
                  : "bg-black hover:bg-zinc-900"
              }`}
            >
              {submitting ? "Finishing…" : "Finish onboarding"}
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