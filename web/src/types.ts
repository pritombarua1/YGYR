export type Phase = "lobby" | "rules" | "distance" | "bin" | "winners";
export type Round = "distance" | "bin";
/** Who can enter: solo pilots only, teams only, or both. */
export type Entries = "solo" | "teams" | "both";
/** Chosen when the game is created; changeable in the control Menu until the first round starts. */
export type Setup = { rounds: Round[]; entries: Entries; teamMax: number };

export interface Player {
  id: string;
  name: string; // the team's name, for a team
  team?: string[] | null; // member names when this entry is a team
  distance: number | null;
  bins: number | null;
  code?: string; // rejoin code: only sent to host screens
  tiebreak?: number | null; // throw-off distance (metres), only used to split a tie
}

export interface GameState {
  pin: string;
  phase: Phase;
  winners: number; // how many places are revealed at the end (3-10)
  rounds: Round[]; // which challenges run, in order (at least one)
  entries: Entries;
  teamMax: number; // most people in one team
  reveal: number; // how many of those have been revealed so far
  ruleStep: number;
  up: string | null; // player called to throw right now
  away: { distance: string[]; bin: string[] }; // "not here" this round
  canRestore: string | null; // name of the last removed player (host screens only), for Undo
  controllers: number; // control phones connected right now
  players: Player[];
}

/** Host screen URLs: /host/lobby, /host/rules, /host/round1-distance, /host/round2-bin, /host/winner */
export const PHASE_SLUG: Record<Phase, string> = {
  lobby: "lobby",
  rules: "rules",
  distance: "round1-distance",
  bin: "round2-bin",
  winners: "winner",
};

export const phaseFromSlug = (slug: string | undefined) =>
  (Object.keys(PHASE_SLUG) as Phase[]).find((p) => PHASE_SLUG[p] === slug || p === slug) ??
  (slug === "winners" ? "winners" : undefined);

export type ServerMsg =
  | { t: "state"; state: GameState }
  | { t: "you"; id: string | null; token?: string; code?: string }
  | { t: "host"; ok: boolean; key?: string }
  | { t: "error"; message: string; taken?: boolean }
  | { t: "removed"; reason?: "reset" }
  | { t: "nogame" }
  | { t: "stale" }; // a step change that arrived after the event had already moved on (ignored)
