import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App.jsx";
import { createCampaign, setCampaignActive } from "./data/campaignRepository.js";

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("routes and workspace chrome", () => {
  it("loads the dark dashboard at the root route", () => {
    const { container } = renderAt("/");
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /\+?\s*create/i }).length).toBeGreaterThan(0);
    expect(container.firstChild).toHaveClass("bg-rl_bg");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("renders the social-manager navigation", () => {
    renderAt("/campaigns");
    expect(screen.getByRole("heading", { name: "Campaigns" })).toBeInTheDocument();
    // Left nav (desktop) and/or mobile strip — either is fine.
    expect(screen.getAllByRole("link", { name: "Calendar" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Content" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Inbox" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Analytics" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: "Active" })).toBeInTheDocument();
  });

  it("fails gracefully for a missing campaign", async () => {
    renderAt("/campaigns/missing-id");
    expect(await screen.findByText(/campaign not found/i)).toBeInTheDocument();
    expect(screen.getByText(/back to campaigns/i)).toBeInTheDocument();
  });

  it("opens an existing campaign workspace without status dropdowns", async () => {
    const campaign = createCampaign({ name: "Workspace campaign" });
    renderAt(`/campaigns/${campaign.id}`);
    expect(await screen.findByRole("heading", { level: 1, name: "Workspace campaign" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Strategy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Active" })).toBeInTheDocument();
    expect(screen.queryByText("DRAFT")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/stage/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Strategy" }));
    expect(await screen.findByText(/No strategy yet/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Edit strategy" })[0]);
    expect(screen.getByText("Awareness")).toBeInTheDocument();
  });

  it("filters inactive campaigns out of the default list", () => {
    const live = createCampaign({ name: "Live campaign" });
    const quiet = createCampaign({ name: "Quiet campaign" });
    setCampaignActive(quiet.id, false);
    setCampaignActive(live.id, true);
    renderAt("/campaigns");
    expect(screen.getByText("Live campaign")).toBeInTheDocument();
    expect(screen.queryByText("Quiet campaign")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Inactive" }));
    expect(screen.getByText("Quiet campaign")).toBeInTheDocument();
  });

  it("renders the queue area", () => {
    renderAt("/queue");
    expect(screen.getByRole("heading", { name: "Queue" })).toBeInTheDocument();
  });

  it("renders the calendar area", async () => {
    renderAt("/calendar");
    expect(await screen.findByRole("heading", { name: "Calendar" })).toBeInTheDocument();
  });

  it("opens the command palette from the search control", () => {
    renderAt("/");
    fireEvent.click(screen.getAllByRole("button", { name: /search/i })[0]);
    expect(screen.getByRole("dialog", { name: /command palette/i })).toBeInTheDocument();
  });

  it("renders content status filters from the URL", () => {
    renderAt("/content?status=SCHEDULED");
    expect(screen.getByRole("heading", { name: "Content" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Scheduled" })).toHaveAttribute("aria-selected", "true");
  });

  it("redirects retired commercial routes to the workspace", () => {
    renderAt("/login");
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
  });
});
