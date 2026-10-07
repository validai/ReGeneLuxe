import { MemoryRouter } from "@/nav";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AccountsPage from "./AccountsPage.jsx";
import { ProfileSessionProvider } from "../components/app/ProfileSession.jsx";
import { createAccount } from "../data/accountRepository.js";

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

function renderAccounts() {
  return render(
    <MemoryRouter>
      <ProfileSessionProvider
        operator={{ id: "opr_1", name: "Coast Ent", email: "djcoast239@gmail.com" }}
        profiles={[{ id: "prf_1", displayName: "DJ Coast" }]}
        activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
      >
        <AccountsPage />
      </ProfileSessionProvider>
    </MemoryRouter>,
  );
}

describe("Social Accounts page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, providers: [] }),
    })));
  });

  it("shows a polished empty state without fake accounts", () => {
    renderAccounts();
    expect(screen.getByText(/no social accounts added yet/i)).toBeInTheDocument();
    expect(screen.getByText(/social accounts and channels for dj coast/i)).toBeInTheDocument();
    expect(screen.queryByText(/active profile/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /add social account/i }).length).toBeGreaterThan(0);
  });

  it("renders one card per social account", () => {
    createAccount({
      platform: "Instagram",
      displayName: "Coast IG",
      handle: "@djcoast",
      profileUrl: "https://www.instagram.com/djcoast/",
      connectionState: "MANUAL_ONLY",
    });
    createAccount({
      platform: "YouTube",
      displayName: "Coast YT",
      handle: "@CoastEntertainment",
      connectionState: "NOT_CONNECTED",
    });
    renderAccounts();
    expect(screen.getByText("Coast IG")).toBeInTheDocument();
    expect(screen.getByText("Coast YT")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^manage$/i })).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: /add account/i })).not.toBeInTheDocument();
  });

  it("opens platform-specific add fields and never marks a pasted URL Connected", () => {
    renderAccounts();
    fireEvent.click(screen.getAllByRole("button", { name: /add social account/i })[0]);
    expect(screen.getByText(/identifier only/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/instagram profile url or @handle/i), {
      target: { value: "https://www.instagram.com/djcoast/" },
    });
    expect(screen.getByText(/detected: instagram/i)).toBeInTheDocument();
    expect(screen.getByText(/not connected/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Connected$/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^platform$/i), { target: { value: "YouTube" } });
    expect(screen.getByLabelText(/youtube channel url/i)).toBeInTheDocument();
  });

  it("lets Manage edit identifiers without exposing provider identity fields", () => {
    createAccount({
      id: "acc_ig",
      platform: "Instagram",
      displayName: "Coast IG",
      handle: "@djcoast",
      connectionState: "SETUP_REQUIRED",
    });
    renderAccounts();
    fireEvent.click(screen.getByRole("button", { name: /^manage$/i }));
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^handle$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/profile url/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/provider account id/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "DJ Coast IG" } });
    fireEvent.click(screen.getByRole("button", { name: /save identifiers/i }));
    expect(screen.getByDisplayValue("DJ Coast IG")).toBeInTheDocument();
  });
});
