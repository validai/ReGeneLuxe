import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import IntakePanel from "./IntakePanel.jsx";
import { createCampaign, getCampaign } from "../../data/campaignRepository.js";
import { createAccount } from "../../data/accountRepository.js";
import { emptyCampaign } from "../../data/models.js";

describe("structured intake", () => {
  it("autosaves checkbox selections through the repository", async () => {
    vi.useFakeTimers();
    const account = createAccount({ displayName: "DJ Coast", handle: "@djcoast", platform: "Instagram" });
    const campaign = createCampaign({ name: "Untitled campaign", accountIds: [] });
    render(<IntakePanel campaign={getCampaign(campaign.id)} accounts={[account]} />);

    fireEvent.click(screen.getByLabelText("Release promotion"));
    fireEvent.click(screen.getByLabelText("@djcoast"));

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    const saved = getCampaign(campaign.id);
    expect(saved.intake.goals).toContain("release_promotion");
    expect(saved.accountIds).toContain(account.id);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("can define a campaign from structured choices without paragraphs", () => {
    const campaign = emptyCampaign({
      name: "Defined",
      intake: {
        goals: ["awareness"],
        promoted: { primary: "single", title: "Night Drive" },
      },
    });
    render(<IntakePanel campaign={campaign} accounts={[]} />);
    expect(screen.getByRole("checkbox", { name: "Awareness" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Single" })).toBeChecked();
    expect(screen.getByDisplayValue("Night Drive")).toBeInTheDocument();
  });
});
