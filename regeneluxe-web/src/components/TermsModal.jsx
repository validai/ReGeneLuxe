// FILE: src/components/TermsModal.jsx
import React from "react";

const TermsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold tracking-tight text-gray-900">
            Terms &amp; Agreements
          </h2>
          <button
            onClick={onClose}
            className="rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-500 hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4 text-sm text-gray-700">
          <p>
            ReGeneLuxe is a strategy and automation partner designed to help you
            plan, launch, and optimize multi-channel campaigns. By proceeding,
            you confirm that you understand we are not a financial advisor, legal
            advisor, or compliance officer.
          </p>

          <p className="font-semibold">1. Use of the System</p>
          <p>
            You agree to use ReGeneLuxe strictly for lawful marketing and
            business purposes. You are responsible for ensuring that any
            campaigns launched are compliant with the policies of each platform
            you use (e.g., Meta, Google, TikTok, email service providers) and
            with applicable laws and regulations in your jurisdiction.
          </p>

          <p className="font-semibold">2. Data &amp; Privacy</p>
          <p>
            You confirm that any customer or audience data you upload or connect
            to ReGeneLuxe has been obtained lawfully and that you have the
            necessary permissions and rights to use that data for marketing and
            analytics. We encourage you to maintain your own privacy policy and
            consent flows with your customers.
          </p>

          <p className="font-semibold">3. Results &amp; Performance</p>
          <p>
            All campaign recommendations, templates, and automations generated
            by ReGeneLuxe are suggestions, not guarantees. Performance will vary
            depending on your offer, audience, budget, and execution. You are
            responsible for reviewing, editing, and approving any campaign
            before it goes live.
          </p>

          <p className="font-semibold">4. Intellectual Property</p>
          <p>
            You retain ownership of your brand assets, creatives, and audience
            data. ReGeneLuxe owns the underlying systems, prompts, templates,
            and automation logic that powers your experience, even when they are
            customized to your brand.
          </p>

          <p className="font-semibold">5. Acceptance</p>
          <p>
            By continuing through this onboarding, you acknowledge that you have
            read and understood these Terms &amp; Agreements and that you are
            authorized to act on behalf of your brand or business.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-full border border-gray-300 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;
