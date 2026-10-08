import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "../components/app/StatusBadge.jsx";
import { CONNECTION_STATES } from "./domain.js";
import { displayConnectionState, displayProfileConnection } from "./connectionStatus.js";
import { publicProfileConnection, PROFILE_CONNECTION_STATES } from "./profileModels.js";
import { SyncStatusSchema } from "./domainSchemas.ts";
import {
  PROVIDER_CONNECTION_PRESENTATION,
  PROVIDER_CONNECTION_STATES,
  PROVIDER_CONNECTION_TRANSITIONS,
  SOCIAL_CONNECTION_PRESENTATION,
  SOCIAL_CONNECTION_STATE_LIST,
  isProviderConnectionState,
  isSocialConnectionState,
} from "./statusContracts.js";
import { CONNECTION_STATES as serverSocialStates } from "../../server/connectors/capabilities.js";
import { JOB_STATES } from "../../server/db/jobs.js";

const PROVIDER_LABELS = {
  CONNECTED: "Connected",
  NOT_CONNECTED: "Not connected",
  RECONNECT_REQUIRED: "Reconnect required",
  SETUP_REQUIRED: "Setup required",
  SYNCING: "Syncing",
  ERROR: "Error",
};

describe("provider connection contract", () => {
  it("recognizes every provider state in validation, the public model, labels, and Settings presentation", () => {
    for (const state of Object.values(PROVIDER_CONNECTION_STATES)) {
      expect(isProviderConnectionState(state)).toBe(true);
      const row = publicProfileConnection({
        id: "pcn_test",
        kind: "GMAIL",
        status: state,
        connectionState: state,
      });
      expect(row.status).toBe(state);
      expect(row.connectionState).toBe(state);
      const view = displayProfileConnection({ status: state });
      expect(view.code).toBe(state);
      expect(view.label).toBe(PROVIDER_LABELS[state]);
      expect(view.toneClass).toBeTruthy();
      render(<StatusBadge value={view.code} label={view.label} />);
      expect(screen.getByText(PROVIDER_LABELS[state]).className).toContain(view.toneClass.split(" ")[0]);
    }
  });

  it("keeps ERROR distinct from RECONNECT_REQUIRED", () => {
    const error = displayProfileConnection({ status: "ERROR" });
    const reconnect = displayProfileConnection({ status: "RECONNECT_REQUIRED" });
    expect(error.label).toBe("Error");
    expect(reconnect.label).toBe("Reconnect required");
    expect(error.tone).toBe("danger");
    expect(reconnect.tone).toBe("warning");
    expect(error.hint).not.toMatch(/reconnect|revoked|expired/i);
    expect(reconnect.hint).toMatch(/revoked|expired/i);
  });

  it("keeps a missing provider grant as Not connected", () => {
    expect(displayProfileConnection(null).label).toBe("Not connected");
    expect(displayProfileConnection({}).code).toBe("NOT_CONNECTED");
  });

  it("only lists transitions between provider states", () => {
    for (const [from, targets] of Object.entries(PROVIDER_CONNECTION_TRANSITIONS)) {
      expect(isProviderConnectionState(from)).toBe(true);
      expect(targets.length).toBeGreaterThan(0);
      for (const target of targets) expect(isProviderConnectionState(target)).toBe(true);
    }
  });
});

describe("social account connection contract", () => {
  it("recognizes every social state with a label and a badge tone", () => {
    expect([...CONNECTION_STATES].sort()).toEqual([...SOCIAL_CONNECTION_STATE_LIST].sort());
    for (const state of SOCIAL_CONNECTION_STATE_LIST) {
      expect(isSocialConnectionState(state)).toBe(true);
      const view = displayConnectionState({ connectionState: state });
      expect(view.code).toBe(state);
      expect(view.label).toBe(SOCIAL_CONNECTION_PRESENTATION[state].label);
      expect(view.label).not.toBe("Unknown");
      expect(view.toneClass).toBeTruthy();
      render(<StatusBadge value={state} />);
      expect(screen.getAllByText(view.label).length).toBeGreaterThan(0);
    }
  });

  it("does not treat a manual account or setup readiness as Connected", () => {
    expect(displayConnectionState({ connectionState: "MANUAL_ONLY" }).code).not.toBe("CONNECTED");
    const setup = displayConnectionState(
      { platform: "Instagram", connectionState: "SETUP_REQUIRED" },
      { providerReadiness: "SETUP_REQUIRED" },
    );
    expect(setup.label).toBe("Setup required");
    expect(setup.code).not.toBe("CONNECTED");
    expect(displayProfileConnection({ status: "NOT_CONNECTED" }).code).not.toBe("SETUP_REQUIRED");
  });
});

describe("unknown connection status", () => {
  it("does not present an unrecognized provider status as a real connection", () => {
    const stored = publicProfileConnection({ status: "BANANA", kind: "GMAIL" });
    expect(stored.status).toBe("BANANA");
    const view = displayProfileConnection({ status: "BANANA", lastErrorSummary: "token secret" });
    expect(view.code).toBe("UNKNOWN");
    expect(view.label).toBe("Unknown");
    expect(view.label).not.toBe("Connected");
    expect(view.hint).not.toMatch(/token secret|connected|setup required/i);
    render(<StatusBadge value="BANANA" />);
    const badge = screen.getByText("Unknown");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("title", "Unrecognized status");
    expect(badge.textContent).not.toMatch(/banana|secret/i);
  });

  it("does not let provider readiness turn an unrecognized social state into Setup required", () => {
    const view = displayConnectionState(
      { connectionState: "BANANA" },
      { providerReadiness: "SETUP_REQUIRED" },
    );
    expect(view.code).toBe("UNKNOWN");
    expect(view.label).toBe("Unknown");
    expect(view.label).not.toBe("Connected");
    expect(view.label).not.toBe("Setup required");
  });
});

describe("server and client status parity", () => {
  it("gives every server provider state a client presentation", () => {
    expect(Object.keys(PROFILE_CONNECTION_STATES).sort())
      .toEqual(Object.keys(PROVIDER_CONNECTION_STATES).sort());
    expect(Object.keys(PROVIDER_CONNECTION_PRESENTATION).sort())
      .toEqual(Object.keys(PROVIDER_CONNECTION_STATES).sort());
  });

  it("gives every server social state a client presentation", () => {
    expect([...serverSocialStates].sort()).toEqual(Object.keys(SOCIAL_CONNECTION_PRESENTATION).sort());
  });

  it("keeps job states and sync health out of the provider connection set", () => {
    for (const state of [JOB_STATES.PENDING, JOB_STATES.RUNNING, JOB_STATES.DONE, JOB_STATES.FAILED]) {
      expect(isProviderConnectionState(state)).toBe(false);
    }
    for (const state of SyncStatusSchema.options) {
      if (state === "ERROR" || state === "SYNCING") continue;
      expect(isProviderConnectionState(state)).toBe(false);
    }
  });
});

describe("live pilot status meaning", () => {
  it("renders the stored pilot states with their canonical labels", () => {
    expect(displayProfileConnection({ status: "CONNECTED", kind: "GMAIL" }).label).toBe("Connected");
    expect(displayProfileConnection({ status: "NOT_CONNECTED", kind: "YOUTUBE" }).label).toBe("Not connected");
    expect(displayConnectionState(
      { platform: "Instagram", displayName: "Test", connectionState: "SETUP_REQUIRED" },
      { providerReadiness: "SETUP_REQUIRED" },
    ).label).toBe("Setup required");
  });
});
