import { PlatformIcon } from "./Icon.jsx";

export default function DestinationPicker({
  destinations = [],
  selectedIds = [],
  onToggle,
  legend = "Connected Meta identities",
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-rl_text">{legend}</legend>
      <p className="text-sm text-rl_muted">Choose the destinations this workspace should operate. Nothing is selected automatically.</p>
      <ul className="space-y-2">
        {destinations.map((destination) => {
          const checked = selectedIds.includes(destination.id);
          return (
            <li key={destination.id}>
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 ${checked ? "border-rl_accent bg-rl_accent/10" : "border-rl_border"}`}>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-rl_accent"
                  checked={checked}
                  onChange={() => onToggle?.(destination.id)}
                />
                <PlatformIcon platform={destination.platform} size="sm" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-rl_text">
                    {destination.platform} — {destination.handle || destination.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-rl_muted">{destination.type}</span>
                  {destination.relationship ? (
                    <span className="mt-0.5 block text-xs text-rl_muted">{destination.relationship}</span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
