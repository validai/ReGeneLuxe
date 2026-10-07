import { MemoryRouter } from "@/nav";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProfileSessionProvider } from "../components/app/ProfileSession.jsx";
import SettingsPage from "./SettingsPage.jsx";
import { resetDurableHealthForTests } from "../data/durableBootstrap.js";

vi.mock("../../app/actions/auth", () => ({
  signInWithGoogle: () => {},
  signOutOperator: () => {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}));

const syncedHealth = {
  ok: true,
  local: { healthy: true },
  sync: {
    cloudConfigured: true,
    cloudReachable: true,
    state: "SYNCED",
    pendingOutbox: 0,
    lastSyncAt: "2026-09-19T21:06:24.112Z",
    localHealthy: true,
  },
};

function renderSettings(healthResponse, { initialDbHealth, hangHealth = false } = {}) {
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    if (hangHealth && String(url).includes("/api/db/health")) {
      return new Promise(() => {});
    }
    if (String(url).includes("/api/sync") && String(init?.method || "GET").toUpperCase() === "POST") {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          status: {
            cloudConfigured: true,
            cloudReachable: true,
            state: "SYNCED",
            pendingOutbox: 0,
            lastSyncAt: "2026-10-07T16:40:20.411Z",
            localHealthy: true,
          },
        }),
      };
    }
    if (String(url).includes("/api/db/health")) {
      const payload = typeof healthResponse === "function" ? healthResponse() : healthResponse;
      if (payload instanceof Error) throw payload;
      const status = payload?.httpStatus || 200;
      return {
        ok: status >= 200 && status < 300,
        json: async () => payload,
      };
    }
    return { ok: true, json: async () => ({ ok: true, providers: [] }) };
  }));

  return render(
    <MemoryRouter>
      <ProfileSessionProvider
        operator={{ id: "opr_1", name: "Coast Ent", email: "djcoast239@gmail.com" }}
        profiles={[{ id: "prf_1", displayName: "DJ Coast" }]}
        activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
      >
        <SettingsPage initialDbHealth={initialDbHealth} />
      </ProfileSessionProvider>
    </MemoryRouter>,
  );
}

describe("authenticated Data & Sync health", () => {
  beforeEach(() => {
    resetDurableHealthForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetDurableHealthForTests();
  });

  it("shows Connected and Synced from authoritative health without waiting on fetch", () => {
    renderSettings(syncedHealth, { initialDbHealth: syncedHealth, hangHealth: true });
    expect(screen.getByText(/Account · DJ Coast/)).toBeInTheDocument();
    expect(screen.getByText(/Local database · Healthy/)).toBeInTheDocument();
    expect(screen.getByText(/Cloud database · Connected/)).toBeInTheDocument();
    expect(screen.getByText(/Cloud sync · Synced/)).toBeInTheDocument();
    expect(screen.getByText(/Pending operations · 0/)).toBeInTheDocument();
    expect(screen.queryByText(/Cloud database · —/)).not.toBeInTheDocument();
  });

  it("shows Connected and Synced when Turso health is configured + synced", async () => {
    renderSettings(syncedHealth);
    await waitFor(() => {
      expect(screen.getByText(/Cloud database · Connected/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Local database · Healthy/)).toBeInTheDocument();
    expect(screen.getByText(/Cloud sync · Synced/)).toBeInTheDocument();
    expect(screen.getByText(/Pending operations · 0/)).toBeInTheDocument();
  });

  it("shows Connected and Pending when outbox is waiting", async () => {
    renderSettings({
      ok: true,
      local: { healthy: true },
      sync: {
        cloudConfigured: true,
        cloudReachable: true,
        state: "PENDING",
        pendingOutbox: 3,
        localHealthy: true,
      },
    });
    await waitFor(() => {
      expect(screen.getByText(/Cloud sync · Pending/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Cloud database · Connected/)).toBeInTheDocument();
    expect(screen.getByText(/Pending operations · 3/)).toBeInTheDocument();
  });

  it("shows Offline when Turso is configured but unreachable", async () => {
    renderSettings({
      ok: true,
      local: { healthy: true },
      sync: {
        cloudConfigured: true,
        cloudReachable: false,
        state: "OFFLINE",
        pendingOutbox: 0,
        localHealthy: true,
      },
    });
    await waitFor(() => {
      expect(screen.getByText(/Cloud database · Offline/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Cloud sync · Offline/)).toBeInTheDocument();
    expect(screen.queryByText(/Not configured/)).not.toBeInTheDocument();
  });

  it("shows Not configured when Turso credentials are absent", async () => {
    renderSettings({
      ok: true,
      local: { healthy: true },
      sync: {
        cloudConfigured: false,
        cloudReachable: false,
        state: "LOCAL_ONLY",
        pendingOutbox: 0,
        localHealthy: true,
      },
    });
    await waitFor(() => {
      expect(screen.getByText(/Cloud database · Not configured/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Cloud sync · Local only/)).toBeInTheDocument();
  });

  it("does not treat a health fetch failure as Not configured", async () => {
    renderSettings(new Error("Failed to fetch"));
    await waitFor(() => {
      expect(screen.getByText(/Cloud database · — \(/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Cloud database · Not configured/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Local database · Healthy/)).not.toBeInTheDocument();
  });

  it("refreshes cloud sync status after Sync now", async () => {
    let synced = false;
    renderSettings(() => ({
      ok: true,
      local: { healthy: true },
      sync: synced
        ? { cloudConfigured: true, cloudReachable: true, state: "SYNCED", pendingOutbox: 0, localHealthy: true }
        : { cloudConfigured: true, cloudReachable: true, state: "PENDING", pendingOutbox: 2, localHealthy: true },
    }));
    await waitFor(() => {
      expect(screen.getByText(/Cloud sync · Pending/)).toBeInTheDocument();
    });
    synced = true;
    fireEvent.click(screen.getByRole("button", { name: /^sync now$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Cloud sync · Synced/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Pending operations · 0/)).toBeInTheDocument();
  });
});
