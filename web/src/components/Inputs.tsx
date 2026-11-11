import { useEffect, useState } from "react";
import type { Player } from "../types";

type Send = (m: object) => void;

export function Dots({ n, max = 3 }: { n: number | null; max?: number }) {
  return (
    <span className="dots" aria-label={n === null ? "not thrown yet" : `${n} of ${max} in`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`dot ${n !== null && i < n ? "in" : ""} ${n === null ? "todo" : ""}`} />
      ))}
    </span>
  );
}

export function BinStepper({ p, send, max = 3 }: { p: Player; send: Send; max?: number }) {
  const step = (dir: 1 | -1) => send({ t: "bin", id: p.id, dir });
  return (
    <span className="stepper">
      <button onClick={() => step(-1)} aria-label={`One less for ${p.name}`}>
        −
      </button>
      <Dots n={p.bins} max={max} />
      <button onClick={() => step(1)} disabled={p.bins === max} aria-label={`One more for ${p.name}`}>
        +
      </button>
    </span>
  );
}

/**
 * Metres box. Saves on Enter or when you leave the box.
 * In a list, Enter jumps to the next row (`row`); the "now throwing" box passes no row.
 */
export function DistanceInput({ p, row, send, autoFocus }: { p: Player; row?: number; send: Send; autoFocus?: boolean }) {
  const [value, setValue] = useState(p.distance?.toString() ?? "");
  const [bad, setBad] = useState(false);
  useEffect(() => setValue(p.distance?.toString() ?? ""), [p.distance]);

  const commit = () => {
    const text = value.trim().replace(",", ".");
    if (text === "") {
      setBad(false);
      if (p.distance !== null) send({ t: "distance", id: p.id, m: null });
      return;
    }
    const m = Number(text);
    if (!(m > 0 && m <= 60)) return setBad(true);
    setBad(false);
    if (m !== p.distance) send({ t: "distance", id: p.id, m });
  };

  return (
    <label className={`m-input ${bad ? "bad" : ""}`}>
      <input
        data-row={row}
        inputMode="decimal"
        value={value}
        placeholder="0.00"
        autoFocus={autoFocus}
        aria-label={`Distance for ${p.name}`}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (row !== undefined) (document.querySelector(`[data-row="${row + 1}"]`) as HTMLInputElement | null)?.focus();
          commit();
        }}
      />
      <span>m</span>
    </label>
  );
}

export function Search({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="search"
      type="search"
      placeholder="Search name or ID (e.g. 07)"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Search players by name or ID"
    />
  );
}
