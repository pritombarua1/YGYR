import { useEffect, useMemo, useRef, useState } from "react";
import { store, useGame } from "../api";
import { ordinal, score, scoreText } from "../scoring";
import { binText, binThrows, finished, modeOf, PHASE_LABEL, teamLabel, teamMatches, teamOf } from "../mode";
import { SetupPicker, describeSetup } from "../components/SetupPicker";
import { callOrder, hasThrown, isAway, matches, roundStatus } from "../queue";
import { backStep, nextStep, type Step } from "../flow";
import type { GameState, Player, Team } from "../types";
import { useDialog } from "../components/Dialog";
import { useWakeLock } from "../wakelock";
import { Dots, Search } from "../components/Inputs";
import { rulesFor, withWinners } from "../components/RuleSlides";
import { Leaderboard } from "../components/Leaderboard";
import { EditPlayer, type Fix } from "../components/EditPlayer";
import { ReadmeSheet } from "../components/Readme";
import { UpdatePanel } from "../components/UpdatePanel";
import { Controllers } from "../components/Controllers";
import { podiumTies, winnersOf } from "../components/Podium";

/*
 * The control phone: runs the whole event. The big screen only shows what this does.
 * Open /control?pin=1234 (the big screen shows a QR for it) and enter the host password.
 * Several phones (or the laptop) can be controls at once; they all see the same thing.
 */

/**
 * What this phone remembers. `key` is its own controller key from the server: after the first login it
 * reconnects with that alone, so when the host removes this phone it stays removed. `password` is kept
 * only for the Update button (the laptop's updater asks for it); `invite` = joined from the host's link.
 */
type ControlCreds = { pin: string; password: string; name: string; key?: string; id?: string; invite?: string; admin?: boolean };
type Send = (m: any) => void;
type Undo = { key: number; label: string; restore: object[] };

export default function Control() {
  const [creds, setCreds] = useState(() => store.get<ControlCreds>("pp:control"));
  const [pin, setPin] = useState(() => new URLSearchParams(location.search).get("pin") ?? creds?.pin ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(() => creds?.name ?? store.get<string>("pp:control-name") ?? "");
  const invite = new URLSearchParams(location.search).get("invite")?.toUpperCase() ?? "";
  const [error, setError] = useState("");

  // a control link for a different game replaces the remembered one
  useEffect(() => {
    const urlPin = new URLSearchParams(location.search).get("pin");
    if (urlPin && creds && urlPin !== creds.pin) {
      store.set("pp:control", null);
      setCreds(null);
    }
  }, []);

  const logout = (message = "") => {
    setError(message);
    store.set("pp:control", null);
    setCreds(null);
  };

  const [toast, setToast] = useState("");
  const toastTimer = useRef<number>();
  const flash = (m: string) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 4000);
  };

  const { state, online, send } = useGame(
    creds?.pin ?? null,
    () =>
      creds?.key
        ? { t: "hello", role: "host", as: "control", ctrlKey: creds.key }
        : { t: "hello", role: "host", as: "control", password: creds?.password, invite: creds?.invite, name: creds?.name },
    (m) => {
      if (m.t === "host" && m.ok && m.ctrlKey && creds && (m.ctrlKey !== creds.key || m.ctrlId !== creds.id || !!m.admin !== !!creds.admin)) {
        const c = { ...creds, key: m.ctrlKey, id: m.ctrlId, admin: !!m.admin };
        store.set("pp:control", c);
        setCreds(c);
      }
      if (m.t === "host" && !m.ok)
        logout(
          m.reason === "removed"
            ? "The host took this phone off the controls. Ask them for an invite link, or log in with the host password."
            : (m.reason ?? (creds?.invite ? "That invite link doesn't work any more. Ask the host for the new one." : "Wrong PIN or password.")),
        );
      if (m.t === "nogame") logout(`There's no game with PIN ${creds?.pin}.`);
      if (m.t === "error") flash(m.message);
      if (m.t === "stale") flash("Already done (that tap arrived after the event moved on), so it was ignored.");
    },
  );

  if (!creds) {
    return (
      <div className="phone">
        <div className="airmail" />
        <main className="phone-main">
          <header className="phone-hero">
            <h1 className="display">Controls</h1>
            <p className="hand">Run the whole event from here.</p>
          </header>
          <form
            className="sheet taped form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^\d{4}$/.test(pin)) return setError("The PIN is the 4 digits on the big screen.");
              if (!invite && !password) return setError("Type the host password (or scan an invite QR from the host).");
              setError("");
              const who = name.trim().slice(0, 20);
              store.set("pp:control-name", who);
              const c: ControlCreds = { pin, password: invite ? "" : password, name: who, invite: invite || undefined };
              store.set("pp:control", c);
              setCreds(c);
            }}
          >
            <label htmlFor="cpin">Game PIN</label>
            <input id="cpin" className="pin-input" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="0000" />
            <label htmlFor="cname">Your name (so the host knows whose phone this is)</label>
            <input id="cname" maxLength={20} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam" />
            {invite ? (
              <p className="notice">You were invited by the host: no password needed.</p>
            ) : (
              <>
                <label htmlFor="cpw">Host password</label>
                <input id="cpw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </>
            )}
            {error && <p className="error">{error}</p>}
            <button className="btn red">Take control</button>
          </form>
        </main>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="phone">
        <div className="airmail" />
        <main className="phone-main">
          <p className="hand center-note">Connecting to gate {creds.pin}…</p>
          <button className="link foot-link" onClick={() => logout()}>
            Use a different game
          </button>
        </main>
      </div>
    );
  }

  return (
    <ControlApp
      state={state}
      online={online}
      send={send}
      toast={toast}
      flash={flash}
      password={creds.password}
      me={{ id: creds.id ?? "", admin: !!creds.admin }}
      onLogout={() => logout()}
    />
  );
}

const describe = (m: any, p: Player) => {
  switch (m.t) {
    case "distance":
      return m.m === null ? `Cleared ${p.name}'s distance` : `${p.name}: ${Number(m.m).toFixed(2)} m`;
    case "bin":
      return `${p.name}: ${m.dir === 1 ? "+1" : "−1"} in the bin`;
    case "binDone":
      return `${p.name}: bin throws done`;
    case "away":
      return m.on ? `${p.name} marked not here` : `${p.name} is back`;
    default:
      return null;
  }
};

function ControlApp({
  state,
  online,
  send,
  toast,
  flash,
  password,
  me,
  onLogout,
}: {
  state: GameState;
  online: boolean;
  send: Send;
  toast: string;
  flash: (m: string) => void;
  password: string;
  me: { id: string; admin: boolean };
  onLogout: () => void;
}) {
  const dialog = useDialog();
  useWakeLock(); // a locked phone drops its connection, so keep this one awake
  const scored = useMemo(() => score(state), [state.players, state.teams, state.rounds, state.entries]);
  const [menu, setMenu] = useState(false);
  const [guide, setGuide] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 10000);
    return () => clearTimeout(t);
  }, [undo]);

  // Every scoring action is remembered for one Undo (including the call order).
  const remember = (p: Player, label: string, extra: object[] = []) => {
    const restore: object[] = [
      ...extra,
      { t: "distance", id: p.id, m: p.distance },
      { t: "setBins", id: p.id, n: p.bins },
      ...(state.up ? [{ t: "call", id: state.up }] : []),
    ];
    setUndo({ key: Date.now(), label, restore });
  };
  const act: Send = (m) => {
    const p = state.players.find((x) => x.id === m.id);
    const label = p && describe(m, p);
    if (p && label) {
      const extra = m.t === "away" ? [{ t: "away", id: p.id, on: !m.on }] : [];
      remember(p, label, extra);
    }
    send(m);
  };
  const remove = async (p: Player) => {
    const ok = await dialog.confirm(`Remove ${p.name}?`, {
      body: `${p.id} comes off the board and loses their scores${teamOf(state, p.id) ? " (and leaves their team)" : ""}. You can undo this straight after.`,
      okLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    send({ t: "remove", id: p.id });
    setUndo({ key: Date.now(), label: `Removed ${p.name}`, restore: [{ t: "restore" }] });
    setEditing(null);
  };
  const applyFix = (p: Player, fix: Fix) => {
    const was = teamOf(state, p.id)?.id ?? null;
    const moved = !!fix.newTeam || fix.team !== was;
    remember(p, `Edited ${p.name}`, [
      ...(fix.name !== p.name ? [{ t: "rename", id: p.id, name: p.name }] : []),
      ...(moved ? [{ t: "setTeam", id: p.id, team: was }] : []),
      { t: "tiebreak", id: p.id, m: p.tiebreak ?? null },
    ]);
    if (fix.name !== p.name) send({ t: "rename", id: p.id, name: fix.name });
    if (fix.newTeam) send({ t: "newTeam", id: p.id, name: fix.newTeam });
    else if (moved) send({ t: "setTeam", id: p.id, team: fix.team });
    if (fix.distance !== p.distance) send({ t: "distance", id: p.id, m: fix.distance });
    if (fix.bins !== p.bins) send({ t: "setBins", id: p.id, n: fix.bins });
    if (fix.tiebreak !== (p.tiebreak ?? null)) send({ t: "tiebreak", id: p.id, m: fix.tiebreak });
    setEditing(null);
  };

  const go = async (step: Step | null) => {
    if (!step) return;
    if (step.confirm) {
      const ok = await dialog.confirm(step.confirm.title, { body: step.confirm.body, okLabel: step.confirm.ok });
      if (!ok) return;
    }
    send(step.msg);
  };

  // When the last pilot of a round has thrown, ask whether to move on.
  const status = roundStatus(state);
  const wasComplete = useRef(status.complete);
  useEffect(() => {
    const now = status.complete && status.away.length === 0;
    if (now && !wasComplete.current) {
      const step = nextStep(state);
      if (step)
        dialog
          .confirm(state.phase === "distance" ? "Everyone has thrown!" : "Bin round done!", {
            body: `${step.label} now? The big screen moves on straight away.`,
            okLabel: step.label,
          })
          .then((ok) => ok && send(step.msg));
    }
    wasComplete.current = now;
  }, [status.complete, status.away.length, state.phase]);

  const next = nextStep(state);
  const back = backStep(state);
  const phaseLabel = PHASE_LABEL[state.phase];
  const rules = rulesFor(state);
  const editingPlayer = state.players.find((p) => p.id === editing);
  const editingTeam = state.teams.find((t) => t.id === editing);

  return (
    <div className="phone control">
      <div className="airmail" />
      {!online && <div className="offline">Reconnecting… (taps wait until it's back)</div>}
      <header className="control-head">
        <div>
          <span className="pass-k">Gate {state.pin}</span>
          <strong>{state.phase === "rules" ? `Rules ${Math.min(state.ruleStep + 1, rules.length)}/${rules.length}` : phaseLabel}</strong>
        </div>
        <span className="control-count">{state.players.length} on board</span>
        <button className="btn" onClick={() => setGuide(true)}>
          Guide
        </button>
        <button className="btn" onClick={() => setMenu(true)}>
          Menu
        </button>
      </header>

      <main className="phone-main control-main">
        {state.phase === "lobby" && <LobbyPanel state={state} onEdit={setEditing} />}
        {state.phase === "rules" && (
          <>
            <RulesPanel state={state} send={send} />
            <TeamsPanel state={state} onEdit={setEditing} />
          </>
        )}
        {(state.phase === "distance" || state.phase === "bin") && (
          <RoundPanel state={state} act={act} send={send} onEdit={setEditing} onNext={() => go(next)} nextLabel={next?.label ?? "Next"} />
        )}
        {state.phase === "winners" && <WinnersPanel state={state} send={send} onEdit={setEditing} />}
      </main>

      <nav className="control-nav">
        <button className="btn" disabled={!back} onClick={() => go(back)}>
          ← {back?.label ?? "Back"}
        </button>
        <button className="btn red" disabled={!next} onClick={() => go(next)}>
          {next?.label ?? "Last step"} →
        </button>
      </nav>

      {undo && (
        <div className="undo-bar phone-undo" key={undo.key} role="status">
          <span>{undo.label}</span>
          <button
            className="btn"
            onClick={() => {
              undo.restore.forEach(send);
              setUndo(null);
              flash("Undone");
            }}
          >
            Undo
          </button>
        </div>
      )}

      {menu && (
        <Menu
          state={state}
          send={send}
          scored={scored}
          onEdit={(id) => (setMenu(false), setEditing(id))}
          onClose={() => setMenu(false)}
          onGuide={() => (setMenu(false), setGuide(true))}
          onLogout={onLogout}
          password={password}
          me={me}
        />
      )}
      {guide && <ReadmeSheet onClose={() => setGuide(false)} />}
      {editingPlayer && (
        <EditPlayer p={editingPlayer} cfg={state} onSave={(fix) => applyFix(editingPlayer, fix)} onClose={() => setEditing(null)} onRemove={() => remove(editingPlayer)} />
      )}
      {editingTeam && <TeamEdit t={editingTeam} state={state} send={send} onEdit={setEditing} onClose={() => setEditing(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/** Host view of one team: rename, see members (tap to fix one), throw-off, break the team up. */
function TeamEdit({ t, state, send, onEdit, onClose }: { t: Team; state: GameState; send: Send; onEdit: (id: string) => void; onClose: () => void }) {
  const dialog = useDialog();
  const [name, setName] = useState(t.name);
  const [tb, setTb] = useState(t.tiebreak?.toString() ?? "");
  const who = (id: string) => state.players.find((p) => p.id === id);
  return (
    <div className="dialog-back" onClick={onClose}>
      <form
        className="dialog edit sheet taped"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${t.name}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() !== t.name) send({ t: "renameTeam", team: t.id, name: name.trim() });
          const m = tb.trim() === "" ? null : Number(tb.replace(",", "."));
          if (m !== (t.tiebreak ?? null)) send({ t: "tiebreak", id: t.id, m });
          onClose();
        }}
      >
        <h2 className="display">Fix {t.id}</h2>
        <label htmlFor="team-name">Team name</label>
        <input id="team-name" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
        <span className="edit-label">
          Members ({t.members.length}/{state.teamMax}). Tap one to fix their throws or move them.
        </span>
        <ul className="team-admin">
          {t.members.map((id) => (
            <li key={id}>
              <button type="button" className="chip" onClick={() => onEdit(id)}>
                {who(id)?.name ?? id} <small>{id === t.captain ? "captain" : id}</small>
              </button>
            </li>
          ))}
        </ul>
        {t.requests.length > 0 && (
          <p className="hint">
            Waiting for the captain's OK: {t.requests.map((id) => who(id)?.name ?? id).join(", ")}. (To add someone straight away, Edit them and pick this team.)
          </p>
        )}
        <label htmlFor="team-tb">Throw-off (metres): only to split a tie</label>
        <input id="team-tb" inputMode="decimal" placeholder="empty = no throw-off" value={tb} onChange={(e) => setTb(e.target.value)} />
        <div className="dialog-actions">
          <button
            type="button"
            className="link danger edit-remove"
            onClick={async () => {
              const ok = await dialog.confirm(`Break up ${t.name}?`, { body: "Everyone in it flies solo again. Their own throws are kept.", okLabel: "Break up", danger: true });
              if (ok) (send({ t: "deleteTeam", team: t.id }), onClose());
            }}
          >
            Break up team
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn navy">Save</button>
        </div>
      </form>
    </div>
  );
}

/** Teams so far (lobby): who's in, who's waiting for the captain. */
function TeamsPanel({ state, onEdit }: { state: GameState; onEdit: (id: string) => void }) {
  const [query, setQuery] = useState("");
  if (state.entries === "solo") return null;
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? id;
  const shown = state.teams.filter((t) => teamMatches(state, t, query));
  const loners = state.players.filter((p) => !teamOf(state, p.id));
  return (
    <section className="panel sheet">
      <header className="pilots-head">
        <h3 className="display">Teams ({state.teams.length})</h3>
        {state.teams.length > 0 && <Search value={query} onChange={setQuery} placeholder="Team, ID or member" label="Search teams" />}
      </header>
      {state.teams.length > 0 && shown.length === 0 && <p className="hand empty">No team matches "{query}".</p>}
      {state.teams.length === 0 && <p className="hint">Nobody has started a team yet. Players do it on their own phone after joining.</p>}
      <ul className="pilot-list">
        {shown.map((t) => (
          <li key={t.id}>
            <span className="pl-id">{t.id}</span>
            <span className="pl-name">
              {t.name}
              <small className="pl-team">
                {t.members.map(name).join(", ")}
                {t.requests.length > 0 && ` · ${t.requests.length} waiting`}
              </small>
            </span>
            <span className="pl-actions">
              <button className="btn" onClick={() => onEdit(t.id)}>
                Edit
              </button>
            </span>
          </li>
        ))}
      </ul>
      {state.entries === "teams" && loners.length > 0 && (
        <p className="notice">
          Teams only: {loners.length} {loners.length === 1 ? "player isn't" : "players aren't"} in a team yet and won't be called ({loners.map((p) => p.name).join(", ")}).
        </p>
      )}
    </section>
  );
}

/* ---------- lobby ---------- */

function LobbyPanel({ state, onEdit }: { state: GameState; onEdit: (id: string) => void }) {
  return (
    <>
      <section className="panel sheet">
        <h2 className="display">Lobby</h2>
        <p>
          People scan the QR on the big screen. <b>{state.players.length}</b> on board so far. Rename anyone with a silly name, or remove a
          duplicate, from the list below.
        </p>
        <p className="setup-sum">{describeSetup(state)}</p>
        <p className="hint">Change the rounds or teams in Menu (until the first round starts).</p>
        {state.players.some((p) => p.twin) && (
          <p className="notice">
            {state.players.filter((p) => p.twin).length} passes look like they're from the same phone (marked ⚠ below). Often it's two friends with the same
            phone model, so ask before removing anyone.
          </p>
        )}
      </section>
      <TeamsPanel state={state} onEdit={onEdit} />
      <PilotList state={state} onEdit={onEdit} />
    </>
  );
}

/* ---------- rules ---------- */

function RulesPanel({ state, send }: { state: GameState; send: Send }) {
  const rules = rulesFor(state);
  const rule = rules[Math.min(state.ruleStep, rules.length - 1)];
  return (
    <section className="panel sheet">
      <span className="kicker">
        On the big screen: rule {Math.min(state.ruleStep + 1, rules.length)} of {rules.length}
      </span>
      <h2 className="display">{rule.title}</h2>
      <p>{withWinners(rule.text, state.winners)}</p>
      <p className="hint">Jump to a rule:</p>
      <div className="rule-jump">
        {rules.map((r, i) => (
          <button key={r.short} className={`btn ${i === state.ruleStep ? "navy" : ""}`} onClick={() => send({ t: "rule", step: i })}>
            {i + 1}. {r.short}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------- distance + bin rounds ---------- */

function RoundPanel({
  state,
  act,
  send,
  onEdit,
  onNext,
  nextLabel,
}: {
  state: GameState;
  act: Send;
  send: Send;
  onEdit: (id: string) => void;
  onNext: () => void;
  nextLabel: string;
}) {
  const isBin = state.phase === "bin";
  const max = binThrows(state);
  const order = callOrder(state);
  const up = order[0];
  const status = roundStatus(state);
  const [metres, setMetres] = useState("");
  const [bad, setBad] = useState("");
  useEffect(() => {
    setMetres("");
    setBad("");
  }, [up?.id]);

  const save = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!up) return;
    const m = Number(metres.trim().replace(",", "."));
    if (!metres.trim() || !(m > 0 && m <= 60)) return setBad("Type the metres, between 0 and 60 (e.g. 7.42).");
    act({ t: "distance", id: up.id, m });
  };

  return (
    <>
      <p className="round-progress">
        <b>{status.done.length}</b> of {state.players.length} thrown
        {status.away.length > 0 && <> · {status.away.length} not here</>}
      </p>

      {status.complete ? (
        <section className="panel sheet complete">
          <h2 className="display">{status.away.length ? "Everyone here has thrown" : "Everyone has thrown!"}</h2>
          {status.away.length > 0 && (
            <>
              <p>Marked not here (they can still throw if they turn up):</p>
              <ul className="away-list">
                {status.away.map((p) => (
                  <li key={p.id}>
                    {p.name} <small>{p.id}</small>
                    <button className="btn" onClick={() => act({ t: "away", id: p.id, on: false })}>
                      They're here
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button className="btn red big" onClick={onNext}>
            {nextLabel} →
          </button>
        </section>
      ) : up ? (
        <section className="panel sheet now">
          <span className="kicker">Now throwing</span>
          <div className="now-who">
            <strong className="hand">{up.name}</strong>
            <span>
              {up.id}
              {teamOf(state, up.id) && ` · for ${teamOf(state, up.id)!.name}`}
            </span>
          </div>
          {isBin ? (
            <>
              <div className="big-stepper">
                <button className="btn" onClick={() => act({ t: "bin", id: up.id, dir: -1 })} aria-label="One less in the bin">
                  −
                </button>
                <Dots n={up.bins} max={max} />
                <button className="btn green" disabled={up.bins === max} onClick={() => act({ t: "bin", id: up.id, dir: 1 })} aria-label="One more in the bin">
                  +
                </button>
              </div>
              <p className="hint">Tap + for every plane that lands in. Then:</p>
              <button className="btn red big" onClick={() => act({ t: "binDone", id: up.id })}>
                Done ({up.bins ?? 0} in): next →
              </button>
            </>
          ) : (
            <form className="metres" onSubmit={save}>
              <label htmlFor="metres">Flight distance</label>
              <div className={`metres-row ${bad ? "bad" : ""}`}>
                <input id="metres" inputMode="decimal" placeholder="0.00" value={metres} onChange={(e) => (setMetres(e.target.value), setBad(""))} />
                <span>m</span>
              </div>
              {bad && <p className="error">{bad}</p>}
              <button className="btn red big">Save: next →</button>
            </form>
          )}
          <div className="now-actions">
            <button className="btn" onClick={() => send({ t: "skip", id: up.id })}>
              Skip for now
            </button>
            <button className="btn" onClick={() => act({ t: "away", id: up.id, on: true })}>
              Not here
            </button>
          </div>
          <p className="hint">Skip = they go to the back of the queue. Not here = left out of this round until you bring them back.</p>
          {order.length > 1 && (
            <div className="up-next">
              <span className="kicker">Up next</span>
              {order.slice(1, 4).map((p) => (
                <button key={p.id} className="chip" onClick={() => send({ t: "call", id: p.id })}>
                  {p.name} <small>{p.id}</small>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="panel sheet">
          <p>Nobody is called right now. Tap "Call" on someone below.</p>
        </section>
      )}

      <PilotList state={state} onEdit={onEdit} act={act} send={send} round />
    </>
  );
}

/** Everyone, searchable. In a round: status, Call, Not here / They're here. Edit fixes anything. */
function PilotList({ state, onEdit, act, send, round }: { state: GameState; onEdit: (id: string) => void; act?: Send; send?: Send; round?: boolean }) {
  const [query, setQuery] = useState("");
  const rows = state.players.filter((p) => matches(p, query));
  return (
    <section className="panel sheet pilots">
      <header className="pilots-head">
        <h3 className="display">Everyone ({state.players.length})</h3>
        <Search value={query} onChange={setQuery} />
      </header>
      {rows.length === 0 && <p className="hand empty">{state.players.length ? `No one matches "${query}".` : "No one yet."}</p>}
      <ul className="pilot-list">
        {rows.map((p) => {
          const thrown = round && hasThrown(state, p);
          const away = round && isAway(state, p);
          return (
            <li key={p.id} className={`${p.id === state.up ? "up" : ""} ${thrown ? "done" : ""} ${away ? "away" : ""}`}>
              <span className="pl-id">{p.id}</span>
              <span className="pl-name">
                {p.name}
                {teamOf(state, p.id) && <small className="pl-team">{teamOf(state, p.id)!.name}</small>}
                {p.twin && (
                  <small className="pl-twin" title="Same phone hardware on the same network. Could be a second pass, or just the same phone model.">
                    ⚠ same phone as {p.twin.map((id) => state.players.find((o) => o.id === id)?.name ?? id).join(", ")}?
                  </small>
                )}
              </span>
              {round && (
                <span className="pl-status">
                  {p.id === state.up
                    ? "throwing"
                    : away
                      ? "not here"
                      : thrown
                        ? state.phase === "bin"
                          ? binText(state, p.bins)
                          : `${p.distance?.toFixed(2)} m`
                        : "waiting"}
                </span>
              )}
              <span className="pl-actions">
                {round && !away && p.id !== state.up && (
                  <button className="btn" onClick={() => send?.({ t: "call", id: p.id })}>
                    Call
                  </button>
                )}
                {round && away && (
                  <button className="btn" onClick={() => act?.({ t: "away", id: p.id, on: false })}>
                    Back
                  </button>
                )}
                <button className="btn" onClick={() => onEdit(p.id)}>
                  Edit
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- winners ---------- */

function WinnersPanel({ state, send, onEdit }: { state: GameState; send: Send; onEdit: (id: string) => void }) {
  const scored = useMemo(() => score(state), [state.players, state.teams, state.rounds, state.entries]);
  const mode = modeOf(state);
  const winners = winnersOf(scored, state.winners);
  const ties = podiumTies(scored, state.winners);
  const unfinished = state.players.filter((p) => !finished(state, p));
  const nextPlace = state.winners - state.reveal;
  const done = state.reveal >= state.winners;

  return (
    <>
      {ties.map((group) => (
        <section className="panel sheet tie" key={group[0].id}>
          <h2 className="display">Tie for {ordinal(group[0].rank)}</h2>
          <p>
            {mode === "both" ? "Same points and same flight." : mode === "distance" ? "Exactly the same flight." : "Same number in the bin."} Run a throw-off (one more
            throw each, longest wins) and type each result:
          </p>
          {group.map((p) => (
            <ThrowOff key={p.id} p={p} send={send} />
          ))}
        </section>
      ))}

      <section className="panel sheet">
        <span className="kicker">
          Revealed {state.reveal} of {state.winners} places
        </span>
        {!done ? (
          <>
            <h2 className="display">Next: {ordinal(nextPlace)} place</h2>
            {state.reveal === 0 && unfinished.length > 0 && (
              <p className="notice">
                {unfinished.length} {unfinished.length > 1 ? "entries haven't" : "entry hasn't"} finished {state.rounds.length > 1 ? "both rounds" : "throwing"}. That's
                fine if they left; otherwise go Back first.
              </p>
            )}
            <button className="btn red big" disabled={winners.length === 0} onClick={() => send({ t: "reveal", step: state.reveal + 1, from: state.reveal })}>
              Reveal {ordinal(nextPlace)} place
            </button>
            <button className="btn" disabled={winners.length === 0} onClick={() => send({ t: "reveal", step: state.winners })}>
              Reveal all the rest, one by one
            </button>
            <p className="hint">Each reveal plays a drumroll on the big screen first, so wait for it before tapping again.</p>
          </>
        ) : (
          <>
            <h2 className="display">All {state.winners} revealed!</h2>
            <p>The big screen shows a QR for everyone's results. Phones get a "See full results" button too.</p>
          </>
        )}
        {state.reveal > 0 && (
          <button className="link" onClick={() => send({ t: "reveal", step: 0 })}>
            Hide and start the reveal again
          </button>
        )}
      </section>

      <section className="panel sheet">
        <h3 className="display">Winning places</h3>
        <ol className="win-list">
          {Array.from({ length: state.winners }, (_, i) => winners[i]).map((w, i) => (
            <li key={i} className={i >= state.winners - state.reveal ? "shown" : ""}>
              <span className="pl-id">{ordinal(i + 1)}</span>
              {w ? (
                <>
                  <span className="pl-name">
                    {w.name} {w.tied && <em>(tied)</em>}
                  </span>
                  <span className="pl-status">
                    {scoreText(w, state, mode)}
                    {w.team && <small className="pl-team">{teamLabel(w)}</small>}
                  </span>
                  <button className="btn" onClick={() => onEdit(w.id)}>
                    Edit
                  </button>
                </>
              ) : (
                <span className="pl-name muted">nobody</span>
              )}
            </li>
          ))}
        </ol>
        <p className="hint">Only you see this list in advance. The big screen keeps it secret until each reveal.</p>
        {winners.length > 0 && (
          <p className="setup-sum">
            Prizes to hand out: {Math.min(winners.length, state.winners)} (one per place, to the person who threw it)
          </p>
        )}
      </section>
    </>
  );
}

function ThrowOff({ p, send }: { p: { id: string; name: string; tiebreak?: number | null }; send: Send }) {
  const [v, setV] = useState(p.tiebreak?.toString() ?? "");
  return (
    <form
      className="throwoff"
      onSubmit={(e) => {
        e.preventDefault();
        const m = Number(v.replace(",", "."));
        send({ t: "tiebreak", id: p.id, m: v.trim() === "" ? null : m });
      }}
    >
      <span>{p.name}</span>
      <input inputMode="decimal" placeholder="metres" value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn">Save</button>
    </form>
  );
}

/* ---------- menu ---------- */

function Menu({
  state,
  send,
  scored,
  onEdit,
  onClose,
  onGuide,
  onLogout,
  password,
  me,
}: {
  state: GameState;
  send: Send;
  scored: ReturnType<typeof score>;
  onEdit: (id: string) => void;
  onClose: () => void;
  onGuide: () => void;
  onLogout: () => void;
  password: string;
  me: { id: string; admin: boolean };
}) {
  const dialog = useDialog();
  const resultsUrl = `${location.origin}/results?pin=${state.pin}`;
  return (
    <div className="guide-back" onClick={onClose}>
      <aside className="guide sheet control-menu" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 className="display">Menu</h2>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </header>

        <h3>Winners this event</h3>
        <div className="winners-pick">
          <button className="btn" onClick={() => send({ t: "settings", winners: state.winners - 1 })} disabled={state.winners <= 3}>
            −
          </button>
          <strong>{state.winners}</strong>
          <button className="btn" onClick={() => send({ t: "settings", winners: state.winners + 1 })} disabled={state.winners >= 10}>
            +
          </button>
          <small>places revealed at the end (3 to 10)</small>
        </div>

        <h3>Rounds and teams</h3>
        <SetupPicker
          value={{ rounds: state.rounds, entries: state.entries, teamMax: state.teamMax }}
          locked={state.phase !== "lobby" && state.phase !== "rules"}
          noShrink={state.teams.length > 0}
          onChange={(setup) => send({ t: "settings", setup })}
        />
        {state.phase !== "lobby" && state.phase !== "rules" && <p className="hint">Rounds are locked now the first round has started (team size can still go up).</p>}

        {state.canRestore && (
          <>
            <h3>Removed by mistake?</h3>
            <button className="btn" onClick={() => send({ t: "restore" })}>
              Bring back {state.canRestore}
            </button>
          </>
        )}

        <h3>Standings (only you see this)</h3>
        <Leaderboard rows={scored} cfg={state} show="all" limit={100} title="Everyone" onPick={onEdit} />

        <h3>Links</h3>
        <ul>
          <li>
            Results page: <b>{resultsUrl.replace(/^https?:\/\//, "")}</b> (opens to everyone after the reveal)
          </li>
          <li>
            Join page: <b>{`${location.host}/join?pin=${state.pin}`}</b>
          </li>
        </ul>
        <button className="btn" onClick={onGuide}>
          Guide (README)
        </button>

        <h3>Control phones</h3>
        <Controllers state={state} send={send} me={me.id} admin={me.admin} />
        {!me.admin && <p className="hint">You joined with an invite link: you can run the event; the host manages this list.</p>}

        <h3>Updates</h3>
        <UpdatePanel password={password} />

        <h3>Start over</h3>
        <button
          className="btn danger-btn"
          onClick={async () => {
            const ok = await dialog.confirm("Reset the whole event?", {
              body: "Removes every player and score and goes back to the lobby. Same PIN and QR codes. This can't be undone.",
              okLabel: "Reset everything",
              danger: true,
            });
            if (ok) {
              send({ t: "reset" });
              onClose();
            }
          }}
        >
          Reset event (same PIN)
        </button>
        <button className="link" onClick={onLogout}>
          Stop controlling on this phone
        </button>
      </aside>
    </div>
  );
}
