import { describe, expect, it } from "vitest";
import {
  CONNECT_PROVIDERS,
  PREVIEW_DESTINATIONS,
  accountFromDestination,
  destinationsFromAuthResult,
  failureFromAuth,
  findLikelyManualMatch,
  liveConnectProviders,
  manualConnectionResult,
  metaDestinationsFromPages,
  planConnectionConfirmation,
  providerIdentityKey,
  publishDestinationView,
  readinessLabel,
  renameVerifiedAccount,
} from "./connectionFlow.js";

const workspaceId = "prf_1";

describe("connection flow contract", () => {
  it("offers the live providers and keeps future providers off the primary set", () => {
    expect(liveConnectProviders().map((provider) => provider.id)).toEqual([
      "instagram",
      "facebook",
      "threads",
      "youtube",
    ]);
    expect(CONNECT_PROVIDERS.some((provider) => provider.id === "tiktok" && provider.live === false)).toBe(true);
    expect(readinessLabel("IMPLEMENTED")).toBe("Ready to connect");
    expect(readinessLabel("SETUP_REQUIRED")).toBe("Setup required");
    expect(readinessLabel("PROVIDER_REVIEW_REQUIRED")).toBe("Provider review required");
    expect(readinessLabel("UNSUPPORTED")).toBe("Unsupported");
  });

  it("does not create an account until a destination is explicitly confirmed", () => {
    const destinations = metaDestinationsFromPages([
      { pageId: "page_1", pageName: "DJ Coast", instagramId: "ig_1", instagramUsername: "djcoast" },
    ]);
    expect(destinations.map((item) => item.id)).toEqual(["instagram:ig_1", "facebook:page_1"]);
    const waiting = planConnectionConfirmation({
      accounts: [],
      workspaceId,
      destinations,
      selectedIds: [],
    });
    expect(waiting.ok).toBe(false);
    expect(waiting.created).toEqual([]);

    const both = planConnectionConfirmation({
      accounts: [],
      workspaceId,
      destinations,
      selectedIds: destinations.map((item) => item.id),
    });
    expect(both.ok).toBe(true);
    expect(both.created).toHaveLength(2);
    expect(both.created.map((account) => account.connectionState)).toEqual(["CONNECTED", "CONNECTED"]);
    expect(both.created.map((account) => account.providerAccountId)).toEqual(["ig_1", "page_1"]);
  });

  it("keeps YouTube channel choice explicit", () => {
    const destinations = destinationsFromAuthResult("youtube", {
      profile: {
        channels: [
          { id: "ch_1", title: "DJ Coast", handle: "@djcoast" },
          { id: "ch_2", title: "Coast Live", handle: "@coastlive" },
        ],
      },
    });
    const plan = planConnectionConfirmation({
      accounts: [],
      workspaceId,
      destinations,
      selectedIds: ["youtube:ch_2"],
    });
    expect(plan.created).toHaveLength(1);
    expect(plan.created[0].providerAccountId).toBe("ch_2");
    expect(plan.created[0].platform).toBe("YouTube");
  });

  it("never marks a manual account Connected", () => {
    expect(manualConnectionResult()).toEqual({ connectionState: "MANUAL_ONLY", connectionMethod: "MANUAL" });
    expect(accountFromDestination(PREVIEW_DESTINATIONS[0], workspaceId).connectionState).toBe("CONNECTED");
  });

  it("treats provider account id as the unique identity", () => {
    const original = {
      id: "acc_ig",
      platform: "Instagram",
      handle: "@oldname",
      providerAccountId: "ig_1",
      connectionState: "CONNECTED",
      managedProfileId: workspaceId,
    };
    const renamed = renameVerifiedAccount(original, "@newname");
    expect(providerIdentityKey(workspaceId, "instagram", renamed.providerAccountId)).toBe("prf_1::instagram::ig_1");
    const plan = planConnectionConfirmation({
      accounts: [renamed],
      workspaceId,
      destinations: metaDestinationsFromPages([
        { pageId: "page_1", pageName: "DJ Coast", instagramId: "ig_1", instagramUsername: "newname" },
      ]),
      selectedIds: ["instagram:ig_1"],
    });
    expect(plan.ok).toBe(false);
    expect(plan.failure).toBe("duplicate");
    expect(plan.created).toEqual([]);
  });

  it("does not auto-merge a manual record that only shares a username", () => {
    const manual = {
      id: "acc_test",
      platform: "Instagram",
      displayName: "Instagram Test",
      handle: "@djcoast",
      connectionState: "SETUP_REQUIRED",
      managedProfileId: workspaceId,
    };
    const destination = PREVIEW_DESTINATIONS[0];
    expect(findLikelyManualMatch([manual], destination)?.id).toBe("acc_test");
    const undecided = planConnectionConfirmation({
      accounts: [manual],
      workspaceId,
      destinations: [destination],
      selectedIds: [destination.id],
    });
    expect(undecided.ok).toBe(false);
    expect(undecided.failure).toBe("match");
    expect(undecided.created).toEqual([]);
    expect(undecided.linked).toEqual([]);

    const separate = planConnectionConfirmation({
      accounts: [manual],
      workspaceId,
      destinations: [destination],
      selectedIds: [destination.id],
      choices: { [destination.id]: "separate" },
    });
    expect(separate.created).toHaveLength(1);
    expect(separate.linked).toEqual([]);
    expect(separate.created[0].providerAccountId).toBe("ig_preview");
  });

  it("classifies publish destinations without offering manual accounts", () => {
    expect(publishDestinationView({ connectionState: "CONNECTED" }).selectable).toBe(true);
    expect(publishDestinationView({ connectionState: "RECONNECT_REQUIRED" })).toMatchObject({
      visible: true,
      selectable: false,
      action: "reconnect",
    });
    expect(publishDestinationView({ connectionState: "SETUP_REQUIRED" })).toMatchObject({
      visible: true,
      selectable: false,
      action: "setup",
    });
    expect(publishDestinationView({ connectionState: "MANUAL_ONLY" }).visible).toBe(false);
    expect(publishDestinationView({ connectionState: "UNSUPPORTED" }).visible).toBe(false);
  });

  it("maps provider failures to operator-facing outcomes", () => {
    expect(failureFromAuth({ error: "Instagram authorization was denied." })).toBe("cancelled");
    expect(failureFromAuth({ error: "No professional Instagram account is linked to a Page you manage." })).toBe("professional");
    expect(failureFromAuth({ readiness: "SETUP_REQUIRED" })).toBe("setup");
    expect(failureFromAuth({ reason: "PROVIDER_REVIEW_REQUIRED" })).toBe("review");
  });
});
