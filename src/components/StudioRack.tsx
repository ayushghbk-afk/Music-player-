import React, { useState } from "react";
import type { EQSettings, StudioRackSettings } from "../types";
import { defaultStudioRack } from "../services/studioRack";
import { StudioControl } from "./StudioControl";

export function StudioRack({
  settings,
  onUpdate,
}: {
  settings: EQSettings;
  onUpdate: (s: EQSettings) => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const rack = settings.rack || defaultStudioRack();
  const update = (patch: Partial<StudioRackSettings>) =>
    onUpdate({ ...settings, preset: "Custom", rack: { ...rack, ...patch } });
  const disabled = !settings.enabled || !rack.enabled;
  return (
    <section className="studio-rack" aria-label="Extreme system rack">
      <div className="studio-rack-heading">
        <div>
          <span className="eyebrow">PRECISION / SYSTEM RACK</span>
          <h3>Shape the room. Respect the system.</h3>
        </div>
        <label className="studio-switch">
          <input
            type="checkbox"
            aria-label="Enable system rack"
            checked={rack.enabled}
            disabled={!settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          Rack {rack.enabled ? "on" : "bypassed"}
        </label>
      </div>
      <p className="studio-note">
        Optional processing, initially bypassed. Start at low listening level.
        Filters are not speaker crossovers; system delay is a common stereo
        offset.
      </p>
      <div className="studio-rack-grid">
        <div className="studio-rack-card">
          <h4>01 / Sweep filters</h4>
          <small>12 dB/oct · Butterworth · independent bypass</small>
          <label className="studio-check">
            <input
              type="checkbox"
              checked={rack.highPassHz > 0}
              disabled={disabled}
              onChange={(e) =>
                update({ highPassHz: e.target.checked ? 80 : 0 })
              }
            />
            High-pass / low cut
          </label>
          <StudioControl
            label="High-pass cutoff"
            value={rack.highPassHz || 80}
            min={20}
            max={1000}
            unit="Hz"
            logarithmic
            disabled={disabled || !rack.highPassHz}
            onChange={(highPassHz) => update({ highPassHz })}
          />
          <label className="studio-check">
            <input
              type="checkbox"
              checked={rack.lowPassHz > 0}
              disabled={disabled}
              onChange={(e) =>
                update({ lowPassHz: e.target.checked ? 16000 : 0 })
              }
            />
            Low-pass / high cut
          </label>
          <StudioControl
            label="Low-pass cutoff"
            value={rack.lowPassHz || 16000}
            min={1000}
            max={20000}
            unit="Hz"
            logarithmic
            disabled={disabled || !rack.lowPassHz}
            onChange={(lowPassHz) => update({ lowPassHz })}
          />
        </div>
        {rack.parametric.map((band, index) => {
          const change = (patch: Partial<typeof band>) =>
            update({
              parametric: rack.parametric.map((b, i) =>
                i === index ? { ...b, ...patch } : b,
              ),
            });
          return (
            <div className="studio-rack-card" key={index}>
              <div className="studio-card-title">
                <h4>
                  0{index + 2} / Parametric {index + 1}
                </h4>
                <button
                  disabled={disabled}
                  onClick={() => change({ gain: 0 })}
                  aria-label={`Flatten parametric ${index + 1}`}
                >
                  Flat
                </button>
              </div>
              <small>
                Peaking bell · 0 dB is neutral · higher Q is narrower
              </small>
              <StudioControl
                label={`PEQ ${index + 1} frequency`}
                value={band.frequency}
                min={20}
                max={20000}
                unit="Hz"
                logarithmic
                disabled={disabled}
                onChange={(frequency) => change({ frequency })}
              />
              <StudioControl
                label={`PEQ ${index + 1} gain`}
                value={band.gain}
                min={-12}
                max={12}
                step={0.5}
                unit="dB"
                disabled={disabled}
                onChange={(gain) => change({ gain })}
              />
              <StudioControl
                label={`PEQ ${index + 1} Q`}
                value={band.q}
                min={0.2}
                max={12}
                step={0.1}
                disabled={disabled}
                onChange={(q) => change({ q })}
              />
            </div>
          );
        })}
        <div className="studio-rack-card">
          <h4>05 / System output</h4>
          <small>Attenuation before peak guard · no extra output boost</small>
          <StudioControl
            label="System trim"
            value={rack.outputTrimDb}
            min={-24}
            max={0}
            step={0.5}
            unit="dB"
            disabled={disabled}
            onChange={(outputTrimDb) => update({ outputTrimDb })}
          />
          <StudioControl
            label="System delay"
            value={rack.delayMs}
            min={0}
            max={100}
            step={0.1}
            unit="ms"
            disabled={disabled}
            onChange={(delayMs) => update({ delayMs })}
          />
          <small>
            {(rack.delayMs * 0.343).toFixed(2)} m equivalent at 343 m/s · not
            measured room distance
          </small>
          <div className="studio-polarity">
            {(["Left", "Right"] as const).map((channel) => (
              <label className="studio-check" key={channel}>
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={
                    channel === "Left" ? rack.invertLeft : rack.invertRight
                  }
                  onChange={(e) =>
                    update(
                      channel === "Left"
                        ? { invertLeft: e.target.checked }
                        : { invertRight: e.target.checked },
                    )
                  }
                />
                Invert {channel} polarity
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="studio-rack-footer">
        <button
          onClick={() => {
            if (
              !confirmReset &&
              settings.enabled &&
              rack.enabled &&
              rack.outputTrimDb < 0
            ) {
              setConfirmReset(true);
              return;
            }
            onUpdate({
              ...settings,
              preset: "Custom",
              rack: defaultStudioRack(),
            });
            setConfirmReset(false);
          }}
        >
          {confirmReset
            ? "Confirm rack reset (may get louder)"
            : "Reset system rack"}
        </button>
        {confirmReset && (
          <button onClick={() => setConfirmReset(false)}>
            Cancel rack reset
          </button>
        )}
        <small>
          Change delay, polarity and filter bypass while paused or at low level.
          Not a calibrated limiter, LUFS meter, crossover or hardware speaker
          protector.
        </small>
      </div>
    </section>
  );
}
