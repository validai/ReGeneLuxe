import { useMemo, useSyncExternalStore } from "react";
import { subscribe, getSnapshotVersion } from "../data/storage.js";
import { listCampaigns, getActiveCampaignId } from "../data/campaignRepository.js";
import { listAccounts } from "../data/accountRepository.js";
import { getSettings } from "../data/settingsRepository.js";
import { listContent, listInbox, listSnapshots, listQueue, listDecisions, listActivity } from "../data/collectionRepository.js";
import { getWorkingAccountId } from "../data/workingContext.js";

function getSnapshot() {
  return getSnapshotVersion();
}

export function useAppData() {
  const version = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return useMemo(() => {
    const campaigns = listCampaigns();
    const accounts = listAccounts();
    const settings = getSettings();
    const content = listContent();
    const inbox = listInbox();
    const snapshots = listSnapshots();
    const queue = listQueue();
    const decisions = listDecisions();
    const activity = listActivity();
    const activeCampaignId = getActiveCampaignId();
    const workingAccountId = getWorkingAccountId();

    return {
      version,
      campaigns,
      accounts,
      settings,
      content,
      inbox,
      snapshots,
      queue,
      decisions,
      activity,
      activeCampaignId,
      workingAccountId,
      activeCampaign: campaigns.find((campaign) => campaign.id === activeCampaignId) || null,
    };
  }, [version]);
}
