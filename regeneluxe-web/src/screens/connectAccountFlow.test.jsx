import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "@/nav";
import ConnectAccountSheet from "../components/app/ConnectAccountSheet.jsx";
import PublishDestinations from "../components/app/PublishDestinations.jsx";
import { PREVIEW_DESTINATIONS } from "../data/connectionFlow.js";
import { createAccount, listAccounts } from "../data/accountRepository.js";

const definitions = [
  { provider: "instagram", readiness: "IMPLEMENTED" },
  { provider: "facebook", readiness: "SETUP_REQUIRED" },
  { provider: "threads", readiness: "PROVIDER_REVIEW_REQUIRED" },
  { provider: "youtube", readiness: "IMPLEMENTED" },
];

describe("Connect account experience", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the provider picker and does not ask for a handle before authorization", () => {
    const onStart = vi.fn(async () => ({ authUrl: "https://provider.test/oauth" }));
    render(
      <MemoryRouter>
        <ConnectAccountSheet open workspaceName="DJ Coast" definitions={definitions} onStart={onStart} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /instagram/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /facebook/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /threads/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /youtube/i })).toBeInTheDocument();
    expect(screen.getAllByText("Ready to connect").length).toBeGreaterThan(0);
    expect(screen.getByText("Setup required")).toBeInTheDocument();
    expect(screen.getByText("Provider review required")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tiktok/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /instagram/i }));
    expect(screen.getByText("Connecting: Instagram")).toBeInTheDocument();
    expect(screen.getByText("Workspace: DJ Coast")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Meta" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/handle/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/profile url/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: /facebook/i }));
    expect(screen.getByText("This provider is not ready to authorize yet.")).toBeInTheDocument();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("leaves destination checkboxes clear until the operator selects them", () => {
    const onConfirm = vi.fn(async () => ({ ok: true }));
    const onCancel = vi.fn();
    render(
      <MemoryRouter>
        <ConnectAccountSheet
          open
          initialStep="destinations"
          initialProvider="instagram"
          workspaceName="DJ Coast"
          destinations={PREVIEW_DESTINATIONS}
          onConfirm={onConfirm}
          onCancelSession={onCancel}
        />
      </MemoryRouter>,
    );

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    expect(boxes.every((box) => box.checked === false)).toBe(true);
    expect(screen.getByRole("button", { name: "Add selected" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(listAccounts()).toHaveLength(0);

    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    fireEvent.click(screen.getByRole("button", { name: "Add selected" }));
    expect(onConfirm).toHaveBeenCalledWith(
      ["instagram:ig_preview", "facebook:page_preview"],
      {},
    );
  });

  it("shows connected destinations in the composer and blocks the others", () => {
    createAccount({ platform: "Instagram", handle: "@manual", connectionState: "MANUAL_ONLY" });
    createAccount({
      platform: "Instagram",
      handle: "@live",
      connectionState: "CONNECTED",
      connectionMethod: "OAUTH",
      providerAccountId: "ig_live",
    });
    createAccount({ platform: "Facebook", displayName: "Page", connectionState: "RECONNECT_REQUIRED" });
    createAccount({ platform: "Threads", handle: "@setup", connectionState: "SETUP_REQUIRED" });
    const onToggle = vi.fn();
    render(
      <MemoryRouter>
        <PublishDestinations accounts={listAccounts()} selectedIds={[]} onToggle={onToggle} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: /@manual/i })).not.toBeInTheDocument();
    const live = screen.getByRole("button", { name: /@live/i });
    fireEvent.click(live);
    expect(onToggle).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Reconnect" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Finish setup" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /@setup/i })).not.toBeInTheDocument();
  });
});
