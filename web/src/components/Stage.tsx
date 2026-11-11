import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { callOrder, roundStatus } from "../queue";
import type { Scored } from "../scoring";
import type { GameState } from "../types";
import { binText, binThrows, modeOf, PHASE_LABEL, roundKicker, teamOf } from "../mode";
import { SCORING } from "../config";
import { play } from "../sound";
import { LandingStamp, useLanding } from "./Landing";
import { BinDrop, useBinDrops } from "./BinDrop";
import { Leaderboard } from "./Leaderboard";
import { Plane } from "./Plane";

/**
 * Big-screen view of a round: only what's happening right now.
 * Who's throwing (huge), who's next, the landing moment, and a short top 5.
 */
export function Stage({ state, scored }: { state: GameState; scored: Scored[] }) {
  const isBin = state.phase === "bin";
  const mode = modeOf(state);
  const throws = binThrows(state);
  const last = state.rounds[state.rounds.length - 1] === state.phase;
  const nextRound = state.rounds[state.rounds.indexOf(state.phase as "distance" | "bin") + 1];
  const order = callOrder(state);
  const status = roundStatus(state);
  const landing = useLanding(state.players);
  // The landing moment comes first: the pilot who just threw stays on stage under the stamp,
  // and the next name slides in only once it's over (the server has already called them).
  const landed = landing && !isBin ? state.players.find((p) => p.id === landing.id) : undefined;
  const up = landed ?? order[0];
  const crew = up ? teamOf(state, up.id) : null;
  const next = (landed ? order : order.slice(1)).filter((p) => p.id !== up?.id).slice(0, 3);
  const complete = status.complete && !landed;
  // The leaderboard waits for the landing moment, then re-sorts: the throw first, then the shake-up.
  const held = useRef(scored);
  if (!landed) held.current = scored;
  const board = landed ? held.current : scored;
  const drops = useBinDrops(state.players);

  useEffect(() => {
    if (landing && !isBin) play("land");
  }, [landing]);
  useEffect(() => {
    if (drops.length) play("bin");
  }, [drops.length]);

  return (
    <div className="stage-wrap">
      <section className="stage sheet">
        {complete ? (
          <motion.div className="stage-done" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Plane size={160} />
            <strong className="display">{state.rounds.length > 1 ? `${roundKicker(state, state.phase as "distance" | "bin")} complete!` : "Everyone has flown!"}</strong>
            <span className="hand">{last || !nextRound ? "Time to find out who won…" : `Next up: ${PHASE_LABEL[nextRound].toLowerCase()} round.`}</span>
          </motion.div>
        ) : up ? (
          <>
            <span className="kicker">Now throwing</span>
            <motion.div
              key={up.id}
              className="stage-who"
              initial={{ x: 120, opacity: 0, rotate: 3 }}
              animate={{ x: 0, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
            >
              {crew && <span className="stage-team">for {crew.name}</span>}
              <span className="stage-name hand">{up.name}</span>
              <span className="stage-id">{up.id}</span>
            </motion.div>
            {isBin ? (
              <div className="slots" aria-label={`${up.bins ?? 0} of ${throws} in the bin`}>
                {Array.from({ length: throws }, (_, i) => (
                  <span key={`${up.id}-${i}-${(up.bins ?? 0) > i}`} className={`slot ${(up.bins ?? 0) > i ? "in" : ""}`} />
                ))}
              </div>
            ) : (
              <p className="stage-hint">Throw from the line!</p>
            )}
            {crew && crew.members.length > 1 && (
              // team formation: the whole team in throwing order, the one up now highlighted
              <ol className="formation" aria-label={`${crew.name}, in throwing order`}>
                {crew.members.map((id) => {
                  const m = state.players.find((p) => p.id === id);
                  if (!m) return null;
                  const done = isBin ? m.bins !== null : m.distance !== null;
                  return (
                    <li key={id} className={`${id === up.id ? "now" : ""} ${done ? "done" : ""}`}>
                      <Plane size={34} />
                      <b>{m.name}</b>
                      <small>{id === up.id ? "throwing" : done ? (isBin ? binText(state, m.bins) : `${m.distance?.toFixed(2)} m`) : "waiting"}</small>
                    </li>
                  );
                })}
              </ol>
            )}
            {next.length > 0 && (
              <p className="stage-next">
                <span>Up next</span>
                {next.map((p) => (
                  <b key={p.id}>{p.name}</b>
                ))}
              </p>
            )}
          </>
        ) : (
          <p className="hand stage-wait">Getting the next pilot ready…</p>
        )}
        <p className="stage-progress">
          {status.done.length} of {state.players.length} thrown
          {status.away.length > 0 && ` · ${status.away.length} not here`}
        </p>
        {!isBin && <LandingStamp landing={landing} />}
      </section>
      <aside className="stage-side">
        {isBin && <BinDrop drops={drops} points={mode === "both" ? SCORING.binPoints : null} />}
        {state.liveBoard ? (
          <Leaderboard rows={board} cfg={state} show={isBin ? "all" : "distance"} limit={7} title="Leaderboard" live />
        ) : (
          // Kahoot-style suspense: nobody knows who's leading until the podium
          <div className="board secret-board sheet taped">
            <span className="secret-hush" aria-hidden="true">🤫</span>
            <h2>Scores are secret</h2>
            <p className="hand">Who's in the lead? Nobody knows… until the big reveal!</p>
            <p className="secret-count">
              <b>{status.done.length}</b> of {status.field.length} {isBin ? "have had their bin throws" : "planes have flown"}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
