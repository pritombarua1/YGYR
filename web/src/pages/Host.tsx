import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import QRCode from "qrcode";
import { createGame, store, useGame } from "../api";
import { score } from "../scoring";
import { DEFAULT_SETUP, EVENT } from "../config";
import { phasesFor, modeOf, teamOf, throwOrder } from "../mode";
import { SetupPicker, describeSetup } from "../components/SetupPicker";
import { idNumber } from "../queue";
import { PHASE_SLUG, phaseFromSlug, type GameState, type Setup } from "../types";
import { play, useSound } from "../sound";
import { StepBar } from "../components/StepBar";
import { CountUp } from "../components/CountUp";
import { RoundIntro, usePhaseTransition } from "../components/RoundIntro";
import { Plane } from "../components/Plane";
import { rulesFor, RulePager } from "../components/RuleSlides";
import { Stage } from "../components/Stage";
import { Podium } from "../components/Podium";
import { useDialog } from "../components/Dialog";
import { useWakeLock } from "../wakelock";
import { UpdatePanel } from "../components/UpdatePanel";

/*
 * The big screen (projector). It only SHOWS what's happening: everything is run from the
 * control phone (/control). Its own controls are tucked into a corner menu (move the mouse).
 */

type Creds = { pin: string; hostKey: string; password: string };

function useFullscreen() {
  const [on, setOn] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const sync = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
  return [on, toggle] as const;
}

export function useQr(url: string) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#172133", light: "#fbfcf9" } }).then(setSvg);
  }, [url]);
  return svg;
}

export default function Host() {
  const [creds, setCreds] = useState(() => store.get<Creds>("pp:host"));
  const [isHost, setIsHost] = useState<boolean | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number>();
  const flash = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 4000);
  };

  const { state, online, send } = useGame(
    creds?.pin ?? null,
    () => ({ t: "hello", role: "host", key: creds?.hostKey, password: creds?.password }),
    (m) => {
      if (m.t === "host") {
        setIsHost(m.ok);
        if (m.ok && m.key && creds && m.key !== creds.hostKey) {
          const c = { ...creds, hostKey: m.key }; // resumed with the password: remember the key
          store.set("pp:host", c);
          setCreds(c);
        }
        if (!m.ok) flash("Wrong PIN or password for that game.");
      }
      if (m.t === "error") flash(m.message);
      if (m.t === "nogame") {
        store.set("pp:host", null);
        setCreds(null);
        flash("That game doesn't exist (any more). Create a new one.");
      }
    },
  );

  if (!creds || isHost === false) return <Splash onReady={(c) => (setIsHost(null), setCreds(c))} toast={toast} flash={flash} />;

  if (!state) {
    return (
      <div className="host host-splash">
        <div className="airmail" />
        <div className="splash">
          <p className="hand">Connecting to gate {creds.pin}…</p>
          <button className="link" onClick={() => (store.set("pp:host", null), setCreds(null))}>
            Use a different game
          </button>
        </div>
      </div>
    );
  }

  return <Display state={state} online={online} send={send} toast={toast} password={creds.password} onLeave={() => (store.set("pp:host", null), setCreds(null))} />;
}

/** Create a new game, or resume one after a restart (PIN + password). */
function Splash({ onReady, toast, flash }: { onReady: (c: Creds) => void; toast: string; flash: (m: string) => void }) {
  const [mode, setMode] = useState<"create" | "resume">("create");
  const [password, setPassword] = useState("");
  const [winners, setWinners] = useState(DEFAULT_SETUP.winners);
  const [setup, setSetup] = useState<Setup>({ rounds: DEFAULT_SETUP.rounds, entries: DEFAULT_SETUP.entries, teamMax: DEFAULT_SETUP.teamMax });
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const c = { ...(await createGame(password, winners, setup)), password };
      store.set("pp:host", c);
      onReady(c);
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const resume = () => {
    if (!/^\d{4}$/.test(pin)) return flash("The PIN is 4 digits.");
    const c = { pin, hostKey: "", password };
    store.set("pp:host", c);
    onReady(c);
  };

  return (
    <div className="host host-splash">
      <div className="airmail" />
      <div className="splash">
        <Plane size={200} className="hero-plane" />
        <h1 className="display">{EVENT.title}</h1>
        <p className="hand">Big screen. Put this on the projector.</p>
        <p className="hosted">Hosted by {EVENT.hostedBy}</p>
        <form
          className="host-login"
          onSubmit={(e) => {
            e.preventDefault();
            mode === "create" ? create() : resume();
          }}
        >
          <div className="seg mode-seg" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "create"} className={mode === "create" ? "on" : ""} onClick={() => setMode("create")}>
              New game
            </button>
            <button type="button" role="tab" aria-selected={mode === "resume"} className={mode === "resume" ? "on" : ""} onClick={() => setMode("resume")}>
              Resume a game
            </button>
          </div>
          {mode === "resume" && (
            <label>
              Game PIN
              <input inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="0000" />
            </label>
          )}
          <label>
            Host password
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="The one you typed into start.bat" />
          </label>
          {mode === "create" && (
            <div className="winners-pick">
              <span>How many winners?</span>
              <button type="button" className="btn" onClick={() => setWinners((w) => Math.max(3, w - 1))} aria-label="Fewer winners">
                −
              </button>
              <strong>{winners}</strong>
              <button type="button" className="btn" onClick={() => setWinners((w) => Math.min(10, w + 1))} aria-label="More winners">
                +
              </button>
              <small>3 to 10, you can change it later</small>
            </div>
          )}
          {mode === "create" && <SetupPicker value={setup} onChange={setSetup} />}
          <button className="btn red big" disabled={busy}>
            {busy ? "Opening the gate…" : mode === "create" ? "Create game" : "Resume game"}
          </button>
          {mode === "resume" && <p className="hint">After a restart the link changes, but the game (players, scores) is still there. Players rejoin with their name + rejoin code.</p>}
        </form>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Display({
  state,
  online,
  send,
  toast,
  password,
  onLeave,
}: {
  state: GameState;
  online: boolean;
  send: (m: object) => void;
  toast: string;
  password: string;
  onLeave: () => void;
}) {
  const [updates, setUpdates] = useState(false);
  const dialog = useDialog();
  useWakeLock(); // the projector laptop must not go to sleep mid-event
  const scored = useMemo(() => score(state), [state.players, state.teams, state.rounds, state.entries]);
  const rules = useMemo(() => rulesFor(state), [state.rounds, state.entries, state.teamMax]);
  const { shown, intro, reveal, done } = usePhaseTransition(state.phase);
  const [fullscreen, toggleFullscreen] = useFullscreen();
  const [soundOn, soundReady, toggleSound] = useSound();
  const [menu, setMenu] = useState(false);
  const setupKey = `pp:setup:${state.pin}`;
  const [setupDone, setSetupDone] = useState(() => !!store.get(setupKey));
  const controlUrl = `${location.origin}/control?pin=${state.pin}`;

  // once a control phone connects, the setup screen thanks it and gets out of the way
  useEffect(() => {
    if (setupDone || state.controllers === 0) return;
    const t = setTimeout(() => {
      store.set(setupKey, true);
      setSetupDone(true);
    }, 2200);
    return () => clearTimeout(t);
  }, [state.controllers, setupDone]);

  // The address bar follows the event: /host/lobby, /host/rules, /host/round1-distance …
  const typedSlug = useRef<string | undefined>(location.pathname.split("/")[2]);
  useEffect(() => {
    const wanted = phaseFromSlug(typedSlug.current);
    typedSlug.current = undefined;
    if (wanted && wanted !== state.phase) return void send({ t: "phase", phase: wanted });
    const path = `/host/${PHASE_SLUG[state.phase]}`;
    if (location.pathname !== path) history.replaceState(null, "", path);
  }, [state.phase]);

  // keyboard: F = full screen; arrows / clicker work through the rules as a fallback
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (state.phase !== "rules") return;
      if ((e.key === "ArrowRight" || e.key === "PageDown") && state.ruleStep < rules.length - 1) send({ t: "rule", step: state.ruleStep + 1, from: state.ruleStep });
      if ((e.key === "ArrowLeft" || e.key === "PageUp") && state.ruleStep > 0) send({ t: "rule", step: state.ruleStep - 1, from: state.ruleStep });
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [state.phase, state.ruleStep, rules.length]);

  // corner menu appears when the mouse moves, then hides itself
  const [mouse, setMouse] = useState(false);
  useEffect(() => {
    let t: number | undefined;
    const move = () => {
      setMouse(true);
      clearTimeout(t);
      t = window.setTimeout(() => setMouse(false), 2500);
    };
    addEventListener("mousemove", move);
    return () => removeEventListener("mousemove", move);
  }, []);

  const controlQr = useQr(controlUrl);
  const showSetup = !setupDone;

  return (
    <div className="host">
      <div className="airmail" />
      <header className="host-top">
        <div className="brand">
          <Plane size={58} />
          <span>
            Paper Plane
            <br />
            Challenge
            <small>Hosted by {EVENT.hostedBy}</small>
          </span>
        </div>
        <StepBar phase={state.phase} phases={phasesFor(state)} />
        {state.phase === "lobby" ? (
          <div className="host-pin">
            <span>PIN</span>
            <strong>{state.pin}</strong>
          </div>
        ) : (
          <CornerJoin pin={state.pin} />
        )}
      </header>

      <main className="host-main">
        {shown === "lobby" && <Lobby state={state} />}
        {shown === "rules" && <RulePager rules={rules} mode={modeOf(state)} step={Math.min(state.ruleStep, rules.length - 1)} winners={state.winners} />}
        {(shown === "distance" || shown === "bin") && <Stage state={{ ...state, phase: shown }} scored={scored} />}
        {shown === "winners" && <Podium scored={scored} cfg={state} count={state.winners} reveal={state.reveal} pin={state.pin} />}
      </main>

      {/* tiny status line: only speaks up when something needs attention */}
      <footer className="host-foot quiet">
        <span className={`live ${online ? "on" : ""}`}>{online ? "" : "Reconnecting…"}</span>
        {soundOn && !soundReady && <span className="warn soft">Click anywhere to turn sound on</span>}
      </footer>

      <div className={`corner-menu ${mouse || menu ? "show" : ""}`}>
        <button className="link" onClick={() => setMenu((m) => !m)}>
          Menu
        </button>
        {menu && (
          <div className="corner-panel sheet">
            {/* only visible to whoever is at the laptop, never to the audience */}
            <span className="corner-status">
              Control phones connected: {state.controllers}
              {state.controllers === 0 && ` (open ${location.host}/control)`}
            </span>
            <button className="link" onClick={toggleFullscreen}>
              {fullscreen ? "Exit full screen" : "Full screen"} (F)
            </button>
            <button className="link" onClick={toggleSound}>
              Sound: {soundOn ? "on" : "off"}
            </button>
            <button className="link" onClick={() => window.open(controlUrl, "_blank")}>
              Open the controls on this laptop
            </button>
            <button className="link" onClick={() => setUpdates((u) => !u)}>
              Check for updates
            </button>
            {updates && <UpdatePanel password={password} />}
            <button className="link" onClick={() => (store.set(setupKey, null), setSetupDone(false), setMenu(false))}>
              Show "connect control phone" again
            </button>
            <button
              className="link danger"
              onClick={async () => {
                const ok = await dialog.confirm("Leave this game on this screen?", {
                  body: `The game keeps running. To come back, choose "Resume a game" with PIN ${state.pin} and the password.`,
                  okLabel: "Leave",
                  danger: true,
                });
                if (ok) onLeave();
              }}
            >
              Leave this game on this screen
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showSetup && (
          <motion.div className="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="setup-card sheet taped">
              <span className="kicker">Before you start</span>
              <h2 className="display">Connect your control phone now</h2>
              <p>
                Scan this with the phone you'll run the event from, then type the host password. Everything is controlled from that phone; this
                screen just shows the show.
              </p>
              <div className="setup-row">
                <div className="setup-qr" dangerouslySetInnerHTML={{ __html: controlQr }} />
                <ol>
                  <li>
                    Scan, or open <b>{controlUrl.replace(/^https?:\/\//, "")}</b>
                  </li>
                  <li>Enter the host password</li>
                  <li>Press F on this laptop for full screen</li>
                </ol>
              </div>
              {state.controllers > 0 ? (
                <p className="setup-ok">Control phone connected. Starting the lobby…</p>
              ) : (
                <p className="hand setup-wait">Waiting for the control phone…</p>
              )}
              <button className="link" onClick={() => (store.set(setupKey, true), setSetupDone(true))}>
                Skip: I'll control from this laptop instead (Menu → Open the controls)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {intro && <RoundIntro key={intro.n} phase={intro.phase} cfg={state} onReveal={reveal} onDone={done} sounds />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/** Always-on join corner, so latecomers can still scan in mid-event. */
function CornerJoin({ pin }: { pin: string }) {
  const qr = useQr(`${location.origin}/join?pin=${pin}`);
  return (
    <div className="corner-join">
      <div className="corner-qr" dangerouslySetInnerHTML={{ __html: qr }} />
      <div>
        <span>Late? Scan to join</span>
        <strong>PIN {pin}</strong>
      </div>
    </div>
  );
}

// Small stable tilt per player so the wall looks pinned up by hand.
const tilt = (id: string) => (((idNumber(id) * 5) % 9) - 4) * 0.9;

function Lobby({ state }: { state: GameState }) {
  const url = `${location.origin}/join?pin=${state.pin}`;
  const qr = useQr(url);
  const count = useRef(state.players.length);
  useEffect(() => {
    if (state.players.length > count.current) play("pop", 0.7);
    count.current = state.players.length;
  }, [state.players.length]);

  return (
    <div className="lobby">
      <aside className="lobby-join sheet taped">
        <p className="kicker">Scan to board</p>
        <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="lobby-url">{url.replace(/^https?:\/\//, "")}</p>
        <p className="kicker">Gate PIN</p>
        <p className="lobby-pin">{state.pin}</p>
        <p className="lobby-setup">{describeSetup(state)}</p>
      </aside>
      <section className="wall">
        <header className="wall-head">
          <h2 className="display">On board</h2>
          <span className="count">
            <CountUp value={state.players.length} />
          </span>
          {state.teams.length > 0 && state.entries !== "solo" && (
            <span className="wall-teams">
              {state.teams.length} team{state.teams.length > 1 ? "s" : ""}
            </span>
          )}
        </header>
        {state.players.length === 0 && <p className="hand empty big">Names land here as people join…</p>}
        <ul className="tags">
          <AnimatePresence>
            {/* team-mates pinned up next to each other */}
            {[...new Set([...throwOrder(state), ...state.players])].map((p) => (
              <motion.li
                key={p.id}
                layout
                className="tag"
                initial={{ scale: 0.2, rotate: -25, opacity: 0 }}
                animate={{ scale: 1, rotate: tilt(p.id), opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
              >
                <span className="tag-id">{p.id}</span>
                <span className="tag-name hand">{p.name}</span>
                {teamOf(state, p.id) && <span className="tag-team">{teamOf(state, p.id)!.name}</span>}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>
    </div>
  );
}
