import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AccessNotAuthorizedPage from "./AccessNotAuthorizedPage.jsx";
import SignInPage from "./SignInPage.jsx";
import ProfileSettingsPage from "./ProfileSettingsPage.jsx";
import ProfileSetupPage from "./ProfileSetupPage.jsx";
import { ProfileSessionProvider } from "../components/app/ProfileSession.jsx";
import OperatorMenu from "../components/app/OperatorMenu.jsx";
import ProfileSwitcher from "../components/app/ProfileSwitcher.jsx";
import SettingsPage from "./SettingsPage.jsx";

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

function fileOf(bytes, { name = "DJ-Coast.png", type = "image/png" } = {}) {
  return new File([new Uint8Array(bytes)], name, { type });
}

function chooseFile(file) {
  const input = document.getElementById("profile-image");
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  fireEvent.change(input);
}

function stubImage({ width = 500, height = 500, fail = false } = {}) {
  class FakeImage {
    set src(_value) {
      this.naturalWidth = width;
      this.naturalHeight = height;
      this.width = width;
      this.height = height;
      queueMicrotask(() => {
        if (fail) this.onerror?.(new Error("decode"));
        else this.onload?.();
      });
    }
  }
  vi.stubGlobal("Image", FakeImage);
}

describe("auth and profile chrome", () => {
  it("renders Google sign-in without a password form", () => {
    render(<SignInPage />);
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByText(/sign in to your regeneluxe account/i)).toBeInTheDocument();
    expect(screen.getByText(/social campaign command center/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /signed out/i })).not.toBeInTheDocument();
  });

  it("shows a signed-out confirmation without treating it as an error", () => {
    render(<SignInPage signedOut />);
    expect(screen.getByRole("heading", { name: /^signed out$/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/successfully signed out of regeneluxe/i);
    expect(screen.getByRole("status")).toHaveTextContent(/no longer active in this browser/i);
    expect(screen.getByRole("status")).toHaveTextContent(/sign in to your regeneluxe account/i);
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/private access/i)).not.toBeInTheDocument();
  });

  it("keeps error messaging off the signed-out confirmation", () => {
    render(<SignInPage signedOut errorMessage="Sign-in could not be completed." />);
    expect(screen.getByRole("heading", { name: /^signed out$/i })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/sign-in could not be completed/i)).not.toBeInTheDocument();
  });

  it("renders an access-not-authorized screen", () => {
    render(<AccessNotAuthorizedPage />);
    expect(screen.getByRole("heading", { name: /access not authorized/i })).toBeInTheDocument();
    expect(screen.getByText(/sign in with an approved google account/i)).toBeInTheDocument();
  });

  it("shows the active managed profile identity when only one profile exists", () => {
    render(
      <MemoryRouter>
        <ProfileSessionProvider
          operator={{ id: "opr_1", name: "DJ Coast", email: "djcoast239@gmail.com" }}
          profiles={[{ id: "prf_1", displayName: "DJ Coast" }]}
          activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
        >
          <ProfileSwitcher />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("DJ Coast")).toBeInTheDocument();
    expect(screen.getAllByText("Active profile").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /dj coast/i }));
    expect(screen.getByRole("menuitem", { name: /edit profile/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /view profile/i })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("becomes a switcher when more than one profile exists", () => {
    render(
      <MemoryRouter>
        <ProfileSessionProvider
          operator={{ id: "opr_1", name: "DJ Coast", email: "djcoast239@gmail.com" }}
          profiles={[
            { id: "prf_1", displayName: "DJ Coast" },
            { id: "prf_2", displayName: "Second" },
          ]}
          activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
        >
          <ProfileSwitcher />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("combobox", { name: /switch profile/i })).toBeInTheDocument();
  });

  it("labels the signed-in Google account separately from the profile", () => {
    render(
      <ProfileSessionProvider
        operator={{ id: "opr_1", name: "Coast Ent", email: "djcoast239@gmail.com" }}
        profiles={[{ id: "prf_1", displayName: "DJ Coast" }]}
        activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
      >
        <OperatorMenu />
      </ProfileSessionProvider>,
    );
    expect(screen.getByText("Coast Ent")).toBeInTheDocument();
    expect(screen.getByText("djcoast239@gmail.com")).toBeInTheDocument();
    expect(screen.getByText("Signed in with Google")).toBeInTheDocument();
    expect(screen.queryByText("validsstudio@gmail.com")).not.toBeInTheDocument();
  });
});

describe("profile setup image and field diagnostics", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
    globalThis.URL.revokeObjectURL = vi.fn();
    stubImage({ width: 500, height: 500 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("previews a valid 500 × 500 PNG with filename, dimensions, and size", async () => {
    render(<ProfileSetupPage operator={{ name: "Studio" }} />);
    chooseFile(fileOf(411_229));
    expect(await screen.findByText("DJ-Coast.png")).toBeInTheDocument();
    expect(screen.getByText("500 × 500")).toBeInTheDocument();
    expect(screen.getByText("402 KB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /replace image/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove image/i })).toBeInTheDocument();
    expect(screen.queryByText(/choose an image under/i)).not.toBeInTheDocument();
  });

  it("shows a MIME-specific error for SVG and does not treat it as a size error", async () => {
    render(<ProfileSetupPage />);
    chooseFile(fileOf(80_000, { name: "mark.svg", type: "image/svg+xml" }));
    expect(await screen.findByText("PNG, JPG, or WebP images are supported.")).toBeInTheDocument();
    expect(screen.queryByText(/500 kb/i)).not.toBeInTheDocument();
  });

  it("shows a bad-email error on blur", () => {
    render(<ProfileSetupPage />);
    const email = screen.getByLabelText(/primary email/i);
    fireEvent.change(email, { target: { value: "not-an-email" } });
    fireEvent.blur(email);
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("shows a URL error on blur and does not error a blank website", () => {
    render(<ProfileSetupPage />);
    const publicLink = screen.getByLabelText(/primary public link/i);
    fireEvent.change(publicLink, { target: { value: "youtube.com/@x" } });
    fireEvent.blur(publicLink);
    fireEvent.blur(screen.getByLabelText(/^website$/i));
    expect(screen.getByText("Enter a complete URL beginning with http:// or https://.")).toBeInTheDocument();
  });

  it("focuses the first invalid field on save", () => {
    render(<ProfileSetupPage />);
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));
    expect(screen.getByText("Please fix 5 fields before saving.")).toBeInTheDocument();
    expect(screen.getByLabelText(/profile name/i)).toHaveFocus();
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("clears a field error as soon as the value is corrected", () => {
    render(<ProfileSetupPage />);
    const name = screen.getByLabelText(/profile name/i);
    fireEvent.blur(name);
    expect(screen.getByText("Enter a profile name.")).toBeInTheDocument();
    fireEvent.change(name, { target: { value: "DJ Coast" } });
    expect(screen.queryByText("Enter a profile name.")).not.toBeInTheDocument();
  });

  it("does not flash an error on an untouched optional website", () => {
    render(<ProfileSetupPage />);
    expect(screen.queryByText(/enter a complete url/i)).not.toBeInTheDocument();
  });

  it("offers Snapchat, Twitch, and Kick as main platforms", () => {
    render(<ProfileSetupPage />);
    expect(screen.getByRole("button", { name: "Snapchat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Twitch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kick" })).toBeInTheDocument();
  });
});

describe("profile settings edit", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
    globalThis.URL.revokeObjectURL = vi.fn();
    stubImage({ width: 500, height: 500 });
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, profile: { id: "prf_1", displayName: "DJ Coast" } }),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const profile = {
    id: "prf_1",
    displayName: "DJ Coast",
    slug: "dj-coast",
    primaryEmail: "djcoast239@gmail.com",
    primaryPublicUrl: "https://www.youtube.com/@CoastEntertainment",
    website: "",
    platforms: ["YouTube"],
    status: "ACTIVE",
    avatarUrl: "/api/media/med_1",
  };

  it("edits the active profile without first-run onboarding copy", () => {
    render(
      <MemoryRouter>
        <ProfileSessionProvider
          operator={{ id: "opr_1", name: "DJ Coast", email: "djcoast239@gmail.com" }}
          profiles={[profile]}
          activeProfile={profile}
        >
          <ProfileSettingsPage />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /edit profile/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/profile name/i)).toHaveValue("DJ Coast");
    expect(screen.getByRole("button", { name: /change image/i })).toBeInTheDocument();
    expect(screen.queryByText(/create the first managed profile/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Snapchat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Twitch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kick" })).toBeInTheDocument();
  });

  it("replaces a profile image through the validated picker", async () => {
    render(
      <MemoryRouter>
        <ProfileSessionProvider profiles={[profile]} activeProfile={profile}>
          <ProfileSettingsPage />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    chooseFile(fileOf(411_229));
    expect(await screen.findByText("DJ-Coast.png")).toBeInTheDocument();
    expect(screen.getByText("500 × 500")).toBeInTheDocument();
  });

  it("removes the current profile image", () => {
    render(
      <MemoryRouter>
        <ProfileSessionProvider profiles={[profile]} activeProfile={profile}>
          <ProfileSettingsPage />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /remove image/i }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /change image/i }).length).toBeGreaterThan(0);
  });
});

describe("settings Gmail connection chrome", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, providers: [] }),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows Connect Gmail when the active profile mailbox is not connected", () => {
    render(
      <MemoryRouter>
        <ProfileSessionProvider
          operator={{ id: "opr_1", name: "Coast Ent", email: "djcoast239@gmail.com" }}
          profiles={[{ id: "prf_1", displayName: "DJ Coast" }]}
          activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
          connections={{
            googleAccount: { status: "CONNECTED", email: "djcoast239@gmail.com" },
            gmail: { kind: "GMAIL", status: "NOT_CONNECTED" },
            youtube: { kind: "YOUTUBE", status: "NOT_CONNECTED" },
          }}
        >
          <SettingsPage />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /account/i })).toBeInTheDocument();
    expect(screen.queryByText("Google operator")).not.toBeInTheDocument();
    expect(screen.getAllByText(/djcoast239@gmail.com/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/validsstudio@gmail.com/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Gmail").length).toBeGreaterThan(0);
    expect(screen.getAllByText("YouTube").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not connected").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /connect gmail/i })).toHaveAttribute("href", "/api/oauth/gmail/start");
    expect(screen.getByRole("link", { name: /connect youtube/i })).toHaveAttribute("href", "/api/oauth/youtube/start");
  });

  it("shows the connected mailbox with Sync now, Reconnect, and Disconnect", () => {
    render(
      <MemoryRouter>
        <ProfileSessionProvider
          operator={{ id: "opr_1", name: "Coast Ent", email: "djcoast239@gmail.com" }}
          profiles={[{ id: "prf_1", displayName: "DJ Coast" }]}
          activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
          connections={{
            gmail: {
              kind: "GMAIL",
              status: "CONNECTED",
              email: "djcoast239@gmail.com",
              permission: "readonly",
              indexedCount: 12,
              lastSuccessfulSyncAt: "2024-04-01T00:00:00.000Z",
            },
            youtube: { kind: "YOUTUBE", status: "NOT_CONNECTED" },
          }}
        >
          <SettingsPage />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    expect(screen.getAllByText(/djcoast239@gmail.com/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Authorized account: djcoast239@gmail.com/i)).toBeInTheDocument();
    expect(screen.getByText(/Permission: Read only/i)).toBeInTheDocument();
    expect(screen.getByText(/Messages indexed: 12/i)).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /sync now/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /reconnect/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /connect gmail/i })).not.toBeInTheDocument();
  });

  it("offers Reconnect Gmail after a refresh failure", () => {
    render(
      <MemoryRouter>
        <ProfileSessionProvider
          operator={{ id: "opr_1", name: "Coast Ent", email: "djcoast239@gmail.com" }}
          profiles={[{ id: "prf_1", displayName: "DJ Coast" }]}
          activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
          connections={{
            gmail: { kind: "GMAIL", status: "RECONNECT_REQUIRED", email: "djcoast239@gmail.com" },
            youtube: { kind: "YOUTUBE", status: "NOT_CONNECTED" },
          }}
        >
          <SettingsPage />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /reconnect gmail/i })).toHaveAttribute("href", "/api/oauth/gmail/start");
  });

  it("lets the operator pick Coast Entertainment from discovered channels", () => {
    render(
      <MemoryRouter>
        <ProfileSessionProvider
          operator={{ id: "opr_1", name: "Coast Ent", email: "djcoast239@gmail.com" }}
          profiles={[{ id: "prf_1", displayName: "DJ Coast" }]}
          activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
          connections={{
            gmail: { kind: "GMAIL", status: "NOT_CONNECTED" },
            youtube: {
              kind: "YOUTUBE",
              status: "CONNECTED",
              pendingChannels: [
                { id: "UCother", title: "Other Channel", handle: "@other" },
                { id: "UCCoast", title: "Coast Entertainment", handle: "@CoastEntertainment", subscriberCount: 41 },
              ],
            },
          }}
        >
          <SettingsPage />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("Coast Entertainment")).toBeInTheDocument();
    expect(screen.getByText(/@CoastEntertainment/)).toBeInTheDocument();
  });

  it("shows Connected and Synced when Turso health is configured", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (String(url).includes("/api/db/health")) {
        return {
          ok: true,
          json: async () => ({
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
          }),
        };
      }
      return { ok: true, json: async () => ({ ok: true, providers: [] }) };
    }));
    render(
      <MemoryRouter>
        <ProfileSessionProvider
          operator={{ id: "opr_1", name: "Coast Ent", email: "djcoast239@gmail.com" }}
          profiles={[{ id: "prf_1", displayName: "DJ Coast" }]}
          activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
        >
          <SettingsPage />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText(/Cloud database · Connected/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Cloud sync · Synced/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending operations · 0/)).toBeInTheDocument();
    expect(screen.queryByText(/Offline \(not configured\)/i)).not.toBeInTheDocument();
  });

  it("refreshes cloud sync status after Sync now", async () => {
    let synced = false;
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      if (String(url).includes("/api/sync") && String(init?.method || "GET").toUpperCase() === "POST") {
        synced = true;
        return { ok: true, json: async () => ({ ok: true }) };
      }
      if (String(url).includes("/api/db/health")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            local: { healthy: true },
            sync: synced
              ? { cloudConfigured: true, cloudReachable: true, state: "SYNCED", pendingOutbox: 0, localHealthy: true }
              : { cloudConfigured: true, cloudReachable: true, state: "PENDING", pendingOutbox: 2, localHealthy: true },
          }),
        };
      }
      return { ok: true, json: async () => ({ ok: true, providers: [] }) };
    }));
    render(
      <MemoryRouter>
        <ProfileSessionProvider
          operator={{ id: "opr_1", name: "Coast Ent", email: "djcoast239@gmail.com" }}
          profiles={[{ id: "prf_1", displayName: "DJ Coast" }]}
          activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
        >
          <SettingsPage />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText(/Cloud sync · Pending/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /^sync now$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Cloud sync · Synced/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Pending operations · 0/)).toBeInTheDocument();
  });

  it("lists Snapchat, Twitch, and Kick as unsupported social connections", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        providers: [
          { provider: "snapchat", displayName: "Snapchat", readiness: "UNSUPPORTED", capabilities: [] },
          { provider: "twitch", displayName: "Twitch", readiness: "UNSUPPORTED", capabilities: [] },
          { provider: "kick", displayName: "Kick", readiness: "UNSUPPORTED", capabilities: [] },
        ],
      }),
    })));
    render(
      <MemoryRouter>
        <ProfileSessionProvider
          operator={{ id: "opr_1", name: "DJ Coast", email: "djcoast239@gmail.com" }}
          profiles={[{ id: "prf_1", displayName: "DJ Coast" }]}
          activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
        >
          <SettingsPage />
        </ProfileSessionProvider>
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Snapchat").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Twitch").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kick").length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getAllByText("Unsupported").length).toBeGreaterThanOrEqual(3);
    });
  });
});
