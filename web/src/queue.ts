import type { GameState, Player } from "./types";
import { throwOrder } from "./mode";

const isRound = (s: GameState) => s.phase === "distance" || s.phase === "bin";

/** Has this player finished the current round? */
export const hasThrown = (s: GameState, p: Player) => (s.phase === "bin" ? p.bins !== null : p.distance !== null);

/** Marked "not here" for the current round. */
export const isAway = (s: GameState, p: Player) => isRound(s) && (s.away?.[s.phase as "distance" | "bin"] ?? []).includes(p.id);

/**
 * Who's throwing now and who's next, in the same order the server calls them:
 * the called player first, then everyone still to throw this round (not "not here"), in throw order
 * (join order, with team members called one after another).
 */
export function callOrder(state: GameState): Player[] {
  if (!isRound(state)) return [];
  const todo = (p: Player) => !hasThrown(state, p) && !isAway(state, p);
  const list = throwOrder(state);
  const at = list.findIndex((p) => p.id === state.up);
  const called = at >= 0 ? list[at] : state.players.find((p) => p.id === state.up); // the host can call anyone
  const out: Player[] = called ? [called] : [];
  for (let k = 1; k <= list.length; k++) {
    const p = list[(at + k + list.length) % list.length];
    if (p && p.id !== state.up && todo(p) && !out.includes(p)) out.push(p);
  }
  return out;
}

/** Round progress for the "round complete?" prompt. */
export function roundStatus(state: GameState) {
  const field = throwOrder(state); // teams-only: players without a team don't throw
  const done = field.filter((p) => hasThrown(state, p));
  const away = field.filter((p) => !hasThrown(state, p) && isAway(state, p));
  const left = callOrder(state);
  return { done, away, left, field, complete: isRound(state) && field.length > 0 && left.length === 0 };
}

/** Search by name or ID: "07", "7", "pilot-07" or "tom". */
export const matches = (p: Player, query: string) => {
  const q = query.trim().toLowerCase().replace(/^(pilot|pp)[\s-]*/, "");
  if (!q) return true;
  const num = p.id.replace(/\D/g, "");
  return p.name.toLowerCase().includes(q) || num.includes(q) || String(Number(num)) === q;
};

/** The number part of an ID, for tilts and sorting. */
export const idNumber = (id: string) => Number(id.replace(/\D/g, "")) || 0;
