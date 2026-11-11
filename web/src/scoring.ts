import type { GameState, Player } from "./types";
import { SCORING } from "./config";
import { binText, modeOf, type Mode } from "./mode";

/** One line on the leaderboard: a solo pilot, or a team. */
export interface Entry {
  id: string; // Pilot-07 or Team-02
  name: string;
  distance: number | null; // a team: the average of its members' flights
  bins: number | null; // a team: the average of its members' bin hits
  tiebreak?: number | null;
  members?: Player[]; // set for a team
}

export interface Scored extends Entry {
  distPts: number;
  binPts: number;
  total: number; // what the ranking uses: points (both rounds), metres (distance only) or planes in (bin only)
  rank: number; // shared when entries are genuinely level (shown as "=1st")
  tied: boolean; // someone else has exactly the same rank
}

const avg = (xs: (number | null)[]) => {
  const got = xs.filter((x): x is number => x !== null);
  return got.length ? Math.round((got.reduce((a, b) => a + b, 0) / got.length) * 100) / 100 : null;
};

/**
 * Who competes: every solo pilot, and every team as one entry. Everyone in a team throws, and the team
 * scores the average of its members (members who haven't thrown yet don't count), so a team of 4 is
 * on exactly the same scale as a solo pilot: being bigger doesn't help.
 * Teams-only events leave out players who aren't in a team; individuals-only events ignore teams.
 */
export function entriesOf(s: Pick<GameState, "players" | "teams" | "entries">): Entry[] {
  const teams = s.entries === "solo" ? [] : (s.teams ?? []);
  const inTeam = new Set(teams.flatMap((t) => t.members));
  const solo: Entry[] = s.entries === "teams" ? [] : s.players.filter((p) => !inTeam.has(p.id));
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const crews: Entry[] = teams
    .map((t) => ({ t, ms: t.members.map((id) => byId.get(id)).filter((p): p is Player => !!p) }))
    .filter(({ ms }) => ms.length > 0)
    .map(({ t, ms }) => ({
      id: t.id,
      name: t.name,
      members: ms,
      distance: avg(ms.map((m) => m.distance)),
      bins: avg(ms.map((m) => m.bins)),
      tiebreak: t.tiebreak ?? null,
    }));
  return [...solo, ...crews];
}

/**
 * Both rounds: the N longest flights score N, N-1 ... 1 (N = SCORING.distancePlaces), equal flights share
 *   points; plus 3 points per plane in the bin. Ties on total go to the longer flight.
 * Distance only: ranked by metres. Bin only: ranked by planes in.
 * Then the throw-off (if the host ran one). Still level = a real tie: same rank, and the podium asks for a throw-off.
 */
export function score(s: Pick<GameState, "players" | "teams" | "entries" | "rounds">): Scored[] {
  const entries = entriesOf(s);
  const mode = modeOf(s);
  const N = SCORING.distancePlaces;
  const scored = entries.map((p) => {
    const d = p.distance ?? 0;
    const ahead = d > 0 ? entries.filter((o) => (o.distance ?? 0) > d).length : Infinity;
    const distPts = mode === "both" && ahead < N ? N - ahead : 0;
    const binPts = mode === "both" ? Math.round((p.bins ?? 0) * SCORING.binPoints * 10) / 10 : 0;
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

/** The entry a player scores for (their team, or themselves). */
export const entryFor = (scored: Scored[], playerId: string) =>
  scored.find((e) => e.id === playerId || e.members?.some((m) => m.id === playerId));

/** The score as people should read it: "14 pts", "7.42 m" or "4/5 in" (a team's average can be "2.5/5"). */
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
