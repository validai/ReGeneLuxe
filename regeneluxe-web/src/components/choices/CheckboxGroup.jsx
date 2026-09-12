import ChoiceCard from "./ChoiceCard.jsx";
import OtherChoice from "./OtherChoice.jsx";

export default function CheckboxGroup({
  legend,
  options,
  values = [],
  onChange,
  columns = 3,
  otherValue = "other",
  otherText = "",
  onOtherText,
}) {
  const selected = new Set(values || []);

  const toggle = (value) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange([...next]);
  };

  return (
    <fieldset>
      {legend && (
        <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-rl_muted">
          {legend}
        </legend>
      )}
      <div className={`grid gap-2 sm:grid-cols-2 ${columns >= 3 ? "lg:grid-cols-3" : ""} ${columns >= 4 ? "xl:grid-cols-4" : ""}`}>
        {options.map((option) => (
          <ChoiceCard
            key={option.value}
            type="checkbox"
            value={option.value}
            label={option.label}
            checked={selected.has(option.value)}
            onChange={() => toggle(option.value)}
          />
        ))}
      </div>
      <OtherChoice
        open={selected.has(otherValue) && Boolean(onOtherText)}
        value={otherText}
        onChange={onOtherText}
      />
    </fieldset>
  );
}
