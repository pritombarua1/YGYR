export type Phase = "lobby" | "rules" | "distance" | "bin" | "winners";
export type Round = "distance" | "bin";
/** Who can enter: solo pilots only, teams only, or both. */
export type Entries = "solo" | "teams" | "both";
/** Chosen when the game is created; changeable in the control Menu until the first round starts. */
export type Setup = { rounds: Round[]; entries: Entries; teamMax: number };

export interface Player {
  id: string;
  name: string;
  distance: number | null;
  bins: number | null;
  code?: string; // rejoin code: only sent to host screens
  tiebreak?: number | null; // throw-off distance (metres), only used to split a tie
  twin?: string[]; // host screens only: other pilots that look like the same phone (a hint, not proof)
}

/** Players join on their own, then start a team or ask to join one; the captain approves. */
export interface Team {
  id: string; // Team-01
  name: string;
  captain: string; // player id
  members: string[]; // player ids, captain first: also the order they're called in
  requests: string[]; // player ids waiting for the captain's OK
  tiebreak?: number | null;
}

/** A control phone the host has let in (host screens only). Admins logged in with the password. */
export interface Ctrl {
  id: string;
  name: string;
  admin: boolean;
  online: number; // open connections right now
}

export interface GameState {
  pin: string;
  phase: Phase;
  winners: number; // how many places are revealed at the end (3-10)
  rounds: Round[]; // which challenges run, in order (at least one)
  entries: Entries;
  teamMax: number; // most people in one team
  liveBoard: boolean; // true = standings visible during the rounds; false (default) = secret until the reveal
  reveal: number; // how many of those have been revealed so far
  ruleStep: number;
  up: string | null; // player called to throw right now
  away: { distance: string[]; bin: string[] }; // "not here" this round
  canRestore: string | null; // name of the last removed player (host screens only), for Undo
  controllers: number; // control phones connected right now
  players: Player[];
  teams: Team[];
  ctrl: Ctrl[]; // host screens only (empty for players)
  invite?: string; // host screens only: code in the "add a control phone" link
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
  | { t: "host"; ok: boolean; key?: string; ctrlKey?: string; ctrlId?: string; admin?: boolean; reason?: string }
  | { t: "error"; message: string; taken?: boolean; closed?: boolean }
  | { t: "removed"; reason?: "reset" }
  | { t: "nogame" }
  | { t: "stale" }; // a step change that arrived after the event had already moved on (ignored)
