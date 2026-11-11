import { SCORING } from "./config";
import type { GameState, Phase, Player, Round, Team } from "./types";

/*
 * What this game is: which challenges run (distance, bin, or both) and who can enter.
 * Everything that shows scores, rounds or rules asks here, so the three modes stay consistent.
 */

export type Mode = "both" | "distance" | "bin";
type Cfg = Pick<GameState, "rounds">;

export const modeOf = (s: Cfg): Mode =>
  s.rounds.includes("distance") ? (s.rounds.includes("bin") ? "both" : "distance") : "bin";

/** Bin throws per entry: 3 alongside the distance round, more when the bin is the whole challenge. */
export const binThrows = (s: Cfg) => (s.rounds.includes("distance") ? SCORING.binThrows : SCORING.binOnlyThrows);

/** The run of show for this game. */
export const phasesFor = (s: Cfg): Phase[] => ["lobby", "rules", ...(["distance", "bin"] as Round[]).filter((r) => s.rounds.includes(r)), "winners"];

export const PHASE_LABEL: Record<Phase, string> = { lobby: "Lobby", rules: "Rules", distance: "Distance", bin: "Bin", winners: "Winners" };

/** "Round 1" / "Round 2" with two challenges; "The challenge" when there's only one. */
export const roundKicker = (s: Cfg, r: Round) => (s.rounds.length > 1 ? `Round ${s.rounds.indexOf(r) + 1}` : "The challenge");
export const roundTitle = (s: Cfg, r: Round) => (s.rounds.length > 1 ? `${roundKicker(s, r)}: ${PHASE_LABEL[r]}` : PHASE_LABEL[r]);

/** Has this entry thrown in every round that's on? */
export const finished = (s: Cfg, p: Player) => s.rounds.every((r) => (r === "bin" ? p.bins !== null : p.distance !== null));

/* ---------- teams ---------- */

type TeamCfg = Pick<GameState, "teams" | "entries">;

/** The team a player throws for (none when the event is individuals only). */
export const teamOf = (s: TeamCfg, playerId: string): Team | null =>
  s.entries === "solo" ? null : ((s.teams ?? []).find((t) => t.members.includes(playerId)) ?? null);

/** A scored entry is a team when it has members. */
export const isTeam = (e: { members?: unknown[] }) => !!e.members;
export const members = (e: { members?: { name: string }[] }) => (e.members ?? []).map((m) => m.name).join(", ");

/**
 * Who throws, in order (the server calls people in exactly this order): join order, except that a
 * team's members are called one after another, in team formation, when the first of them comes up.
 * Teams-only events leave out players who aren't in a team.
 */
export function throwOrder(s: Pick<GameState, "players" | "teams" | "entries">): Player[] {
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const out: Player[] = [];
  const seen = new Set<string>();
  for (const p of s.players) {
    if (seen.has(p.id)) continue;
    const t = teamOf(s, p.id);
    if (!t && s.entries === "teams") continue;
    for (const id of t ? t.members : [p.id]) {
      const m = byId.get(id);
      if (m && !seen.has(id)) (seen.add(id), out.push(m));
    }
  }
  return out;
}

export const metres = (m: number | null | undefined) => (m ? `${m.toFixed(2)} m` : "–");
export const binText = (s: Cfg, bins: number | null) => (bins === null ? "–" : `${bins}/${binThrows(s)}`);
