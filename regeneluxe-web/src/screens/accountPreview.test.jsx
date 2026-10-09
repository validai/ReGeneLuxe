import { MemoryRouter } from "@/nav";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AccountsPage from "./AccountsPage.jsx";
import { ProfileSessionProvider } from "../components/app/ProfileSession.jsx";
import { listAccounts } from "../data/accountRepository.js";

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
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
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

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ProfileSessionProvider {...session}>
        <AccountsPage />
      </ProfileSessionProvider>
    </MemoryRouter>,
  );
}

describe("development account previews", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      if (String(url).includes("/api/connections/session") && init?.method === "POST") {
        throw new Error("preview must not call the connection session API");
      }
      return { ok: true, json: async () => ({ ok: true, providers: [] }) };
    }));
  });

  it("shows the provider picker without starting OAuth", () => {
    renderAt("/accounts?preview=picker");
    expect(screen.getByRole("dialog", { name: /connect an account/i })).toBeInTheDocument();
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(listAccounts()).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining("/api/connections/session"), expect.anything());
  });

  it("shows the Instagram continue step with authorization disabled", () => {
    renderAt("/accounts?preview=instagram");
    expect(screen.getByText("Connecting: Instagram")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Meta" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Meta" }));
    expect(listAccounts()).toHaveLength(0);
  });

  it("shows destination choices without creating accounts", () => {
    renderAt("/accounts?preview=destinations");
    expect(screen.getAllByRole("checkbox").every((box) => box.checked === false)).toBe(true);
    expect(screen.getByRole("button", { name: "Add selected" })).toBeDisabled();
    expect(listAccounts()).toHaveLength(0);
  });

  it("shows the manual form and refuses submission", () => {
    renderAt("/accounts?preview=manual");
    const submit = screen.getAllByRole("button", { name: "Add manually" }).find((button) => button.getAttribute("type") === "submit");
    expect(submit).toBeDisabled();
    fireEvent.submit(screen.getByRole("dialog", { name: /add manually/i }).querySelector("form"));
    expect(listAccounts()).toHaveLength(0);
    expect(listAccounts().some((account) => account.id === "preview_connected")).toBe(false);
  });

  it("renders a connected card fixture without storing it", () => {
    renderAt("/accounts?preview=connected");
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText("@djcoast")).toBeInTheDocument();
    expect(listAccounts()).toHaveLength(0);
  });
});
