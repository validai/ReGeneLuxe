import { MemoryRouter } from "@/nav";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AppShellNext from "./AppShellNext.jsx";
import { ProfileSessionProvider } from "./ProfileSession.jsx";
import { createAccount } from "../../data/accountRepository.js";
import { getSidebarCollapsed, setSidebarCollapsed } from "../../data/uiPrefs.js";

vi.mock("../../../app/actions/auth", () => ({
  signInWithGoogle: () => {},
  signOutOperator: () => {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}));

function renderShell({ collapsed = false } = {}) {
  setSidebarCollapsed(collapsed);
  return render(
    <MemoryRouter>
      <ProfileSessionProvider
        operator={{ id: "opr_1", name: "Coast Ent", email: "djcoast239@gmail.com" }}
        profiles={[{ id: "prf_1", displayName: "DJ Coast" }]}
        activeProfile={{ id: "prf_1", displayName: "DJ Coast" }}
      >
        <AppShellNext onOpenCommand={() => {}}>
          <div>Main</div>
        </AppShellNext>
      </ProfileSessionProvider>
    </MemoryRouter>,
  );
}

describe("workspace shell sidebar states", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders expanded desktop labels and a collapse control", () => {
    renderShell({ collapsed: false });
    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toBeInTheDocument();
    const expanded = document.querySelector('[data-sidebar-state="expanded"]');
    expect(expanded.getAttribute("data-sidebar-rail")).toBe("permanent");
    expect(expanded.getAttribute("data-sidebar-panel")).toBe("open");
    expect(expanded.querySelector('[data-sidebar-chevron="left"]')).toBeTruthy();
    expect(expanded.querySelector('[data-brand="regeneluxe"]')).toBeTruthy();
    expect(expanded.textContent).toContain("ReGeneLuxe");
    expect(screen.queryByText("R")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^dashboard$/i })).toHaveTextContent("Dashboard");
    expect(screen.getByText("DJ Coast")).toBeInTheDocument();
    expect(screen.getByText("djcoast239@gmail.com")).toBeInTheDocument();
    expect(screen.getByText(/add social account/i)).toBeInTheDocument();
  });

  it("renders compact icons without clipped card labels", async () => {
    renderShell({ collapsed: true });
    expect(await screen.findByRole("button", { name: /expand sidebar/i })).toBeInTheDocument();
    expect(screen.queryByText("Collapse")).not.toBeInTheDocument();
    expect(screen.queryByText("Signed in with Google")).not.toBeInTheDocument();
    const compact = document.querySelector('[data-sidebar-state="compact"]');
    expect(compact).toBeTruthy();
    expect(compact.getAttribute("data-sidebar-rail")).toBe("permanent");
    expect(compact.getAttribute("data-sidebar-panel")).toBe("hidden");
    expect(compact.querySelector('[data-sidebar-chevron="right"]')).toBeTruthy();
    expect(compact.querySelector(".overflow-x-hidden")).toBeTruthy();
    expect(compact.className).toMatch(/shrink-0/);
    expect(compact.querySelector('[data-brand="regeneluxe"]')).toBeTruthy();
    expect(compact.textContent).not.toContain("ReGeneLuxe");
    expect(screen.queryByText(/^R$/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("expands immediately from the compact control and persists the preference", async () => {
    renderShell({ collapsed: true });
    fireEvent.click(await screen.findByRole("button", { name: /expand sidebar/i }));
    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toBeInTheDocument();
    expect(getSidebarCollapsed()).toBe(false);
    expect(localStorage.getItem("regeneluxe.sidebarCollapsed")).toBe("0");
  });

  it("opens a mobile drawer with full labels and closes it from the overlay", () => {
    renderShell({ collapsed: false });
    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    expect(document.querySelector('[data-sidebar-state="drawer"]')).toBeTruthy();
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /close navigation/i })[0]);
    expect(document.querySelector('[data-sidebar-state="drawer"]')).toBeFalsy();
  });

  it("shows a social-channel picker, not a workspace switcher", async () => {
    createAccount({
      platform: "Instagram",
      displayName: "Coast IG",
      handle: "@djcoast",
      connectionState: "MANUAL_ONLY",
    });
    renderShell({ collapsed: false });
    expect(await screen.findByLabelText(/social channel filter/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/switch profile/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/switch brand/i)).not.toBeInTheDocument();
  });
});
