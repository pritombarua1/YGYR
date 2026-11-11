import type { GameState, Player } from "./types";
import { SCORING } from "./config";
import { binText, modeOf, teamOf, type Mode } from "./mode";

/** One line on the leaderboard: always one person. `team` is who they fly with (a label, not a merged score). */
export interface Entry extends Player {
  team?: { id: string; name: string; members: string[] };
}

export interface Scored extends Entry {
  distPts: number;
  binPts: number;
  total: number; // what the ranking uses: points (both rounds), metres (distance only) or planes in (bin only)
  rank: number; // shared when entries are genuinely level (shown as "=1st")
  tied: boolean; // someone else has exactly the same rank
  of: number; // how many are ranked, for "12th of 30"
}

/**
 * Everyone competes as themselves: places go to people, on their own throws. A team is who you fly
 * with (called one after another, shown together), so if a team's captain throws 9.00 m and a solo
 * pilot 8.90 m, the captain is 1st and the solo pilot 2nd; the captain's team-mates place on their own
 * throws. Teams-only events rank only players who are in a team.
 */
export function entriesOf(s: Pick<GameState, "players" | "teams" | "entries">): Entry[] {
  const names = new Map(s.players.map((p) => [p.id, p.name]));
  return s.players
    .map((p): Entry => {
      const t = teamOf(s, p.id);
      return t ? { ...p, team: { id: t.id, name: t.name, members: t.members.map((id) => names.get(id) ?? id) } } : { ...p };
    })
    .filter((e) => s.entries !== "teams" || e.team);
}

/**
 * Both rounds: every flight scores, one point for each flight it beats plus one (with 30 flights the
 *   longest gets 30, the shortest 1; equal flights share points); plus 3 points per plane in the bin.
 *   Ties on total go to the longer flight.
 * Distance only: ranked by metres. Bin only: ranked by planes in.
 * Then the throw-off (if the host ran one). Still level = a real tie: same rank, and the podium asks for a throw-off.
 */
export function score(s: Pick<GameState, "players" | "teams" | "entries" | "rounds">): Scored[] {
  const entries = entriesOf(s);
  const mode = modeOf(s);
  const N = entries.filter((e) => (e.distance ?? 0) > 0).length; // every flight scores
  const scored = entries.map((p) => {
    const d = p.distance ?? 0;
    const ahead = d > 0 ? entries.filter((o) => (o.distance ?? 0) > d).length : Infinity;
    const distPts = mode === "both" && ahead < N ? N - ahead : 0;
    const binPts = mode === "both" ? (p.bins ?? 0) * SCORING.binPoints : 0;
    const total = mode === "both" ? distPts + binPts : mode === "distance" ? d : (p.bins ?? 0);
    return { ...p, distPts, binPts, total, rank: 0, tied: false, of: entries.length };
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

/** A player's own line (undefined: not ranked, e.g. no team in a teams-only event). */
export const entryFor = (scored: Scored[], playerId: string) => scored.find((e) => e.id === playerId);

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
