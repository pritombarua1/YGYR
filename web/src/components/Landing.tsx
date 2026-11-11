import { useEffect, useRef, useState } from "react";
import type { Player } from "../types";
import { Plane } from "./Plane";

/** How long the "LANDED 7.42 m" moment stays up. Matches the landed-life keyframes in styles.css. */
export const LANDING_MS = 2200;

export type Landing = { key: number; id: string; name: string; m: number };

/** Fires a short "landed" moment whenever a distance is logged (only for `onlyId`, when given). */
export function useLanding(players: Player[] | undefined, onlyId?: string) {
  const seen = useRef<Player[] | undefined>(undefined);
  const prev = useRef<Map<string, number | null> | null>(null);
  const current = useRef<Landing | null>(null);
  const [, redraw] = useState(0);

  // Detected while rendering the very update that brings the new distance (not in an effect a frame
  // later), so the screen never shows one frame of "next pilot" before the landing moment starts.
  if (players && players !== seen.current) {
    seen.current = players;
    const before = prev.current;
    prev.current = new Map(players.map((p) => [p.id, p.distance]));
    const p = before && players.find((p) => (!onlyId || p.id === onlyId) && p.distance !== null && p.distance !== before.get(p.id));
    if (p) current.current = { key: Date.now() + Math.random(), id: p.id, name: p.name, m: p.distance! };
  }
  const landing = current.current;

  // Cleared by its own timer, so a new landing restarts the clock instead of being cut short.
  useEffect(() => {
    if (!landing) return;
    const t = setTimeout(() => {
      if (current.current === landing) (current.current = null), redraw((n) => n + 1);
    }, LANDING_MS);
    return () => clearTimeout(t);
  }, [landing]);

  return landing;
}

/**
 * Big plane-skids-in stamp: "LANDED 7.42 m". Pure CSS keyframes (styles.css, "landing moment"):
 * they end fully transparent and are removed after LANDING_MS, so there is never a flash on the way out.
 */
export function LandingStamp({ landing }: { landing: Landing | null }) {
  if (!landing) return null;
  return (
    <div key={landing.key} className="landed" aria-live="polite">
      <span className="landed-plane">
        <Plane size={90} />
      </span>
      <div className="landed-stamp">
        <span>Landed</span>
        <strong>{landing.m.toFixed(2)} m</strong>
        <em className="hand">{landing.name}</em>
      </div>
    </div>
  );
}
