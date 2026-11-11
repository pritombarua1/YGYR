import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { store, useGame } from "../api";
import { ordinal, place as placeOf, score } from "../scoring";
import { callOrder, isAway } from "../queue";
import { play, useSound } from "../sound";
import { useRevealShown, winnersOf } from "../components/Podium";
import { EVENT, SCORING } from "../config";
import { binText, binThrows, isTeam, members, modeOf, roundKicker } from "../mode";
import type { GameState } from "../types";
import { rulesFor, withWinners } from "../components/RuleSlides";
import { LandingStamp, useLanding } from "../components/CallCard";
import { Dots } from "../components/Inputs";
import { CountUp } from "../components/CountUp";
import { RoundIntro, usePhaseTransition } from "../components/RoundIntro";
import { BinDrop, useBinDrops } from "../components/BinDrop";
import { Confetti } from "../components/Confetti";
import { Plane } from "../components/Plane";
import Home from "./Home";

export default function Join() {
  const pin = new URLSearchParams(location.search).get("pin");
  if (!pin || !/^\d{4}$/.test(pin)) return <Home />;
  return <JoinGame pin={pin} />;
}

function JoinGame({ pin }: { pin: string }) {
  const key = `pp:player:${pin}`;
  const [me, setMe] = useState<string | null | undefined>(undefined); // undefined = still checking
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [noGame, setNoGame] = useState(false);
  const [code, setCode] = useState(""); // rejoin code typed in, for coming back on another phone
  const [askCode, setAskCode] = useState(false);
  const [myCode, setMyCode] = useState<string | undefined>();
  const [asTeam, setAsTeam] = useState(false);
  const [crew, setCrew] = useState<string[]>(["", ""]); // team member names

  const { state, online, send } = useGame(
    pin,
    () => ({ t: "hello", role: "player", token: store.get<string>(key) }),
    (m) => {
      if (m.t === "you") {
        if (m.token) store.set(key, m.token);
        if (!m.id) store.set(key, null);
        setMe(m.id);
        setMyCode(m.code);
        setPending(false);
      } else if (m.t === "error") {
        setError(m.message);
        if (m.taken) setAskCode(true);
        setPending(false);
      } else if (m.t === "removed") {
        store.set(key, null);
        setMe(null);
        setNotice(m.reason === "reset" ? "The host started a new event. Join again to play." : "The host took you off the board. You can join again.");
      } else if (m.t === "nogame") {
        setNoGame(true);
      }
    },
  );

  const entries = state?.entries ?? "solo";
  const teamMax = state?.teamMax ?? 4;
  const team = entries === "teams" || (entries === "both" && asTeam);

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return setError(team ? "Give your team a name first." : "Pop your name in first.");
    if (clean.length > 20) return setError("Keep it to 20 characters.");
    const people = crew.map((c) => c.trim()).filter(Boolean);
    if (team && !askCode) {
      if (people.length < 2) return setError("Add at least 2 names to your team (including you).");
      if (people.some((c) => c.length > 20)) return setError("Keep each name to 20 characters.");
    }
    setError("");
    setPending(true);
    send({ t: "join", name: clean, team: team && !askCode ? people : undefined, code: askCode ? code.trim().toUpperCase() : undefined });
  };

  if (noGame) {
    return (
      <Shell>
        <div className="sheet taped msg">
          <h2 className="display">No game on gate {pin}</h2>
          <p>Check the PIN on the big screen and try again.</p>
          <a className="btn" href="/">Enter a different PIN</a>
        </div>
      </Shell>
    );
  }

  if (state && me) return <PlayerPass state={state} me={me} online={online} code={myCode} />;

  return (
    <Shell>
      <header className="phone-hero">
        <Plane size={110} className="hero-plane" />
        <h1 className="display">Paper Plane Challenge</h1>
        <p className="hand">Gate {pin} · boarding now</p>
        <p className="hosted">Hosted by {EVENT.hostedBy}</p>
      </header>
      {me === undefined ? (
        <p className="hand center-note">Checking in…</p>
      ) : (
        <form className="sheet taped form" onSubmit={join}>
          {notice && <p className="notice">{notice}</p>}
          {entries === "both" && !askCode && (
            <div className="seg join-kind" role="radiogroup" aria-label="Joining as">
              <button type="button" role="radio" aria-checked={!asTeam} className={!asTeam ? "on" : ""} onClick={() => (setAsTeam(false), setError(""))}>
                Just me
              </button>
              <button type="button" role="radio" aria-checked={asTeam} className={asTeam ? "on" : ""} onClick={() => (setAsTeam(true), setError(""))}>
                We're a team
              </button>
            </div>
          )}
          <label htmlFor="name">{team ? "Team name" : "Your name"}</label>
          <input
            id="name"
            autoComplete={team ? "off" : "given-name"}
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={team ? "e.g. The Paper Hawks" : "e.g. Priya S"}
          />
          {team && !askCode && (
            <fieldset className="crew">
              <legend>Who's in the team? (2 to {teamMax})</legend>
              {crew.map((c, i) => (
                <div className="crew-row" key={i}>
                  <input
                    maxLength={20}
                    value={c}
                    aria-label={i === 0 ? "Your name" : `Team member ${i + 1}`}
                    placeholder={i === 0 ? "Your name" : `Person ${i + 1}`}
                    onChange={(e) => setCrew((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  {i >= 2 && (
                    <button type="button" className="btn" aria-label={`Remove person ${i + 1}`} onClick={() => setCrew((list) => list.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  )}
                </div>
              ))}
              {crew.length < teamMax && (
                <button type="button" className="link" onClick={() => setCrew((list) => [...list, ""])}>
                  + Add a person
                </button>
              )}
              <p className="hint">One phone joins for the whole team. You fold one plane together and get one turn, same as a solo pilot.</p>
            </fieldset>
          )}
          {askCode && (
            <>
              <label htmlFor="code">Rejoin code</label>
              <input
                id="code"
                className="code-input"
                autoComplete="off"
                autoCapitalize="characters"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. K7QX"
              />
              <p className="hint">
                It's on your boarding pass on the other phone{team ? " (use your team name above)" : ""}. Lost it? The host can look it up.
              </p>
            </>
          )}
          {error && <p className="error">{error}</p>}
          <button className="btn red" disabled={pending || !online}>
            {pending ? "Boarding…" : askCode ? "Rejoin" : "Join"}
          </button>
          {!online && <p className="hint">Connecting…</p>}
          {!askCode && (
            <button type="button" className="link foot-link" onClick={() => setAskCode(true)}>
              Already joined on another phone or browser?
            </button>
          )}
        </form>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="phone">
      <div className="airmail" />
      <main className="phone-main">{children}</main>
    </div>
  );
}

/** place = where you are in the call queue: 0 = throwing now, 1 = next, -1 = not waiting. */
function statusFor(state: GameState, distance: number | null, bins: number | null, place: number, away: boolean) {
  if (away && (state.phase === "distance" || state.phase === "bin"))
    return ["Marked as not here", "The host thinks you've stepped out. Back already? Tell the host and they'll call you."];
  const queue =
    place === 1 ? "You're next. Get ready at the line." : place > 1 ? `You're ${ordinal(place + 1)} in line. Watch the big screen.` : "";
  switch (state.phase) {
    case "lobby":
      return ["You're on the board", "Waiting for the host to start…"];
    case "rules": {
      const rules = rulesFor(state);
      const rule = rules[Math.min(state.ruleStep, rules.length - 1)];
      return [`Rule ${state.ruleStep + 1}: ${rule.short}`, withWinners(rule.phone, state.winners)];
    }
    case "distance":
      if (place === 0) return ["You're up!", "Go to the throw line and throw your plane."];
      return distance
        ? ["Distance logged", `Your flight went ${distance.toFixed(2)} m. Nice.`]
        : [`${roundKicker(state, "distance")} · Distance`, queue || "Wait for your name to be called, then throw."];
    case "bin": {
      const max = binThrows(state);
      const both = modeOf(state) === "both";
      const title = `${roundKicker(state, "bin")} · Bin`;
      if (place === 0) return ["You're up!", bins ? `${bins} in so far. Keep going!` : `${max} throws at the bin. Go!`];
      return bins === null
        ? [title, queue || `${max} throws at the bin.${both ? ` Every plane in is ${SCORING.binPoints} points.` : " Most planes in wins."}`]
        : bins
          ? ["In the bin!", `${bins} of ${max}.${both ? ` That's ${bins * SCORING.binPoints} points.` : ""}`]
          : [title, both ? "None in this time. Your distance still counts!" : "None in this time. Good try!"];
    }
    case "winners":
      return ["The podium", ""];
  }
}

function PlayerPass({ state, me, online, code }: { state: GameState; me: string; online: boolean; code?: string }) {
  const scored = useMemo(() => score(state.players, state), [state.players, state.rounds]);
  const mode = modeOf(state);
  const p = scored.find((s) => s.id === me);
  const { intro, reveal, done } = usePhaseTransition(state.phase);
  const drops = useBinDrops(state.players, me);
  const landing = useLanding(state.players, me);
  const place = callOrder(state).findIndex((o) => o.id === me);
  const [soundOn, soundReady, toggleSound] = useSound();
  // podium timing matches the big screen's drumroll, so this phone never gives the result away
  const { shown } = useRevealShown(state.phase === "winners" ? state.reveal : 0);
  const winners = winnersOf(scored, state.winners);
  const myPlace = winners.findIndex((w) => w.id === me) + 1; // 0 = not a winner
  const meRevealed = state.phase === "winners" && myPlace > 0 && myPlace > state.winners - shown;
  const allRevealed = state.phase === "winners" && shown >= state.winners;

  // sounds for this player's moments
  const prevPlace = useRef(place);
  useEffect(() => {
    if (place === 0 && prevPlace.current !== 0) play("up");
    else if (place === 1 && prevPlace.current !== 1) play("next", 0.7);
    prevPlace.current = place;
  }, [place]);
  useEffect(() => {
    if (landing) play("land");
  }, [landing]);
  useEffect(() => {
    if (drops.length) play("bin");
  }, [drops.length]);
  useEffect(() => {
    if (meRevealed) play(myPlace === 1 ? "fanfare" : "cheer");
  }, [meRevealed]);
  // First time on this phone: ask them to screenshot the rejoin code (it is how they get back in elsewhere).
  const savedKey = `pp:codesaved:${state.pin}:${me}`;
  const [codeSaved, setCodeSaved] = useState(() => !!store.get(savedKey));

  // Buzz the phone when it's your turn.
  useEffect(() => {
    if (place === 0) navigator.vibrate?.([200, 100, 200]);
  }, [place === 0, state.phase]);

  if (!p) return null;

  const [title, line] = statusFor(state, p.distance, p.bins, place, isAway(state, p));
  const started = state.phase === "distance" || state.phase === "bin" || state.phase === "winners";
  const revealed = allRevealed || meRevealed;
  const podium = meRevealed;

  return (
    <div className="phone">
      <div className="airmail" />
      {!online && <div className="offline">Reconnecting…</div>}
      <main className="phone-main">
        <section className="pass" aria-label="Your boarding pass">
          <div className="pass-main">
            <span className="pass-label">Boarding pass · Paper Plane Challenge</span>
            <span className="pass-k">{isTeam(p) ? "Team" : "Passenger"}</span>
            <strong className="pass-name">{p.name}</strong>
            {isTeam(p) && <span className="pass-team">{members(p)}</span>}
            <div className="pass-grid">
              <div>
                <span className="pass-k">Flight</span>
                <strong className="pass-id">{p.id}</strong>
              </div>
              <div>
                <span className="pass-k">Gate</span>
                <strong>{state.pin}</strong>
              </div>
              {code && (
                <div>
                  <span className="pass-k">Rejoin code</span>
                  <strong className="pass-code">{code}</strong>
                </div>
              )}
            </div>
            {code && <span className="pass-hint">Switching phone or browser? Join with your name and this code.</span>}
          </div>
          <div className="pass-stub">
            <span className="pass-k">{mode === "both" ? "Points" : mode === "distance" ? "Flight" : "In bin"}</span>
            <strong className="pass-pts">
              {mode === "both" ? <CountUp value={p.total} /> : mode === "distance" ? (p.distance ? p.distance.toFixed(2) : "–") : binText(state, p.bins)}
            </strong>
            <span className="pass-k">Rank</span>
            {/* hidden during the podium drumroll so phones don't spoil the reveal */}
            <strong className="pass-rank">
              {state.phase === "winners" && !revealed ? "?" : started && p.total > 0 ? placeOf(p) : "–"}
            </strong>
            <span className="pass-of">of {scored.length}</span>
          </div>
        </section>

        {/* Keyed so each new status slides in. No exit animation: it would stall while a phone is locked. */}
        <motion.section
            key={state.phase + title}
            className={`status sheet taped ${place === 0 ? "your-turn" : ""}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {state.phase === "winners" ? (
              !revealed ? (
                <>
                  <h2 className="display">Drumroll…</h2>
                  <p>Eyes on the big screen. The top {state.winners} are being revealed.</p>
                </>
              ) : podium ? (
                <>
                  <h2 className="display">{myPlace === 1 ? "You won!" : "You're a winner!"}</h2>
                  <p className="big-place hand">{p.tied ? placeOf(p) : ordinal(myPlace)} place</p>
                </>
              ) : (
                <>
                  <h2 className="display">You finished {placeOf(p)}</h2>
                  <p>Not in the top {state.winners} this time. Good flying, and thanks for playing.</p>
                </>
              )
            ) : (
              <>
                <h2 className="display">{title}</h2>
                <p>{line}</p>
              </>
            )}
            <LandingStamp landing={landing} />
        </motion.section>

        {(state.phase === "bin" || drops.length > 0) && <BinDrop drops={drops} small points={mode === "both" ? SCORING.binPoints : null} />}

        {allRevealed && (
          <a className="btn red" href={`/results?pin=${state.pin}`}>
            See full results
          </a>
        )}

        <button className="link foot-link sound-toggle" onClick={toggleSound}>
          {soundOn ? (soundReady ? "Sound on (tap to mute)" : "Tap anywhere to turn sound on") : "Sound off (tap to turn on)"}
        </button>

        {started && (
          <dl className="tally">
            {state.rounds.includes("distance") && (
              <div>
                <dt>Distance</dt>
                <dd>{p.distance ? `${p.distance.toFixed(2)} m` : "–"}</dd>
                {mode === "both" && <dd className="tally-pts">{p.distPts} pts</dd>}
              </div>
            )}
            {state.rounds.includes("bin") && (
              <div>
                <dt>Bin</dt>
                <dd>
                  <Dots n={p.bins} max={binThrows(state)} />
                </dd>
                {mode === "both" && <dd className="tally-pts">{p.binPts} pts</dd>}
              </div>
            )}
          </dl>
        )}
      </main>
      {intro && <RoundIntro key={intro.n} phase={intro.phase} cfg={state} onReveal={reveal} onDone={done} />}
      <Confetti fire={podium ? 1 : 0} amount={myPlace === 1 ? 220 : 120} />
      {code && !codeSaved && (
        <SaveCode
          code={code}
          name={p.name}
          id={p.id}
          pin={state.pin}
          onDone={() => {
            store.set(savedKey, true);
            setCodeSaved(true);
          }}
        />
      )}
    </div>
  );
}

/** One-time card after joining: screenshot your rejoin code. */
function SaveCode({ code, name, id, pin, onDone }: { code: string; name: string; id: string; pin: string; onDone: () => void }) {
  return (
    <div className="dialog-back">
      <motion.div
        className="dialog save-code sheet taped"
        role="dialog"
        aria-modal="true"
        aria-label="Save your rejoin code"
        initial={{ y: 40, rotate: -3 }}
        animate={{ y: 0, rotate: -1 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
      >
        <h2 className="display">Screenshot this</h2>
        <div className="code-card">
          <span className="pass-k">Rejoin code</span>
          <strong>{code}</strong>
          <span>
            {name} · {id} · Gate {pin}
          </span>
        </div>
        <p>
          If you switch phone or browser, join with your name and this code to <b>keep your points</b>. Take a screenshot now. You can
          delete it after the event.
        </p>
        <p className="hint">It also stays on your boarding pass.</p>
        <button className="btn red" onClick={onDone}>
          Got it, I&apos;ve saved it
        </button>
      </motion.div>
    </div>
  );
}
