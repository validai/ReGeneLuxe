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
    const expandedChevron = expanded.querySelector('[data-sidebar-chevron="left"]');
    expect(expandedChevron).toBeTruthy();
    expect(expandedChevron.className).toContain("left-full");
    expect(expandedChevron.className).toContain("top-14");
    expect(expanded.querySelector('[data-brand-anchor="R"]')?.textContent).toBe("R");
    expect(expanded.querySelector('[data-brand-spell="open"]')?.textContent).toBe("eGeneLuxe");
    expect(expanded.getAttribute("data-sidebar-expand")).toBe("360ms");
    expect(expanded.getAttribute("data-sidebar-breakpoint")).toBe("640px");
    expect(expanded.className).toMatch(/\bsm:flex\b/);
    expect(expanded.className).not.toMatch(/\blg:flex\b/);
    expect(document.querySelector("[data-sidebar-menu='phone']")?.className).toMatch(/\bsm:hidden\b/);
    expect(document.querySelector("[data-sidebar-backdrop]")).toBeNull();
    expect(screen.getByRole("link", { name: /^dashboard$/i })).toHaveTextContent("Dashboard");
    expect(screen.getByText("DJ Coast")).toBeInTheDocument();
    expect(screen.getByText("djcoast239@gmail.com")).toBeInTheDocument();
    expect(screen.getByText(/connect account/i)).toBeInTheDocument();
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
    const compactChevron = compact.querySelector('[data-sidebar-chevron="right"]');
    expect(compactChevron).toBeTruthy();
    expect(compactChevron.className).toContain("left-full");
    expect(compactChevron.className).toContain("top-14");
    expect(compact.querySelector(".overflow-x-hidden")).toBeTruthy();
    expect(compact.className).toMatch(/shrink-0/);
    expect(compact.querySelector('[data-brand-anchor="R"]')?.textContent).toBe("R");
    expect(compact.querySelector('[data-brand-spell="closed"]')).toBeTruthy();
    expect(compact.className).toMatch(/w-sidebar-collapsed/);
    expect(compact.className).toMatch(/\bsm:flex\b/);
    expect(compact.className).not.toMatch(/\blg:flex\b/);
    expect(compact.querySelector('[aria-label^="Signed in"]')).toBeNull();
    expect(compact.querySelector("[data-sidebar-utility]")?.lastElementChild?.getAttribute("aria-label")).toBe("Settings");
    expect(compact.getAttribute("data-sidebar-collapse")).toBe("280ms");
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
    const drawer = document.querySelector('[data-sidebar-state="drawer"]');
    expect(drawer).toBeTruthy();
    expect(drawer.className).toMatch(/\bsm:hidden\b/);
    expect(drawer.querySelector("[data-sidebar-backdrop='overlay']")).toBeTruthy();
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /close navigation/i })[0]);
    expect(document.querySelector('[data-sidebar-state="drawer"]')).toBeFalsy();
  });

  it("keeps the permanent rail at tablet widths and the drawer under 640px", () => {
    renderShell({ collapsed: true });
    const rail = document.querySelector('[data-sidebar-state="compact"]');
    expect(rail.className).toContain("hidden");
    expect(rail.className).toContain("sm:flex");
    expect(rail.className).toContain("w-sidebar-collapsed");
    expect(rail.className).not.toContain("lg:flex");
    renderShell({ collapsed: false });
    const expanded = document.querySelector('[data-sidebar-state="expanded"]');
    expect(expanded.className).toContain("w-sidebar");
    expect(expanded.className).toContain("min-w-[15rem]");
    expect(document.querySelector("[data-sidebar-menu='phone']").className).toContain("sm:hidden");
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
