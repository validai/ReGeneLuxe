import { describe, expect, it } from "vitest";
import {
  assertProviderWriteAllowed,
  DJ_COAST_WORKSPACE_ID,
  isDjCoastWorkspace,
} from "./productionWriteGuard.js";

describe("productionWriteGuard", () => {
  it("identifies DJ Coast by id, slug, and name", () => {
    expect(isDjCoastWorkspace({ id: DJ_COAST_WORKSPACE_ID })).toBe(true);
    expect(isDjCoastWorkspace({ slug: "dj-coast" })).toBe(true);
    expect(isDjCoastWorkspace({ displayName: "DJ Coast" })).toBe(true);
    expect(isDjCoastWorkspace({ id: "de5d366a-393f-4f30-a4f3-5d9b397a4340", displayName: "S!xd9" })).toBe(false);
  });

  it("allows dry-run even on DJ Coast (no provider write)", () => {
    const result = assertProviderWriteAllowed({
      workspace: { id: DJ_COAST_WORKSPACE_ID, displayName: "DJ Coast", workspacePurpose: "PRODUCTION" },
      dryRun: true,
    });
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.providerWrite).toBe(false);
  });

  it("hard-blocks DJ Coast real writes", () => {
    const result = assertProviderWriteAllowed({
      workspace: { id: DJ_COAST_WORKSPACE_ID, slug: "dj-coast", workspacePurpose: "PRODUCTION" },
      dryRun: false,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("DJ_COAST_PRODUCTION_WRITE_BLOCKED");
  });

  it("requires TEST workspace on live runtimes unless production writes are explicitly allowed", () => {
    const blocked = assertProviderWriteAllowed({
      workspace: {
        id: "de5d366a-393f-4f30-a4f3-5d9b397a4340",
        displayName: "S!xd9",
        workspacePurpose: "PRODUCTION",
      },
      dryRun: false,
      env: { RL_DB_MODE: "sqlite", VITEST: "false" },
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe("TEST_WORKSPACE_REQUIRED");

    const vitestWaived = assertProviderWriteAllowed({
      workspace: {
        id: "de5d366a-393f-4f30-a4f3-5d9b397a4340",
        displayName: "S!xd9",
        workspacePurpose: "PRODUCTION",
      },
      dryRun: false,
      env: { VITEST: "true" },
    });
    expect(vitestWaived.ok).toBe(true);

    const allowed = assertProviderWriteAllowed({
      workspace: {
        id: "de5d366a-393f-4f30-a4f3-5d9b397a4340",
        displayName: "S!xd9",
        workspacePurpose: "TEST",
      },
      dryRun: false,
      env: { RL_DB_MODE: "sqlite", VITEST: "false" },
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.code).toBe("ALLOWED");
  });

  it("blocks writes whose account is bound to DJ Coast even if workspace object is incomplete", () => {
    const result = assertProviderWriteAllowed({
      workspace: null,
      account: { managedProfileId: DJ_COAST_WORKSPACE_ID },
      dryRun: false,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("DJ_COAST_PRODUCTION_WRITE_BLOCKED");
  });
});
