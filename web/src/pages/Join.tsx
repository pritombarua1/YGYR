import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { store, useGame } from "../api";
import { entryFor, ordinal, place as placeOf, score } from "../scoring";
import { callOrder, isAway } from "../queue";
import { play, useSound } from "../sound";
import { useRevealShown, winnersOf } from "../components/Podium";
import { EVENT, SCORING } from "../config";
import { deviceKey, fingerprint } from "../device";
import { binText, binThrows, modeOf, roundKicker, teamMatches, teamOf } from "../mode";
import type { GameState, Team } from "../types";
import { rulesFor, withWinners } from "../components/RuleSlides";
import { LandingStamp, useLanding } from "../components/Landing";
import { Dots, Search } from "../components/Inputs";
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
        window.setTimeout(() => setError((e) => (e === m.message ? "" : e)), 5000);
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

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return setError("Pop your name in first.");
    if (clean.length > 20) return setError("Keep it to 20 characters.");
    setError("");
    setPending(true);
    send({ t: "join", name: clean, code: askCode ? code.trim().toUpperCase() : undefined, device: deviceKey(), fp: fingerprint() });
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

  if (state && me)
    return (
      <>
        <PlayerPass state={state} me={me} online={online} code={myCode} send={send} />
        {/* e.g. "That team name is taken", after a team action on the pass */}
        {error && (
          <div className="toast" role="alert" onClick={() => setError("")}>
            {error}
          </div>
        )}
      </>
    );

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
          <label htmlFor="name">Your name</label>
          <input id="name" autoComplete="given-name" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya S" />
          {entries !== "solo" && !askCode && (
            <p className="hint">{entries === "teams" ? "Teams only today: after joining, start a team or ask to join one." : "Flying with friends? After joining you can start a team or ask to join one."}</p>
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
                It's on your boarding pass on the other phone. Lost it? The host can look it up.
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

function PlayerPass({ state, me, online, code, send }: { state: GameState; me: string; online: boolean; code?: string; send: (m: object) => void }) {
  const scored = useMemo(() => score(state), [state.players, state.teams, state.rounds, state.entries]);
  const mode = modeOf(state);
  const person = state.players.find((o) => o.id === me);
  const p = entryFor(scored, me); // what I score for: my team, or just me (none: teams-only and not in a team)
  const crew = teamOf(state, me);
  const { intro, reveal, done } = usePhaseTransition(state.phase);
  const drops = useBinDrops(state.players, me);
  const landing = useLanding(state.players, me);
  const place = callOrder(state).findIndex((o) => o.id === me);
  const [soundOn, soundReady, toggleSound] = useSound();
  // podium timing matches the big screen's drumroll, so this phone never gives the result away
  const { shown } = useRevealShown(state.phase === "winners" ? state.reveal : 0);
  const winners = winnersOf(scored, state.winners);
  const myPlace = p ? winners.findIndex((w) => w.id === p.id) + 1 : 0; // 0 = not a winner
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

  // A captain hears about new requests to join.
  const asks = crew?.captain === me ? crew.requests.length : 0;
  const prevAsks = useRef(asks);
  useEffect(() => {
    if (asks > prevAsks.current) (play("pop"), navigator.vibrate?.(120));
    prevAsks.current = asks;
  }, [asks]);

  // Buzz the phone when it's your turn.
  useEffect(() => {
    if (place === 0) navigator.vibrate?.([200, 100, 200]);
  }, [place === 0, state.phase]);

  if (!person) return null;

  const [title, line] = statusFor(state, person.distance, person.bins, place, isAway(state, person));
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
            <span className="pass-k">Passenger</span>
            <strong className="pass-name">{person.name}</strong>
            {crew && <span className="pass-team">Team {crew.name}</span>}
            <div className="pass-grid">
              <div>
                <span className="pass-k">Flight</span>
                <strong className="pass-id">{person.id}</strong>
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
            <span className="pass-k">
              {crew ? "Team " : ""}
              {mode === "both" ? "points" : mode === "distance" ? (crew ? "avg" : "flight") : "in bin"}
            </span>
            <strong className="pass-pts">
              {!p ? "–" : mode === "both" ? <CountUp value={p.total} /> : mode === "distance" ? (p.distance ? p.distance.toFixed(2) : "–") : binText(state, p.bins)}
            </strong>
            <span className="pass-k">Rank</span>
            {/* hidden during the podium drumroll so phones don't spoil the reveal */}
            <strong className="pass-rank">
              {state.phase === "winners" && !revealed ? "?" : started && p && p.total > 0 ? placeOf(p) : "–"}
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
                  <h2 className="display">{myPlace === 1 ? (crew ? "Your team won!" : "You won!") : crew ? "Your team's a winner!" : "You're a winner!"}</h2>
                  <p className="big-place hand">{p?.tied ? placeOf(p) : ordinal(myPlace)} place</p>
                  {crew && (
                    <p>
                      {state.teamPrize === "each"
                        ? "Everyone in your team gets a prize: go up together!"
                        : "Your team wins the prize for this place: go up together to collect it."}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {/* no sad news: everyone who took part gets a thank-you (the full table is one tap away) */}
                  <h2 className="display">Great flying!</h2>
                  <p>{crew ? `Thanks for flying with ${crew.name}.` : "Thanks for taking part."} Snacks are for everyone, so help yourself!</p>
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

        {(state.phase === "lobby" || state.phase === "rules" || crew) && state.entries !== "solo" && <TeamCard state={state} me={me} send={send} />}

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
                <dd>{person.distance ? `${person.distance.toFixed(2)} m` : "–"}</dd>
                {mode === "both" && p && <dd className="tally-pts">{p.distPts} pts{crew ? " (team)" : ""}</dd>}
              </div>
            )}
            {state.rounds.includes("bin") && (
              <div>
                <dt>Bin</dt>
                <dd>
                  <Dots n={person.bins} max={binThrows(state)} />
                </dd>
                {mode === "both" && p && <dd className="tally-pts">{p.binPts} pts{crew ? " (team)" : ""}</dd>}
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
          name={person.name}
          id={person.id}
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

/**
 * Teams, on the player's own phone. Start a team (you're its captain) or ask to join one; the captain
 * accepts or declines. Locked once the throwing starts (then it just shows your team).
 */
function TeamCard({ state, me, send }: { state: GameState; me: string; send: (m: object) => void }) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const open = state.phase === "lobby" || state.phase === "rules";
  const mine = teamOf(state, me);
  const asked = state.teams.find((t) => t.requests.includes(me));
  const who = (id: string) => state.players.find((p) => p.id === id)?.name ?? id;
  const full = (t: Team) => t.members.length >= state.teamMax;

  if (mine) {
    const captain = mine.captain === me;
    return (
      <section className="sheet team-card">
        <span className="kicker">Your team · {mine.id}</span>
        <h2 className="display">{mine.name}</h2>
        <ol className="team-members">
          {mine.members.map((id) => (
            <li key={id}>
              <span>
                {who(id)}
                {id === me && " (you)"}
                {id === mine.captain && <small> captain</small>}
              </span>
              {captain && open && id !== me && (
                <button className="link danger" onClick={() => send({ t: "kickMember", id })}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ol>
        {captain && open && mine.requests.length > 0 && (
          <div className="team-asks">
            <strong>Want to join your team:</strong>
            {mine.requests.map((id) => (
              <div className="team-ask" key={id}>
                <span>{who(id)}</span>
                <button className="btn green" disabled={full(mine)} onClick={() => send({ t: "answerRequest", id, ok: true })}>
                  Accept
                </button>
                <button className="btn" onClick={() => send({ t: "answerRequest", id, ok: false })}>
                  Decline
                </button>
              </div>
            ))}
            {full(mine) && <p className="hint">Your team is full ({state.teamMax}).</p>}
          </div>
        )}
        <p className="hint">
          {open
            ? `You'll be called one after another. Your team scores the average of everyone's throws, so team size doesn't matter.${captain ? " You're the captain: you decide who joins." : ""}`
            : "Teams are locked now. You'll be called one after another."}
        </p>
        {open && (
          <button className="link" onClick={() => send({ t: "leaveTeam" })}>
            Leave team
          </button>
        )}
      </section>
    );
  }

  if (!open) return null;
  const others = state.teams.filter((t) => teamMatches(state, t, query));
  return (
    <section className="sheet team-card">
      <span className="kicker">Teams</span>
      {asked ? (
        <>
          <h2 className="display">Asked to join {asked.name}</h2>
          <p>Waiting for {who(asked.captain)} (the captain) to accept you.</p>
          <button className="btn" onClick={() => send({ t: "cancelRequest" })}>
            Cancel request
          </button>
        </>
      ) : (
        <>
          <h2 className="display">{state.entries === "teams" ? "Find a team" : "Fly with a team?"}</h2>
          {state.entries === "teams" && <p className="notice">Teams only today: you need a team to throw.</p>}
          {state.teams.length > 0 && (
            <Search value={query} onChange={setQuery} placeholder="Find a team or a friend's name" label="Search teams by name or member" />
          )}
          {state.teams.length > 0 && others.length === 0 && <p className="hint">No team matches "{query}". Start one below?</p>}
          {others.length > 0 && (
            <ul className="team-list">
              {others.map((t) => (
                <li key={t.id}>
                  <span>
                    <b>{t.name}</b>
                    <small>
                      {t.members.map(who).join(", ")} · {t.members.length}/{state.teamMax}
                    </small>
                  </span>
                  <button className="btn" disabled={full(t)} onClick={() => send({ t: "requestTeam", team: t.id })}>
                    {full(t) ? "Full" : "Ask to join"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="team-new"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) send({ t: "createTeam", name: name.trim() });
            }}
          >
            <input maxLength={20} placeholder="New team name" aria-label="New team name" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn red" disabled={!name.trim()}>
              Start a team
            </button>
          </form>
          <p className="hint">Start one and you're the captain: you accept who joins (up to {state.teamMax}).{state.entries === "both" ? " Or just fly solo: nothing to do." : ""}</p>
        </>
      )}
    </section>
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
