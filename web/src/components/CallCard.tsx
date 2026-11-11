import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { callOrder } from "../queue";
import type { GameState, Player } from "../types";
import { BinStepper, DistanceInput } from "./Inputs";
import { Plane } from "./Plane";

type Send = (m: object) => void;
type Landing = { key: number; name: string; m: number };

/** Fires a short "landed" moment whenever a distance is logged. */
export function useLanding(players: Player[] | undefined, onlyId?: string) {
  const prev = useRef<Map<string, number | null> | null>(null);
  const [landing, setLanding] = useState<Landing | null>(null);

  useEffect(() => {
    if (!players) return;
    const before = prev.current;
    prev.current = new Map(players.map((p) => [p.id, p.distance]));
    if (!before) return; // first load: nothing new landed
    const p = players.find((p) => (!onlyId || p.id === onlyId) && p.distance !== null && p.distance !== before.get(p.id));
    if (!p) return;
    const event = { key: Math.random(), name: p.name, m: p.distance! };
    setLanding(event);
    setTimeout(() => setLanding((l) => (l === event ? null : l)), 2200);
  }, [players, onlyId]);

  return landing;
}

/** Big plane-skids-in stamp: "LANDED 7.42 m". */
export function LandingStamp({ landing }: { landing: Landing | null }) {
  return (
    <AnimatePresence>
      {landing && (
        <motion.div
          key={landing.key}
          className="landed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          <motion.span
            className="landed-plane"
            initial={{ x: "-120%", y: -40, rotate: 25 }}
            animate={{ x: "0%", y: 0, rotate: [25, -6, 0] }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <Plane size={90} />
          </motion.span>
          <motion.div
            className="landed-stamp"
            initial={{ scale: 2.2, rotate: -14, opacity: 0 }}
            animate={{ scale: 1, rotate: -6, opacity: 1 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 500, damping: 18 }}
          >
            <span>Landed</span>
            <strong>{landing.m.toFixed(2)} m</strong>
            <em className="hand">{landing.name}</em>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The "now throwing" card for the distance and bin rounds. The app calls players
 * one by one; logging a distance (or pressing Done in the bin round) calls the next.
 * Skip moves past someone who isn't here, and they come round again at the end.
 */
export function CallCard({ state, send, compact }: { state: GameState; send: Send; compact?: boolean }) {
  const order = callOrder(state);
  const up = order[0];
  const next = order.slice(1, compact ? 3 : 4);
  const landing = useLanding(state.players);
  const isBin = state.phase === "bin";

  return (
    <section className={`call sheet ${compact ? "compact" : ""}`} aria-live="polite">
      {!up ? (
        <div className="call-empty">
          <span className="kicker">Everyone's thrown</span>
          <p className="hand">That's the whole field. Press Next when you're ready.</p>
        </div>
      ) : (
        <>
          <div className="call-top">
            <span className="kicker">Now throwing</span>
            <span className="call-left">{order.length} to go</span>
          </div>
          <motion.div
            key={up.id}
            className="call-who"
            initial={{ x: 80, opacity: 0, rotate: 3 }}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
          >
            <span className="call-id">{up.id}</span>
            <span className="call-name hand">{up.name}</span>
          </motion.div>
          <div className="call-actions">
            {isBin ? (
              <>
                <BinStepper key={up.id} p={up} send={send} />
                <button className="btn navy" onClick={() => send({ t: "binDone", id: up.id })}>
                  Done, next →
                </button>
              </>
            ) : (
              <>
                <DistanceInput key={up.id} p={up} send={send} autoFocus={!compact} />
                <span className="hint">Enter saves and calls the next player</span>
              </>
            )}
            <button className="btn skip" onClick={() => send({ t: "skip" })}>
              Not here? Skip
            </button>
          </div>
          {next.length > 0 && (
            <p className="call-next">
              <span>Up next</span>
              {next.map((p) => (
                <b key={p.id}>
                  {p.id} {p.name}
                </b>
              ))}
            </p>
          )}
        </>
      )}
      {!isBin && <LandingStamp landing={landing} />}
    </section>
  );
}
