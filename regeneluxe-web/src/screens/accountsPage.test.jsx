import { MemoryRouter } from "@/nav";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AccountsPage from "./AccountsPage.jsx";
import WorkspaceProviders from "../components/app/WorkspaceProviders.jsx";
import { ProfileSessionProvider } from "../components/app/ProfileSession.jsx";
import { createAccount, listAccounts } from "../data/accountRepository.js";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("../../app/actions/auth", () => ({
  signInWithGoogle: () => {},
  signOutOperator: () => {},
}));

vi.mock("../data/durableBootstrap.js", () => ({
  bootstrapDurableStore: vi.fn(async () => ({})),
  fetchDbHealth: vi.fn(async () => ({})),
  getLastSyncStatus: vi.fn(() => null),
  reconcileCloud: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: routerPush }),
  usePathname: () => "/accounts",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}));

const session = {
  operator: { id: "opr_1", name: "Coast Ent", email: "djcoast239@gmail.com" },
  profiles: [{ id: "prf_1", displayName: "DJ Coast" }],
  activeProfile: { id: "prf_1", displayName: "DJ Coast" },
};

function renderAccounts() {
  return render(
    <MemoryRouter>
      <ProfileSessionProvider {...session}>
        <AccountsPage />
      </ProfileSessionProvider>
    </MemoryRouter>,
  );
}

function renderAccountsInWorkspace() {
  return render(
    <MemoryRouter>
      <WorkspaceProviders {...session}>
        <AccountsPage />
      </WorkspaceProviders>
    </MemoryRouter>,
  );
}

function typeHandle(input, text) {
  let value = "";
  for (const char of text) {
    value += char;
    fireEvent.keyDown(input, { key: char, bubbles: true });
    fireEvent.change(input, { target: { value } });
    expect(screen.getByRole("dialog", { name: /add manually/i })).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(input).toHaveValue(value);
  }
  return value;
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
    expect(screen.getAllByRole("button", { name: /connect account/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /add manually/i }).length).toBeGreaterThan(0);
  });

  it("renders one card per social account", async () => {
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
    expect(await screen.findByText("Coast IG")).toBeInTheDocument();
    expect(screen.getByText("Coast YT")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^manage$/i })).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: /add account/i })).not.toBeInTheDocument();
  });

  it("opens platform-specific add fields and never marks a pasted URL Connected", () => {
    renderAccounts();
    fireEvent.click(screen.getAllByRole("button", { name: /add manually/i })[0]);
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

  it("lets Manage edit identifiers without exposing provider identity fields", async () => {
    createAccount({
      id: "acc_ig",
      platform: "Instagram",
      displayName: "Coast IG",
      handle: "@djcoast",
      connectionState: "SETUP_REQUIRED",
    });
    renderAccounts();
    fireEvent.click(await screen.findByRole("button", { name: /^manage$/i }));
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^handle$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/profile url/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/provider account id/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Setup required").length).toBeGreaterThan(0);
    expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "DJ Coast IG" } });
    fireEvent.click(screen.getByRole("button", { name: /save identifiers/i }));
    expect(screen.getByDisplayValue("DJ Coast IG")).toBeInTheDocument();
  });

  it("shows Unknown instead of Connected for an unrecognized account state", async () => {
    createAccount({
      platform: "Instagram",
      displayName: "Odd Account",
      handle: "@odd",
      connectionState: "BANANA",
    });
    renderAccounts();
    expect(await screen.findByText("Odd Account")).toBeInTheDocument();
    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
    expect(screen.queryByText("Setup required")).not.toBeInTheDocument();
  });

  it("keeps the add-account modal stable while an Instagram identity is typed", () => {
    routerPush.mockClear();
    renderAccountsInWorkspace();
    const before = listAccounts().length;
    fireEvent.click(screen.getAllByRole("button", { name: /add manually/i })[0]);
    fireEvent.change(screen.getByLabelText(/^platform$/i), { target: { value: "Instagram" } });

    const input = screen.getByLabelText(/instagram profile url or @handle/i);
    const submit = screen.getAllByRole("button", { name: "Add manually" }).find((button) => button.getAttribute("type") === "submit");
    expect(submit).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("type", "button");
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("type", "button");
    input.focus();

    typeHandle(input, "@");
    typeHandle(input, "@djcoast");
    expect(listAccounts()).toHaveLength(before);
    expect(routerPush).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: /add manually/i })).toBeInTheDocument();
    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
    expect(listAccounts()).toHaveLength(before);

    const name = screen.getByLabelText(/^display name$/i);
    expect(name).toHaveValue("@djcoast");
    fireEvent.change(name, { target: { value: "DJ Coast IG" } });
    typeHandle(input, "@djcoast");
    expect(name).toHaveValue("DJ Coast IG");
    expect(input).toHaveFocus();

    fireEvent.keyDown(input, { key: "Tab" });
    expect(screen.getByRole("dialog", { name: /add manually/i })).toBeInTheDocument();
    name.focus();
    expect(input).toHaveValue("@djcoast");
    expect(listAccounts()).toHaveLength(before);

    fireEvent.change(screen.getByLabelText(/^platform$/i), { target: { value: "YouTube" } });
    expect(screen.getByRole("dialog", { name: /add manually/i })).toBeInTheDocument();
    expect(listAccounts()).toHaveLength(before);
    fireEvent.change(screen.getByLabelText(/^platform$/i), { target: { value: "Instagram" } });

    fireEvent.click(submit);
    const created = listAccounts().find((account) => account.displayName === "DJ Coast IG");
    expect(created?.handle).toBe("@djcoast");
    expect(created?.connectionState).not.toBe("CONNECTED");
    expect(screen.queryByRole("dialog", { name: /add manually/i })).not.toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("accepts a full Instagram URL without creating an account or closing", () => {
    routerPush.mockClear();
    renderAccountsInWorkspace();
    const before = listAccounts().length;
    fireEvent.click(screen.getAllByRole("button", { name: /add manually/i })[0]);
    const input = screen.getByLabelText(/instagram profile url or @handle/i);
    input.focus();
    const url = "https://www.instagram.com/djcoast/";
    typeHandle(input, url);
    expect(screen.getByText(/detected: instagram/i)).toBeInTheDocument();
    expect(screen.getByText(/not connected/i)).toBeInTheDocument();
    expect(listAccounts()).toHaveLength(before);
    expect(routerPush).not.toHaveBeenCalled();

    const shortened = url.slice(0, -1);
    fireEvent.change(input, { target: { value: shortened } });
    expect(input).toHaveFocus();
    expect(input).toHaveValue(shortened);
    expect(screen.getByRole("dialog", { name: /add manually/i })).toBeInTheDocument();
    expect(listAccounts()).toHaveLength(before);
  });

  it("closes the composer from Cancel or X without creating an account", () => {
    renderAccountsInWorkspace();
    const before = listAccounts().length;

    fireEvent.click(screen.getAllByRole("button", { name: /add manually/i })[0]);
    const input = screen.getByLabelText(/instagram profile url or @handle/i);
    input.focus();
    typeHandle(input, "@dj");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: /add manually/i })).not.toBeInTheDocument();
    expect(listAccounts()).toHaveLength(before);

    fireEvent.click(screen.getAllByRole("button", { name: /add manually/i })[0]);
    const again = screen.getByLabelText(/instagram profile url or @handle/i);
    again.focus();
    typeHandle(again, "@dj");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: /add manually/i })).not.toBeInTheDocument();
    expect(listAccounts()).toHaveLength(before);
  });

  it("does not navigate when a letter is pressed on the sheet close button", () => {
    routerPush.mockClear();
    renderAccountsInWorkspace();
    fireEvent.click(screen.getAllByRole("button", { name: /add manually/i })[0]);
    const close = screen.getByRole("button", { name: "Close" });
    close.focus();
    fireEvent.keyDown(close, { key: "c" });
    expect(routerPush).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: /add manually/i })).toBeInTheDocument();
  });
});
