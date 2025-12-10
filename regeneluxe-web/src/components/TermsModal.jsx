// FILE: src/components/TermsModal.jsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUpVariant, baseTransition } from "../utils/motionConfig";

const TermsModal = ({ isOpen, onClose }) => {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const modalVariant = {
    hidden: { opacity: 0, y: 32, scale: 0.97 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: baseTransition,
    },
  };

  const backdropVariant = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          variants={prefersReducedMotion ? {} : backdropVariant}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={onClose}
        >
          <motion.div
            className="mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-rl_surface shadow-xl"
            variants={prefersReducedMotion ? {} : modalVariant}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Header (title only – no close button here) */}
        <div className="flex items-center justify-between border-b border-rl_border px-6 py-4">
          <h2 className="text-lg font-semibold tracking-tight text-rl_text">
            Terms &amp; Agreements
          </h2>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4 text-sm text-rl_text">
          <p>
            ReGeneLuxe is a strategy and automation partner designed to help you
            plan, draft, and optimize multi-channel marketing campaigns. By
            proceeding, you confirm that you understand we are not a financial
            advisor, legal advisor, or compliance officer, and that all use of
            this system is at your own business discretion.
          </p>

          <p className="font-semibold">1. Use of the System</p>
          <p>
            You agree to use ReGeneLuxe strictly for lawful marketing and
            business purposes. You are responsible for ensuring that any
            campaigns launched are compliant with the policies of each platform
            you use (e.g., Meta, Google, TikTok, email service providers,
            marketing automation tools) and with all applicable laws and
            regulations in your jurisdiction, including advertising, consumer
            protection, privacy, and anti-spam requirements.
          </p>

          <p className="font-semibold">2. Data &amp; Privacy</p>
          <p>
            You confirm that any customer, audience, or third-party data you
            upload, connect, or otherwise make available to ReGeneLuxe has been
            obtained lawfully and that you have all necessary rights, consents,
            and permissions to use that data for marketing, analytics, and
            campaign optimization. You are responsible for maintaining your own
            privacy policy, cookie notices, and consent flows with your
            customers and contacts.
          </p>
          <p>
            ReGeneLuxe may process usage information and configuration data
            related to your account for the purposes of operating, improving,
            and securing the service. We do not claim ownership over your
            underlying customer data.
          </p>

          <p className="font-semibold">3. Content, Assets &amp; License to Use</p>
          <p>
            You retain ownership of your brand assets, creative materials,
            product information, and any other content you provide to
            ReGeneLuxe (collectively, &quot;Client Materials&quot;). By using
            the system, you grant ReGeneLuxe a limited, worldwide,
            non-exclusive, royalty-free license to host, process, adapt, and
            transform the Client Materials solely for the purposes of:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Drafting and refining campaigns, copy, and strategy;</li>
            <li>Generating templates, blueprints, and automations for you;</li>
            <li>Improving models, prompts, and workflows in an aggregated,
              anonymized form that does not publicly identify you or your
              customers.</li>
          </ul>
          <p>
            You are responsible for ensuring that Client Materials do not
            infringe any third-party rights (including copyrights, trademarks,
            rights of publicity, or contractual obligations).
          </p>

          <p className="font-semibold">4. ReGeneLuxe Intellectual Property</p>
          <p>
            ReGeneLuxe owns all rights, title, and interest in and to the
            platform, including but not limited to the underlying software,
            prompts, models, workflows, templates, automations, UI, and any
            improvements or derivative works created from them (collectively,
            &quot;ReGeneLuxe IP&quot;). Even where ReGeneLuxe IP is customized
            to your brand or campaigns, the ReGeneLuxe IP itself remains our
            property.
          </p>
          <p>
            Subject to your compliance with these Terms, you are granted a
            limited, non-exclusive, non-transferable license to use the
            ReGeneLuxe IP inside the platform to plan and execute your own
            marketing campaigns. You may export and use campaign outputs
            (copy, briefs, workflows, and creative directions) for your own
            business, but you may not resell, sublicense, or white-label the
            ReGeneLuxe platform or core templates as a competing product.
          </p>

          <p className="font-semibold">5. Confidentiality</p>
          <p>
            Each party agrees to treat non-public business, technical, and
            strategic information received from the other party as confidential
            and to use it only as necessary to provide or receive the services.
            This obligation does not apply to information that is or becomes
            publicly available through no fault of the receiving party, was
            already lawfully known, or is independently developed without use
            of the other party&apos;s confidential information.
          </p>

          <p className="font-semibold">6. Third-Party Services &amp; AI Tools</p>
          <p>
            ReGeneLuxe may integrate with, or rely on, third-party platforms
            and AI providers (such as ad networks, analytics tools, and model
            providers). Your use of those services is subject to their own
            terms and policies, and you are responsible for complying with
            them. We cannot control or guarantee the behavior of third-party
            APIs, delivery systems, or platforms.
          </p>

          <p className="font-semibold">7. Results, Performance &amp; Compliance</p>
          <p>
            All campaign recommendations, templates, and automations generated
            by ReGeneLuxe are suggestions and starting points, not guarantees
            of any specific results or outcomes. Performance will vary based on
            your offer, audience, budget, creative choices, compliance
            practices, and execution. You are responsible for reviewing,
            editing, validating, and approving all campaigns and assets before
            they go live, and for obtaining any required legal or compliance
            review.
          </p>

          <p className="font-semibold">8. Acceptable Use</p>
          <p>
            You agree not to use ReGeneLuxe to create or distribute content
            that is illegal, deceptive, misleading, discriminatory, hateful,
            or abusive, or that violates the policies of the platforms where
            you advertise. We reserve the right to suspend or limit access for
            behavior that, in our reasonable judgment, risks harm to customers,
            platforms, or the ReGeneLuxe brand.
          </p>

          <p className="font-semibold">9. Limitation of Liability</p>
          <p>
            To the maximum extent permitted by law, ReGeneLuxe will not be
            liable for any indirect, incidental, consequential, special, or
            punitive damages, or for any lost profits or lost opportunities,
            arising out of or relating to your use of the platform, even if we
            have been advised of the possibility of such damages. Our aggregate
            liability in connection with your use of ReGeneLuxe will be limited
            to the amount you have paid to us for access to the service in the
            twelve (12) months preceding the event giving rise to the claim.
          </p>

          <p className="font-semibold">10. Acceptance</p>
          <p>
            By continuing through this onboarding or using ReGeneLuxe, you
            acknowledge that you have read, understood, and agree to these
            Terms &amp; Agreements and that you are authorized to act on behalf
            of your brand or business.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-rl_border px-6 py-3">
          <motion.button
            onClick={onClose}
            className="rounded-full border border-rl_border px-4 py-1.5 text-xs font-medium tracking-[0.2em] text-rl_muted hover:text-rl_text transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            CLOSE
          </motion.button>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TermsModal;
