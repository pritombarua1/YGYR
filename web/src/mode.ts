import { SCORING } from "./config";
import type { GameState, Phase, Player, Round } from "./types";

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

export const isTeam = (p: Pick<Player, "team">) => !!p.team?.length;
export const members = (p: Pick<Player, "team">) => (p.team ?? []).join(", ");
/** "Pilot" or "Team", for labels. */
export const kind = (p: Pick<Player, "team">) => (isTeam(p) ? "Team" : "Pilot");

export const metres = (m: number | null | undefined) => (m ? `${m.toFixed(2)} m` : "–");
export const binText = (s: Cfg, bins: number | null) => (bins === null ? "–" : `${bins}/${binThrows(s)}`);
