import { describe, expect, it } from "vitest";
import { MemoryRouter } from "@/nav";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "../App.jsx";
import CalendarBoard from "../components/calendar/CalendarBoard.jsx";
import CommandPalette from "../components/app/CommandPalette.jsx";
import { createCampaign } from "../data/campaignRepository.js";
import { saveContent, saveInteraction, saveQueueJob, saveSnapshot } from "../data/collectionRepository.js";
import { emptyContentItem } from "../data/domain.js";

const COVER = "https://cdn.example.com/cover.jpg";

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("content thumbnails on operator surfaces", () => {
  it("shows an image on the content row and keeps edit navigation", async () => {
    saveContent(emptyContentItem({
      title: "Visual post",
      caption: "Look",
      status: "DRAFTING",
      mediaRefs: [COVER],
    }));
    renderAt("/content");
    expect(await screen.findByRole("img", { name: "Visual post" })).toHaveAttribute("src", COVER);
    fireEvent.click(screen.getByRole("button", { name: /visual post/i }));
    const edits = screen.getAllByRole("link", { name: "Edit" });
    expect(edits.length).toBeGreaterThan(0);
    expect(edits.every((link) => link.getAttribute("href")?.includes("/content/"))).toBe(true);
  });

  it("does not draw a fake tile for text-only content", async () => {
    saveContent(emptyContentItem({ title: "Words only", caption: "Hello", status: "DRAFTING" }));
    renderAt("/content");
    expect(await screen.findByText("Words only")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows a compact calendar thumbnail only for visual items", () => {
    const visual = emptyContentItem({
      title: "On the grid",
      status: "SCHEDULED",
      scheduledAt: new Date().toISOString(),
      mediaRefs: [COVER],
    });
    const text = emptyContentItem({
      title: "Caption slot",
      status: "SCHEDULED",
      scheduledAt: new Date().toISOString(),
    });
    render(
      <MemoryRouter>
        <CalendarBoard items={[visual, text]} accounts={[]} campaigns={[]} view="month" />
      </MemoryRouter>
    );
    expect(screen.getByRole("img", { name: "On the grid" })).toHaveAttribute("src", COVER);
    expect(screen.getByText("Caption slot")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("shows the queued content image and still opens the item", async () => {
    const item = saveContent(emptyContentItem({
      title: "Queued visual",
      status: "SCHEDULED",
      mediaRefs: [COVER],
    }));
    saveQueueJob({ contentId: item.id, state: "queued", scheduledAt: new Date().toISOString() });
    renderAt("/queue");
    expect(await screen.findByRole("img", { name: "Queued visual" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Queued visual" })).toHaveAttribute("href", `/content/${item.id}`);
  });

  it("shows campaign content thumbnails", async () => {
    const campaign = createCampaign({ name: "Coast run" });
    saveContent(emptyContentItem({
      title: "Campaign visual",
      campaignId: campaign.id,
      status: "DRAFTING",
      mediaRefs: [COVER],
    }));
    renderAt(`/campaigns/${campaign.id}?tab=content`);
    expect(await screen.findByRole("img", { name: "Campaign visual" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /campaign visual/i })).toHaveAttribute("href", expect.stringContaining("/content/"));
  });

  it("shows a thumbnail on an individual analytics post", async () => {
    const item = saveContent(emptyContentItem({
      title: "Measured post",
      status: "PUBLISHED",
      mediaRefs: [COVER],
    }));
    saveSnapshot({ contentId: item.id, source: "MANUAL", metrics: { reach: 12 } });
    renderAt("/analytics");
    expect(await screen.findByRole("img", { name: "Measured post" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /measured post/i })).toHaveAttribute("href", `/content/${item.id}`);
  });

  it("shows the source post only when an inbox item is tied to it", async () => {
    const item = saveContent(emptyContentItem({
      title: "Commented post",
      mediaRefs: [COVER],
    }));
    saveInteraction({ sender: "Avery", message: "Nice set", contentId: item.id, type: "comment" });
    saveInteraction({ sender: "Blair", message: "General note", type: "message" });
    window.matchMedia = () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    });
    renderAt("/inbox");
    expect(await screen.findByRole("img", { name: "Commented post" })).toBeInTheDocument();
    expect(screen.getByText(/Blair/)).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("shows a thumbnail on a content search result and navigates", async () => {
    const item = saveContent(emptyContentItem({
      title: "Searchable visual",
      mediaRefs: [COVER],
    }));
    renderAt("/");
    fireEvent.keyDown(window, { key: "/" });
    const search = await screen.findByPlaceholderText("Search or jump…");
    fireEvent.change(search, { target: { value: "Searchable visual" } });
    const result = screen.getByRole("button", { name: /searchable visual/i });
    expect(result.querySelector("img")).toHaveAttribute("src", COVER);
    fireEvent.click(result);
    expect(await screen.findByDisplayValue("Searchable visual")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Searchable visual" })).toHaveAttribute("src", COVER);
    expect(item.id).toBeTruthy();
  });
});

describe("composer media preview", () => {
  it("shows an attached image and hides a local path", async () => {
    renderAt("/content/new");
    const input = await screen.findByPlaceholderText("https://… or note");
    fireEvent.change(input, { target: { value: COVER } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("img", { name: "Content preview" })).toHaveAttribute("src", COVER);
    fireEvent.change(screen.getByPlaceholderText("https://… or note"), { target: { value: "/Users/eric/Desktop/secret.jpg" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getAllByText("Attached file").length).toBeGreaterThan(0);
    expect(screen.queryByText("/Users/eric/Desktop/secret.jpg")).toBeNull();
  });
});

describe("search keeps non-content results plain", () => {
  it("does not attach a content thumbnail to a campaign result", async () => {
    createCampaign({ name: "Plain campaign" });
    render(
      <MemoryRouter>
        <CommandPalette open onClose={() => {}} />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText("Search or jump…"), { target: { value: "Plain campaign" } });
    const result = screen.getByRole("button", { name: /plain campaign/i });
    expect(result.querySelector("img")).toBeNull();
  });
});
