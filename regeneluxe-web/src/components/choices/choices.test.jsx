import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CheckboxGroup from "./CheckboxGroup.jsx";
import RadioGroup from "./RadioGroup.jsx";

const OPTIONS = [
  { value: "awareness", label: "Awareness" },
  { value: "other", label: "Other" },
];

describe("choice components", () => {
  it("toggles checkbox cards and reveals Other text", () => {
    const onChange = vi.fn();
    const onOtherText = vi.fn();
    const { rerender } = render(
      <CheckboxGroup options={OPTIONS} values={[]} onChange={onChange} otherText="" onOtherText={onOtherText} />
    );

    fireEvent.click(screen.getByLabelText("Awareness"));
    expect(onChange).toHaveBeenCalledWith(["awareness"]);

    rerender(
      <CheckboxGroup options={OPTIONS} values={["other"]} onChange={onChange} otherText="" onOtherText={onOtherText} />
    );
    expect(screen.getByPlaceholderText("Describe other")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Describe other"), { target: { value: "Playlist" } });
    expect(onOtherText).toHaveBeenCalledWith("Playlist");
  });

  it("selects a radio choice", () => {
    const onChange = vi.fn();
    render(
      <RadioGroup name="cta" options={OPTIONS} value="" onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("radio", { name: "Awareness" }));
    expect(onChange).toHaveBeenCalledWith("awareness");
  });
});
