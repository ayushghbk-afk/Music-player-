import React, { useEffect, useState } from "react";

/** Range + editable value; partial numeric input is committed on blur/Enter. */
export function StudioControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  logarithmic = false,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  logarithmic?: boolean;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = Number(draft);
    if (draft.trim() && Number.isFinite(next)) {
      const bounded = Number(
        (Math.round(Math.max(min, Math.min(max, next)) / step) * step).toFixed(
          4,
        ),
      );
      setDraft(String(bounded));
      onChange(bounded);
    } else setDraft(String(value));
  };
  const position = logarithmic
    ? (1000 * Math.log(value / min)) / Math.log(max / min)
    : value;
  return (
    <div className="studio-control">
      <div>
        <span>{label}</span>
        <span className="studio-number">
          <input
            type="number"
            aria-label={`${label} exact`}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            value={editing ? draft : String(value)}
            onFocus={() => {
              setDraft(String(value));
              setEditing(true);
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              commit();
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                setDraft(String(value));
                e.stopPropagation();
              }
            }}
          />
          <small>{unit}</small>
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        aria-valuetext={`${value} ${unit}`}
        min={logarithmic ? 0 : min}
        max={logarithmic ? 1000 : max}
        step={logarithmic ? 1 : step}
        disabled={disabled}
        value={position}
        onChange={(e) => {
          const next = logarithmic
            ? min * (max / min) ** (Number(e.target.value) / 1000)
            : Number(e.target.value);
          onChange(Number((Math.round(next / step) * step).toFixed(4)));
        }}
      />
    </div>
  );
}
