import type { GameState, Player } from "./types";
import { SCORING } from "./config";
import { binText, modeOf, type Mode } from "./mode";

export interface Scored extends Player {
  distPts: number;
  binPts: number;
  total: number; // what the ranking uses: points (both rounds), metres (distance only) or planes in (bin only)
  rank: number; // shared when entries are genuinely level (shown as "=1st")
  tied: boolean; // someone else has exactly the same rank
}

/**
 * Every entry, solo or team, has one plane and one turn per round, so they are scored the same way.
 *
 * Both rounds: the N longest throws score N, N-1 ... 1 (N = SCORING.distancePlaces), equal throws share
 *   points; plus 3 points per plane in the bin. Ties on total go to the longer flight.
 * Distance only: ranked by metres. Bin only: ranked by planes in.
 * Then the throw-off (if the host ran one). Still level = a real tie: same rank, and the podium asks for a throw-off.
 */
export function score(players: Player[], cfg: Pick<GameState, "rounds">): Scored[] {
  const mode = modeOf(cfg);
  const N = SCORING.distancePlaces;
  const scored = players.map((p) => {
    const d = p.distance ?? 0;
    const ahead = d > 0 ? players.filter((o) => (o.distance ?? 0) > d).length : Infinity;
    const distPts = mode === "both" && ahead < N ? N - ahead : 0;
    const binPts = mode === "both" ? (p.bins ?? 0) * SCORING.binPoints : 0;
    const total = mode === "both" ? distPts + binPts : mode === "distance" ? d : (p.bins ?? 0);
    return { ...p, distPts, binPts, total, rank: 0, tied: false };
  });
  const compare = (a: Scored, b: Scored) =>
    b.total - a.total || (b.distance ?? 0) - (a.distance ?? 0) || (b.tiebreak ?? 0) - (a.tiebreak ?? 0);
  scored.sort((a, b) => compare(a, b) || a.id.localeCompare(b.id));
  scored.forEach((p, i) => {
    const prev = scored[i - 1];
    p.rank = prev && compare(prev, p) === 0 ? prev.rank : i + 1;
  });
  scored.forEach((p) => (p.tied = scored.some((o) => o !== p && o.rank === p.rank && p.total > 0)));
  return scored;
}

/** The score as people should read it: "14 pts", "7.42 m" or "4/5 in". */
export function scoreText(s: Scored, cfg: Pick<GameState, "rounds">, mode: Mode = modeOf(cfg)) {
  if (mode === "distance") return s.distance ? `${s.distance.toFixed(2)} m` : "no flight";
  if (mode === "bin") return `${binText(cfg, s.bins ?? 0)} in`;
  return `${s.total} pts`;
}

/** What "level" means for a throw-off (same result on what decides the ranking). */
export const level = (a: Scored, b: Scored) => a.total === b.total && (a.distance ?? 0) === (b.distance ?? 0);

export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** "1st", or "=1st" when shared. */
export const place = (p: Scored) => (p.tied ? "=" : "") + ordinal(p.rank);
