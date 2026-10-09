import { MemoryRouter } from "@/nav";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AccountsPage from "./AccountsPage.jsx";
import { ProfileSessionProvider } from "../components/app/ProfileSession.jsx";
import { listAccounts } from "../data/accountRepository.js";

vi.mock("../data/accountPreview.js", () => ({
  isAccountPreviewEnabled: () => false,
  accountPreviewMode: () => "",
}));

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

describe("production account previews", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, providers: [] }) })));
  });

  it("ignores the picker, connected fixture, and manual form", () => {
    const { unmount } = renderAt("/accounts?preview=picker");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();

    renderAt("/accounts?preview=connected");
    expect(screen.queryByText("Preview")).not.toBeInTheDocument();
    expect(screen.queryByText("@djcoast")).not.toBeInTheDocument();
    expect(screen.getByText(/no social accounts added yet/i)).toBeInTheDocument();
    unmount();

    renderAt("/accounts?preview=manual");
    expect(screen.queryByRole("dialog", { name: /add manually/i })).not.toBeInTheDocument();
    expect(listAccounts()).toHaveLength(0);
  });
});
