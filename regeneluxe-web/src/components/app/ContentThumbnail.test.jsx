import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ContentThumbnail from "./ContentThumbnail.jsx";

const COVER = "https://cdn.example.com/cover.jpg";

describe("ContentThumbnail", () => {
  it("renders a lazy image preview and hides it when the file fails", () => {
    render(<ContentThumbnail content={{ title: "Night set", mediaRefs: [COVER] }} />);
    const image = screen.getByRole("img", { name: "Night set" });
    expect(image).toHaveAttribute("src", COVER);
    expect(image).toHaveAttribute("loading", "lazy");
    fireEvent.error(image);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders nothing for text-only content", () => {
    const { container } = render(<ContentThumbnail content={{ title: "Caption only", caption: "Hello" }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("marks a video poster and the attachment count", () => {
    render(<ContentThumbnail content={{
      title: "Reel",
      mediaRefs: [
        { url: "https://cdn.example.com/clip.mp4", thumbnail: "https://cdn.example.com/poster.jpg", duration: "0:12" },
        COVER,
      ],
    }} size="standard" />);
    expect(screen.getByRole("img", { name: "Reel" })).toBeInTheDocument();
    expect(screen.getByText("Play")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("0:12")).toBeInTheDocument();
  });
});
