#!/usr/bin/env node
/**
 * Self-run certification mission (TEST workspace only).
 *
 * - Designates alternate-artist S!xd9 as TEST (never DJ Coast)
 * - Seeds synthetic certification campaign/content/assets
 * - Runs dry-run dispatch (no provider writes)
 * - Reports OAuth / live-publish blockers honestly
 *
 * Does NOT publish to real providers. Does NOT touch DJ Coast accounts.
 */
import { initDb, upsert, list, COLLECTIONS } from "../server/db/index.js";
import { updateManagedProfile, getManagedProfile } from "../server/db/managedProfileRepository.js";
import { executeDryRunDispatch } from "../server/marketingDrafts/dryRunDispatch.js";
import {
  emptyMarketingDraft,
  draftApprovalFingerprint,
  APPROVAL_KIND,
  createApprovalId,
} from "../server/marketingDrafts/model.js";
import { assertProviderWriteAllowed, DJ_COAST_WORKSPACE_ID } from "../server/certification/productionWriteGuard.js";
import { createId, nowIso } from "../src/data/ids.js";

const SIXD9_WORKSPACE_ID = "de5d366a-393f-4f30-a4f3-5d9b397a4340";
const CERT_MARK = "[REGENELUXE CERT]";

await initDb();

const coast = await getManagedProfile(DJ_COAST_WORKSPACE_ID);
const sixd9 = await getManagedProfile(SIXD9_WORKSPACE_ID);
if (!sixd9) {
  console.error(JSON.stringify({ ok: false, error: "S!xd9 workspace missing" }));
  process.exit(1);
}

const designated = await updateManagedProfile(SIXD9_WORKSPACE_ID, {
  workspacePurpose: "TEST",
  workspaceType: sixd9.workspaceType || "ARTIST",
});

const coastBlock = assertProviderWriteAllowed({
  workspace: coast || { id: DJ_COAST_WORKSPACE_ID, slug: "dj-coast", displayName: "DJ Coast", workspacePurpose: "PRODUCTION" },
  dryRun: false,
});
const testAllow = assertProviderWriteAllowed({
  workspace: designated,
  dryRun: false,
});

const accounts = (await list(COLLECTIONS.accounts))
  .filter((row) => row.managedProfileId === SIXD9_WORKSPACE_ID);
const coastAccounts = (await list(COLLECTIONS.accounts))
  .filter((row) => row.managedProfileId === DJ_COAST_WORKSPACE_ID);

const campaignId = "camp_cert_sixd9";
const mediaId = "med_cert_sixd9_1";
await upsert(COLLECTIONS.campaigns, {
  id: campaignId,
  name: `${CERT_MARK} Six D certification campaign`,
  managedProfileId: SIXD9_WORKSPACE_ID,
  status: "ACTIVE",
  assets: [
    {
      id: mediaId,
      name: `${CERT_MARK} synthetic asset`,
      kind: "IMAGE",
      status: "READY",
      note: "Synthetic certification asset — replace with public media before Instagram live publish.",
      certification: true,
    },
  ],
  createdAt: nowIso(),
  updatedAt: nowIso(),
  schemaVersion: 1,
  certification: true,
});

const dryRuns = [];
const providersToProbe = ["instagram", "facebook", "youtube"];
for (const platform of providersToProbe) {
  const account = accounts.find((row) => String(row.platform || "").toLowerCase() === platform) || null;
  const draft = emptyMarketingDraft({
    id: createId("cnt"),
    workspaceId: SIXD9_WORKSPACE_ID,
    managedProfileId: SIXD9_WORKSPACE_ID,
    campaignId,
    destinationAccountId: account?.id || "",
    platform,
    title: `${CERT_MARK} ${platform} dry-run`,
    caption: `${CERT_MARK} Harmless certification dry-run for ${platform}. Not a live post.`,
    status: "APPROVED",
    approvalStatus: "APPROVED",
    scheduledFor: new Date(Date.now() - 30_000).toISOString(),
    releaseGateState: "READY",
    releaseGates: [],
    mediaRefs: [mediaId],
    heroAssetId: mediaId,
    certification: true,
  });
  const fingerprint = draftApprovalFingerprint(draft);
  const approval = {
    id: createApprovalId(),
    kind: APPROVAL_KIND,
    draftId: draft.id,
    workspaceId: SIXD9_WORKSPACE_ID,
    contentFingerprint: fingerprint,
    scheduledFor: draft.scheduledFor,
    approvedAt: nowIso(),
    expiresAt: null,
  };
  draft.approvalId = approval.id;
  await upsert(COLLECTIONS.approvals, approval);
  await upsert(COLLECTIONS.content, draft);

  const dry = await executeDryRunDispatch(draft, { account });
  dryRuns.push({
    platform,
    accountConnected: Boolean(account),
    accountId: account?.id || null,
    ok: dry.ok,
    providerWrite: dry.providerWrite,
    blockedReasons: dry.blockedReasons,
  });
}

// Prove DJ Coast dry-run is allowed but real write is blocked using a coast account reference.
const coastIg = coastAccounts.find((row) => String(row.platform || "").toLowerCase() === "instagram");
let coastDry = null;
if (coastIg) {
  const coastDraft = emptyMarketingDraft({
    id: createId("cnt"),
    workspaceId: DJ_COAST_WORKSPACE_ID,
    managedProfileId: DJ_COAST_WORKSPACE_ID,
    destinationAccountId: coastIg.id,
    platform: "instagram",
    caption: `${CERT_MARK} must never go live on DJ Coast`,
    status: "APPROVED",
    approvalStatus: "APPROVED",
    scheduledFor: new Date(Date.now() - 30_000).toISOString(),
    releaseGateState: "READY",
    mediaRefs: ["med_coast_should_not_use"],
  });
  coastDry = await executeDryRunDispatch(coastDraft, { account: coastIg });
}

const report = {
  ok: true,
  mission: "FULL_SELF_RUN_CERTIFICATION",
  workspace: {
    id: designated.id,
    displayName: designated.displayName,
    slug: designated.slug,
    workspacePurpose: designated.workspacePurpose,
  },
  djCoastWriteBlocked: coastBlock.ok === false && coastBlock.code === "DJ_COAST_PRODUCTION_WRITE_BLOCKED",
  testWorkspaceWriteAllowed: testAllow.ok === true,
  connectedAccountsInTest: accounts.map((row) => ({
    id: row.id,
    platform: row.platform,
    connectionState: row.connectionState,
    handle: row.handle || row.displayName || null,
  })),
  dryRuns,
  coastDryRunProviderWrite: coastDry ? coastDry.providerWrite : null,
  livePublishReady: accounts.some((row) => row.connectionState === "CONNECTED"),
  operatorRequiredNext: accounts.length === 0
    ? [
        "Sign in as sixd9music@gmail.com (S!xd9 TEST workspace).",
        "Settings → Connections: connect Instagram / Facebook / YouTube (and others) for THIS artist only via normal OAuth.",
        "Complete Google/Meta (etc.) security challenges in the browser — Cursor cannot automate those.",
        "Do NOT use DJ Coast destinations.",
        "Return for Cursor to run one harmless [REGENELUXE CERT] live post per connected publish-capable provider + verify/readback.",
      ]
    : [
        "Confirm connected TEST destinations belong to Six D, not DJ Coast.",
        "Return for Cursor to run one harmless live certification post per supported provider.",
      ],
  certificationState: accounts.length === 0
    ? "REGENELUXE_PROVIDER_CERT_BLOCKED_AWAITING_TEST_OAUTH"
    : "REGENELUXE_PROVIDER_CERT_READY_FOR_LIVE_SLICE",
};

console.log(JSON.stringify(report, null, 2));
console.log(report.certificationState);
