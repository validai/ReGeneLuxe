import ChoiceCard from "./ChoiceCard.jsx";
import OtherChoice from "./OtherChoice.jsx";

export default function RadioGroup({
  legend,
  name,
  options,
  value,
  onChange,
  columns = 3,
  otherValue = "other",
  otherText = "",
  onOtherText,
}) {
  return (
    <fieldset>
      {legend && (
        <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-rl_muted">
          {legend}
        </legend>
      )}
      <div className={`grid gap-2 sm:grid-cols-2 ${columns >= 3 ? "lg:grid-cols-3" : ""}`}>
        {options.map((option) => (
          <ChoiceCard
            key={option.value}
            type="radio"
            name={name}
            value={option.value}
            label={option.label}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
        ))}
      </div>
      <OtherChoice
        open={value === otherValue && Boolean(onOtherText)}
        value={otherText}
        onChange={onOtherText}
      />
    </fieldset>
  );
}
