import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../App.jsx";
import { createCampaign } from "../data/campaignRepository.js";
import { createAccount } from "../data/accountRepository.js";
import { saveContent } from "../data/collectionRepository.js";
import { emptyContentItem } from "../data/domain.js";

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("UX acceptance flows", () => {
  it("loads dashboard Today / Needs you / ReGeneLuxe recommends labels", async () => {
    createCampaign({ name: "Dashboard seed" });
    saveContent(emptyContentItem({
      title: "Seed post",
      caption: "Hello",
      status: "DRAFTING",
    }));

    renderAt("/");

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getAllByText(/today/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/needs you/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/regeneluxe recommends/i).length).toBeGreaterThan(0);
  });

  it("creates a draft via composer with an account and caption", async () => {
    const account = createAccount({
      displayName: "DJ Coast",
      handle: "@djcoast",
      platform: "Instagram",
    });

    renderAt("/content/new");

    expect(await screen.findByRole("heading", { name: "Create" })).toBeInTheDocument();

    const accountBtn = screen.getByRole("button", { name: /instagram/i });
    fireEvent.click(accountBtn);
    expect(accountBtn).toHaveAttribute("aria-pressed", "true");

    const caption = screen.getByLabelText(/caption/i);
    fireEvent.change(caption, { target: { value: "Sprint 83 draft caption" } });

    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    expect(await screen.findByRole("heading", { name: "Edit post" })).toBeInTheDocument();
    expect(screen.getByLabelText(/caption/i)).toHaveValue("Sprint 83 draft caption");
    expect(account.id).toBeTruthy();
  });

  it("filters content library status from the URL", async () => {
    renderAt("/content?status=SCHEDULED");
    expect(await screen.findByRole("heading", { name: "Content" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Scheduled" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows Month / Week / List tabs on calendar", async () => {
    renderAt("/calendar");
    expect(await screen.findByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    const tabs = screen.getByRole("tablist", { name: /calendar view/i });
    expect(within(tabs).getByRole("tab", { name: "Month" })).toBeInTheDocument();
    expect(within(tabs).getByRole("tab", { name: "Week" })).toBeInTheDocument();
    expect(within(tabs).getByRole("tab", { name: "List" })).toBeInTheDocument();
  });

  it("opens command palette and jumps to Analytics", async () => {
    renderAt("/");

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /search/i })[0]);

    const dialog = await screen.findByRole("dialog", { name: /command palette/i });
    expect(dialog).toBeInTheDocument();

    const input = within(dialog).getByPlaceholderText(/search or jump/i);
    fireEvent.change(input, { target: { value: "Analytics" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /open analytics/i }));

    expect(await screen.findByRole("heading", { name: "Analytics" })).toBeInTheDocument();
  });

  it("opens campaign workspace overview with ReGeneLuxe copy", async () => {
    const campaign = createCampaign({ name: "Overview campaign" });
    renderAt(`/campaigns/${campaign.id}`);

    expect(await screen.findByRole("heading", { level: 1, name: "Overview campaign" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: /what regeneluxe sees/i })).toBeInTheDocument();
    expect(screen.getAllByText(/no goal yet|all clear/i).length).toBeGreaterThan(0);
  });
});
