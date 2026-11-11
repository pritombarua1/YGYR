import { DurableObject } from "cloudflare:workers";

export interface Env {
  GAME: DurableObjectNamespace<Game>;
  // Needed to create a game or take control. start.bat writes it to .dev.vars;
  // for a real deploy: `npx wrangler secret put HOST_PASSWORD`. Unset = no password.
  HOST_PASSWORD?: string;
}

const passwordOk = (env: Env, given: unknown) => !env.HOST_PASSWORD || given === env.HOST_PASSWORD;

type Phase = "lobby" | "rules" | "distance" | "bin" | "winners";
const PHASES: Phase[] = ["lobby", "rules", "distance", "bin", "winners"];
type Round = "distance" | "bin";
const ROUNDS: Round[] = ["distance", "bin"];
// Who can enter: solo pilots, teams, or both. Everyone joins as themselves; a player can then start a team
// (they become its captain) or ask to join one, and the captain accepts or declines. Team members are
// called one after another, and a team scores the average of its members (so team size doesn't matter).
type Entries = "solo" | "teams" | "both";
const ENTRIES: Entries[] = ["solo", "teams", "both"];
const MIN_TEAM = 2;
const MAX_TEAM = 6;
const TEAM_ACTIONS = ["createTeam", "requestTeam", "cancelRequest", "answerRequest", "kickMember", "leaveTeam"];

interface Player {
  id: string; // Pilot-01
  token: string; // secret kept on the player's phone
  code?: string; // short rejoin code, shown on their pass, for joining back from another phone/browser
  name: string;
  distance: number | null; // metres
  bins: number | null; // 0 to binThrows, null = not thrown yet
  tiebreak?: number | null; // throw-off metres, only used to split an exact tie
}

interface Team {
  id: string; // Team-01
  name: string;
  captain: string; // player id: the one who started it, approves requests
  members: string[]; // player ids, captain first, in the order they joined (= throwing order)
  requests: string[]; // player ids asking to join
  tiebreak?: number | null; // throw-off metres for the team, only used to split an exact tie
}

interface GameData {
  pin: string;
  hostKey: string;
  phase: Phase;
  winners?: number; // how many places get revealed at the end (3-10)
  rounds?: Round[]; // which challenges run, in order (at least one). Older games: both
  entries?: Entries;
  teamMax?: number; // most people in one team
  reveal: number; // how many of those places have been revealed so far
  ruleStep?: number; // which rule slide is showing
  up?: string | null; // player currently called to throw
  away?: Record<Round, string[]>; // "not here" this round: left out of the calling queue
  trash?: Player | null; // last removed player, so Remove can be undone
  seq: number;
  teamSeq?: number;
  players: Player[];
  teams?: Team[];
  createdAt: number;
}

// Who is on the other end of a socket. Stored on the socket so it survives hibernation.
// Hosts are either the big screen ("display", has the host key) or a control phone ("control", has the password).
type Tag = { role: "host" | "player" | "viewer"; kind?: "display" | "control"; playerId?: string };

const GAME_LIFETIME_MS = 12 * 60 * 60 * 1000; // a PIN can be reused after 12 hours
const MIN_WINNERS = 3;
const MAX_WINNERS = 10;
// Bin throws per entry: 3 alongside the distance round, 5 when the bin is the only challenge
// (more throws = fewer ties). Keep in step with web/src/config.ts.
const binThrows = (rounds: Round[]) => (rounds.includes("distance") ? 3 : 5);
const idNum = (id: string) => Number(id.replace(/\D/g, "")) || 0;

type Setup = { rounds: Round[]; entries: Entries; teamMax: number };
/** Cleans settings from the create screen or the control Menu. Anything missing keeps `base`. */
function cleanSetup(raw: any, base: Setup): Setup {
  const rounds = Array.isArray(raw?.rounds) ? ROUNDS.filter((r) => raw.rounds.includes(r)) : base.rounds;
  return {
    rounds: rounds.length ? rounds : base.rounds,
    entries: ENTRIES.includes(raw?.entries) ? raw.entries : base.entries,
    teamMax: raw?.teamMax === undefined ? base.teamMax : clampInt(raw.teamMax, MIN_TEAM, MAX_TEAM),
  };
}
const NEW_GAME: Setup = { rounds: ["distance"], entries: "both", teamMax: 4 };
const OLD_GAME: Setup = { rounds: ["distance", "bin"], entries: "solo", teamMax: 4 }; // games made before these settings existed

// No 0/O or 1/I, so codes are easy to read off a phone.
const newCode = () =>
  Array.from({ length: 4 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...CORS } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (url.pathname === "/api/create" && req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { password?: string; winners?: number; setup?: unknown };
      if (!passwordOk(env, body.password)) return json({ error: "Wrong host password." }, 401);
      const winners = clampInt(body.winners ?? MIN_WINNERS, MIN_WINNERS, MAX_WINNERS);
      for (let i = 0; i < 25; i++) {
        const pin = String(1000 + Math.floor(Math.random() * 9000));
        const hostKey = await env.GAME.get(env.GAME.idFromName(pin)).init(pin, winners, cleanSetup(body.setup, NEW_GAME));
        if (hostKey) return json({ pin, hostKey });
      }
      return json({ error: "No free PIN right now, try again." }, 503);
    }

    const ws = url.pathname.match(/^\/api\/game\/(\d{4})\/ws$/);
    if (ws) {
      if (req.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
      return env.GAME.get(env.GAME.idFromName(ws[1])).fetch(req);
    }

    return new Response("Paper Plane Challenge API", { headers: CORS });
  },
};

const cleanName = (raw: unknown) =>
  typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, 20) : "";

const clampInt = (n: unknown, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(Number(n) || 0)));

const isRound = (p: Phase): p is Round => p === "distance" || p === "bin";

export class Game extends DurableObject<Env> {
  game: GameData | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.game = (await ctx.storage.get<GameData>("game")) ?? null;
    });
    // Answer keep-alive pings without waking the object up.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  /** Claims this PIN for a new game. Returns the host key, or null if the PIN is in use. */
  async init(pin: string, winners: number, setup: Setup): Promise<string | null> {
    if (this.game && Date.now() - this.game.createdAt < GAME_LIFETIME_MS) return null;
    for (const ws of this.ctx.getWebSockets()) ws.close(1000, "New game");
    this.game = {
      pin,
      hostKey: crypto.randomUUID(),
      phase: "lobby",
      winners,
      ...setup,
      reveal: 0,
      away: { distance: [], bin: [] },
      seq: 0,
      teamSeq: 0,
      players: [],
      teams: [],
      createdAt: Date.now(),
    };
    await this.ctx.storage.put("game", this.game);
    return this.game.hostKey;
  }

  async fetch(): Promise<Response> {
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ role: "viewer" } satisfies Tag);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== "string") return;
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const g = this.game;
    if (!g) return this.send(ws, { t: "nogame" });
    g.away ??= { distance: [], bin: [] };
    g.winners ??= MIN_WINNERS;
    g.rounds ??= OLD_GAME.rounds;
    g.entries ??= OLD_GAME.entries;
    g.teamMax ??= OLD_GAME.teamMax;
    g.teams ??= [];
    g.teamSeq ??= 0;
    const tag = ws.deserializeAttachment() as Tag;

    if (msg.t === "hello") {
      if (msg.role === "host") {
        // The big screen that created the game has the key. Control phones use the password.
        const byKey = msg.key === g.hostKey;
        const byPassword = !!this.env.HOST_PASSWORD && msg.password === this.env.HOST_PASSWORD;
        const ok = byKey || byPassword;
        const kind = msg.as === "control" ? "control" : "display";
        ws.serializeAttachment({ role: ok ? "host" : "viewer", kind: ok ? kind : undefined } satisfies Tag);
        this.send(ws, { t: "host", ok, key: ok ? g.hostKey : undefined });
        if (ok && kind === "control") return this.broadcast(); // big screen learns a control phone is connected
      } else if (msg.role === "player") {
        const p = g.players.find((p) => p.token === msg.token);
        if (p) p.code ??= newCode();
        ws.serializeAttachment({ role: p ? "player" : "viewer", playerId: p?.id } satisfies Tag);
        this.send(ws, { t: "you", id: p?.id ?? null, code: p?.code });
      }
      // anyone else (the results page) just watches
      return this.send(ws, { t: "state", state: this.publicState(this.isHost(ws)) });
    }

    if (msg.t === "join") {
      if (tag.role === "player") return;
      const name = cleanName(msg.name);
      if (!name) return this.error(ws, "Your name needs 1 to 20 characters.");
      const existing = g.players.find((o) => o.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        // Same person on a new phone or browser: their rejoin code lets them back in as themselves.
        const code = String(msg.code ?? "").trim().toUpperCase();
        if (code && code === existing.code) {
          ws.serializeAttachment({ role: "player", playerId: existing.id } satisfies Tag);
          return this.send(ws, { t: "you", id: existing.id, token: existing.token, code: existing.code });
        }
        return this.send(ws, {
          t: "error",
          taken: true,
          message: code
            ? "That rejoin code doesn't match. Check your screenshot, or ask the host."
            : `"${name}" is already on board. If that's you, enter your rejoin code. If not, add an initial.`,
        });
      }
      g.seq++;
      const player: Player = {
        id: `Pilot-${String(g.seq).padStart(2, "0")}`,
        token: crypto.randomUUID(),
        code: newCode(),
        name,
        distance: null,
        bins: null,
      };
      g.players.push(player);
      if (!g.up) this.callNext(null); // a late joiner gets called if the queue was empty
      ws.serializeAttachment({ role: "player", playerId: player.id } satisfies Tag);
      this.send(ws, { t: "you", id: player.id, token: player.token, code: player.code });
      return this.commit();
    }

    // Teams, from a player's own phone. Allowed until the first round starts (the host can always fix teams).
    if (tag.role === "player" && TEAM_ACTIONS.includes(msg.t)) {
      const me = g.players.find((o) => o.id === tag.playerId);
      if (!me) return;
      if (g.entries === "solo") return this.error(ws, "This event is individuals only.");
      if (g.phase !== "lobby" && g.phase !== "rules") return this.error(ws, "Teams are locked now that the throwing has started. Ask the host.");
      const mine = this.teamOf(me.id);
      switch (msg.t) {
        case "createTeam": {
          const name = cleanName(msg.name);
          if (!name) return this.error(ws, "Your team name needs 1 to 20 characters.");
          if (mine) return this.error(ws, `You're already in ${mine.name}. Leave it first.`);
          if (g.teams!.some((t) => t.name.toLowerCase() === name.toLowerCase())) return this.error(ws, `There's already a team called "${name}".`);
          this.dropRequests(me.id);
          g.teamSeq!++;
          g.teams!.push({ id: `Team-${String(g.teamSeq).padStart(2, "0")}`, name, captain: me.id, members: [me.id], requests: [] });
          break;
        }
        case "requestTeam": {
          const t = g.teams!.find((t) => t.id === msg.team);
          if (!t) return this.error(ws, "That team doesn't exist any more.");
          if (mine) return this.error(ws, `You're already in ${mine.name}. Leave it first.`);
          if (t.members.length >= g.teamMax!) return this.error(ws, `${t.name} is full (${g.teamMax} people).`);
          this.dropRequests(me.id); // one request at a time
          t.requests.push(me.id);
          break;
        }
        case "cancelRequest":
          this.dropRequests(me.id);
          break;
        case "answerRequest": {
          // only the captain decides who joins
          const t = g.teams!.find((t) => t.captain === me.id);
          if (!t || !t.requests.includes(msg.id)) return;
          t.requests = t.requests.filter((id) => id !== msg.id);
          if (!msg.ok) break;
          if (this.teamOf(msg.id)) return this.error(ws, "They've joined another team already.");
          if (t.members.length >= g.teamMax!) return this.error(ws, `Your team is full (${g.teamMax} people).`);
          this.dropRequests(msg.id);
          t.members.push(msg.id);
          break;
        }
        case "kickMember": {
          const t = g.teams!.find((t) => t.captain === me.id);
          if (!t || msg.id === me.id) return;
          t.members = t.members.filter((id) => id !== msg.id);
          break;
        }
        case "leaveTeam":
          if (mine) this.leave(mine, me.id);
          break;
      }
      return this.commit();
    }

    // Everything below is host-only (big screen or control phone).
    if (tag.role !== "host") return;
    const p = g.players.find((p) => p.id === msg.id);

    // A double tap, two control phones pressing at once, or a tap queued while offline can arrive
    // after the event has already moved on. Step changes say where they started ("from") and are
    // ignored if that is no longer true, so one press never moves the event twice.
    if (msg.from !== undefined) {
      const now = msg.t === "rule" ? (g.ruleStep ?? 0) : msg.t === "reveal" ? g.reveal : g.phase;
      if (msg.from !== now || (msg.t === "rule" && g.phase !== "rules")) return this.send(ws, { t: "stale" });
    }

    switch (msg.t) {
      case "phase":
        if (!PHASES.includes(msg.phase) || (isRound(msg.phase) && !g.rounds!.includes(msg.phase))) return;
        g.phase = msg.phase;
        g.reveal = 0;
        g.ruleStep = clampInt(msg.ruleStep, 0, 9); // "Back" from round 1 lands on the last rule
        g.up = null;
        this.callNext(null);
        break;
      case "rule":
        g.ruleStep = clampInt(msg.step, 0, 9);
        break;
      case "reveal":
        g.reveal = clampInt(msg.step, 0, g.winners);
        break;
      case "settings":
        if (msg.winners !== undefined) {
          g.winners = clampInt(msg.winners, MIN_WINNERS, MAX_WINNERS);
          g.reveal = Math.min(g.reveal, g.winners);
        }
        if (msg.setup) {
          // which challenges run and who can enter: only until the first round starts
          if (g.phase !== "lobby" && g.phase !== "rules") return this.error(ws, "The challenges are locked once the first round has started.");
          Object.assign(g, cleanSetup(msg.setup, { rounds: g.rounds!, entries: g.entries!, teamMax: g.teamMax! }));
          const max = binThrows(g.rounds!);
          for (const o of g.players) if (o.bins !== null) o.bins = Math.min(o.bins, max);
        }
        break;
      case "setTeam": {
        // host moves a player into a team (no approval needed), or out of one (team: null)
        if (!p) return;
        const from = this.teamOf(p.id);
        const to = msg.team ? g.teams!.find((t) => t.id === msg.team) : null;
        if (msg.team && !to) return;
        if (from === to) break;
        if (to && to.members.length >= g.teamMax!) return this.error(ws, `${to.name} is full (${g.teamMax} people).`);
        if (from) this.leave(from, p.id);
        this.dropRequests(p.id);
        to?.members.push(p.id);
        break;
      }
      case "newTeam": {
        // host starts a team for a player (they become captain)
        if (!p) return;
        const name = cleanName(msg.name);
        if (!name || g.teams!.some((t) => t.name.toLowerCase() === name.toLowerCase())) return this.error(ws, "That team name is empty or already taken.");
        const from = this.teamOf(p.id);
        if (from) this.leave(from, p.id);
        this.dropRequests(p.id);
        g.teamSeq!++;
        g.teams!.push({ id: `Team-${String(g.teamSeq).padStart(2, "0")}`, name, captain: p.id, members: [p.id], requests: [] });
        break;
      }
      case "renameTeam": {
        const t = g.teams!.find((t) => t.id === msg.team);
        const name = cleanName(msg.name);
        if (!t) return;
        if (!name || g.teams!.some((o) => o !== t && o.name.toLowerCase() === name.toLowerCase())) return this.error(ws, "That team name is empty or already taken.");
        t.name = name;
        break;
      }
      case "deleteTeam": // everyone in it flies solo again
        g.teams = g.teams!.filter((t) => t.id !== msg.team);
        break;
      case "call": // host picks who throws now
        if (!p) return;
        if (isRound(g.phase)) g.away[g.phase] = g.away[g.phase].filter((id) => id !== p.id); // called = here
        g.up = p.id;
        break;
      case "skip": // called player isn't ready: move on, they come round again later
        if (msg.id && msg.id !== g.up) return; // a second tap: we already moved past them
        this.callNext(g.up ?? null);
        break;
      case "away": {
        // "Not here": out of this round's queue until brought back
        if (!p || !isRound(g.phase)) return;
        const list = g.away[g.phase].filter((id) => id !== p.id);
        if (msg.on) list.push(p.id);
        g.away[g.phase] = list;
        if (msg.on && g.up === p.id) this.callNext(p.id);
        if (!msg.on && !g.up) this.callNext(null);
        break;
      }
      case "tiebreak": {
        // throw-off distance for splitting a tie (null clears it). id = a solo pilot or a team
        const who = p ?? g.teams!.find((t) => t.id === msg.id);
        if (!who) return;
        const m = msg.m === null ? null : Number(msg.m);
        if (m !== null && !(m > 0 && m <= 60)) return this.error(ws, "Throw-off distance should be between 0 and 60 m.");
        who.tiebreak = m === null ? null : Math.round(m * 100) / 100;
        break;
      }
      case "setBins": // exact value, from Edit and Undo
        if (!p) return;
        p.bins = msg.n === null ? null : clampInt(msg.n, 0, binThrows(g.rounds!));
        if (g.phase === "bin" && !g.up) this.callNext(null);
        break;
      case "binDone":
        if (!p) return;
        p.bins ??= 0;
        if (g.up === p.id) this.callNext(p.id);
        break;
      case "distance": {
        if (!p) return;
        if (msg.m === null) {
          p.distance = null;
          if (g.phase === "distance" && !g.up) this.callNext(null);
          break;
        }
        const m = Number(msg.m);
        if (!(m > 0 && m <= 60)) return this.error(ws, "Distance should be between 0 and 60 m.");
        p.distance = Math.round(m * 100) / 100;
        if (g.phase === "distance" && g.up === p.id) this.callNext(p.id); // landed: call the next one
        break;
      }
      case "bin":
        // Applied here, not on the phone, so quick taps never get lost.
        // Minus on "not thrown" marks "thrown, none in"; minus on 0 clears it again.
        if (!p) return;
        if (msg.dir === 1) p.bins = Math.min(binThrows(g.rounds!), (p.bins ?? 0) + 1);
        else p.bins = p.bins === null ? 0 : p.bins === 0 ? null : p.bins - 1;
        break;
      case "rename": {
        if (!p) return;
        const name = cleanName(msg.name);
        if (!name || this.nameTaken(name, p)) return this.error(ws, "That name is empty or already taken.");
        p.name = name;
        break;
      }
      case "remove":
        if (!p) return;
        if (g.up === p.id) this.callNext(p.id);
        g.players = g.players.filter((o) => o !== p);
        if (g.up === p.id) g.up = null;
        { const t = this.teamOf(p.id); if (t) this.leave(t, p.id); }
        this.dropRequests(p.id);
        g.trash = p; // kept so it can be undone
        for (const s of this.ctx.getWebSockets()) {
          if ((s.deserializeAttachment() as Tag).playerId === p.id) {
            this.send(s, { t: "removed" });
            s.serializeAttachment({ role: "viewer" } satisfies Tag);
          }
        }
        break;
      case "reset": {
        // Fresh start on the same PIN (same QR codes, same link): everyone joins again.
        for (const s of this.ctx.getWebSockets()) {
          const t = s.deserializeAttachment() as Tag;
          if (t.role === "player") {
            this.send(s, { t: "removed", reason: "reset" });
            s.serializeAttachment({ role: "viewer" } satisfies Tag);
          }
        }
        Object.assign(g, { phase: "lobby", reveal: 0, ruleStep: 0, up: null, away: { distance: [], bin: [] }, trash: null, seq: 0, teamSeq: 0, players: [], teams: [] });
        break;
      }
      case "restore": {
        // undo the last Remove: same ID, scores and rejoin code (their phone rejoins with name + code)
        const t = g.trash;
        if (!t) return;
        if (this.nameTaken(t.name)) return this.error(ws, `Someone else is now called "${t.name}". Rename them first.`);
        g.players.push(t);
        g.players.sort((a, b) => idNum(a.id) - idNum(b.id)); // back in join order (Pilot-04 before Team-05)
        g.trash = null;
        if (!g.up) this.callNext(null);
        break;
      }
      default:
        return;
    }
    return this.commit();
  }

  async webSocketClose(ws: WebSocket, code: number) {
    const tag = ws.deserializeAttachment() as Tag;
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, "Bye");
    } catch {
      // already closed
    }
    if (tag.role === "host" && tag.kind === "control" && this.game) this.broadcast(ws); // big screen sees the phone left
  }

  private teamOf(playerId: string) {
    return this.game!.teams!.find((t) => t.members.includes(playerId)) ?? null;
  }

  private dropRequests(playerId: string) {
    for (const t of this.game!.teams!) t.requests = t.requests.filter((id) => id !== playerId);
  }

  /** Takes a player out of a team. A captain who leaves hands over to the next member; an empty team is removed. */
  private leave(t: Team, playerId: string) {
    const g = this.game!;
    t.members = t.members.filter((id) => id !== playerId);
    if (!t.members.length) g.teams = g.teams!.filter((o) => o !== t);
    else if (t.captain === playerId) t.captain = t.members[0];
  }

  /**
   * Who throws, in order: join order, except that a team's members are called one after another
   * (in team formation) when the first of them comes up. Teams-only events leave solo pilots out.
   */
  private throwOrder() {
    const g = this.game!;
    const useTeams = g.entries !== "solo";
    const byId = new Map(g.players.map((p) => [p.id, p]));
    const out: Player[] = [];
    const seen = new Set<string>();
    for (const p of g.players) {
      if (seen.has(p.id)) continue;
      const t = useTeams ? this.teamOf(p.id) : null;
      if (!t && g.entries === "teams") continue;
      for (const id of t ? t.members : [p.id]) {
        const m = byId.get(id);
        if (m && !seen.has(id)) (seen.add(id), out.push(m));
      }
    }
    return out;
  }

  private nameTaken(name: string, except?: Player) {
    return this.game!.players.some((o) => o !== except && o.name.toLowerCase() === name.toLowerCase());
  }

  /**
   * Calls the next player who hasn't thrown this round, going round in join order
   * from `after`. Skipped players come round again; "not here" players are left out.
   * Nobody left = null (the round is complete).
   */
  private callNext(after: string | null) {
    const g = this.game!;
    if (!isRound(g.phase)) return void (g.up = null);
    const away = new Set(g.away?.[g.phase] ?? []);
    const todo = (p: Player) => !away.has(p.id) && (g.phase === "bin" ? p.bins === null : p.distance === null);
    const order = this.throwOrder();
    const n = order.length;
    const start = after ? order.findIndex((p) => p.id === after) : -1;
    for (let k = 1; k <= n; k++) {
      const p = order[(((start + k) % n) + n) % n];
      if (todo(p)) return void (g.up = p.id);
    }
    g.up = null;
  }

  private isHost(ws: WebSocket) {
    return (ws.deserializeAttachment() as Tag).role === "host";
  }

  private controllers(except?: WebSocket) {
    return this.ctx.getWebSockets().filter((s) => {
      const t = s.deserializeAttachment() as Tag;
      return s !== except && t.role === "host" && t.kind === "control";
    }).length;
  }

  /** Tokens never leave the server. Rejoin codes go to host screens only (for helping someone back in). */
  private publicState(forHost = false, closing?: WebSocket) {
    const g = this.game!;
    return {
      pin: g.pin,
      phase: g.phase,
      winners: g.winners ?? MIN_WINNERS,
      rounds: g.rounds ?? OLD_GAME.rounds,
      entries: g.entries ?? OLD_GAME.entries,
      teamMax: g.teamMax ?? OLD_GAME.teamMax,
      reveal: g.reveal,
      ruleStep: g.ruleStep ?? 0,
      up: g.up ?? null,
      away: g.away ?? { distance: [], bin: [] },
      canRestore: forHost ? g.trash?.name ?? null : null,
      controllers: this.controllers(closing),
      players: g.players.map(({ token, code, ...rest }) => (forHost ? { ...rest, code } : rest)),
      teams: g.teams ?? [],
    };
  }

  private async commit() {
    await this.ctx.storage.put("game", this.game);
    this.broadcast();
  }

  private broadcast(closing?: WebSocket) {
    const msg = JSON.stringify({ t: "state", state: this.publicState(false, closing) });
    const hostMsg = JSON.stringify({ t: "state", state: this.publicState(true, closing) });
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === closing) continue;
      try {
        ws.send(this.isHost(ws) ? hostMsg : msg);
      } catch {
        // socket went away mid-broadcast; it will reconnect
      }
    }
  }

  private send(ws: WebSocket, data: unknown) {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      // ignore
    }
  }

  private error(ws: WebSocket, message: string) {
    this.send(ws, { t: "error", message });
  }
}
