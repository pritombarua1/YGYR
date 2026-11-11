import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { GameState, Phase } from "../types";
import { roundKicker } from "../mode";
import { Plane } from "./Plane";
import { flightTear } from "./tear";
import { play } from "../sound";

const TITLES: Record<Phase, [string, string] | null> = {
  lobby: null,
  rules: ["Briefing", "The rules"],
  distance: ["Round 1", "Distance"],
  bin: ["Round 2", "Bin"],
  winners: ["Final", "The podium"],
};

// Timeline of the intro, in ms.
const TEAR_AT = 1900; // title has had its moment; the screen tears open
const DONE_AT = 2650;

/**
 * Phase changes play the round intro first, then reveal the new page.
 * `shown` is the phase whose page should be on screen: it only switches when the intro tears open,
 * so the new page (and its own animations) start fresh at the moment you see it.
 */
export function usePhaseTransition(phase: Phase | undefined) {
  const reduce = useReducedMotion();
  const latest = useRef(phase);
  const [shown, setShown] = useState(phase);
  const [intro, setIntro] = useState<{ phase: Phase; n: number } | null>(null);

  useEffect(() => {
    const before = latest.current;
    latest.current = phase;
    if (!phase || phase === before) return;
    if (!before || reduce || !TITLES[phase]) return setShown(phase); // first load, reduced motion, or back to lobby
    setIntro((i) => ({ phase, n: (i?.n ?? 0) + 1 }));
  }, [phase, reduce]);

  const reveal = useCallback(() => setShown(latest.current), []);
  const done = useCallback(() => setIntro(null), []);
  return { shown: shown ?? phase, intro, reveal, done };
}

/** A plane tears across the screen drawing its flight line, the round title unfolds, then the screen tears open along that line. */
export function RoundIntro({ phase, cfg, onReveal, onDone, sounds = false }: { phase: Phase; cfg: Pick<GameState, "rounds">; onReveal: () => void; onDone: () => void; sounds?: boolean }) {
  useEffect(() => {
    if (sounds) play("whoosh");
    const tear = sounds ? setTimeout(() => play("tear"), TEAR_AT - 60) : undefined;
    const a = setTimeout(onReveal, TEAR_AT);
    const b = setTimeout(onDone, DONE_AT);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
      clearTimeout(tear);
    };
  }, [onReveal, onDone]);

  const base = TITLES[phase];
  if (!base) return null;
  const title = phase === "distance" || phase === "bin" ? [roundKicker(cfg, phase), base[1]] : base;
  const cut = flightTear();
  const edge = flightTear(1.1); // a little wider: the white torn-paper edge

  // Both pieces draw the same background and flight line, each clipped to its side of the tear.
  const piece = (side: "top" | "bottom") => (
    <div className={`intro-piece ${side}`} style={{ clipPath: edge[side] }}>
      <div className="intro-bg seigaiha" style={{ clipPath: cut[side] }}>
        <svg className="intro-trail" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
          <motion.path
            d="M-40 470 C 220 300, 420 520, 620 330 S 900 120, 1060 90"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.85, ease: "easeIn" }}
          />
        </svg>
      </div>
    </div>
  );

  return (
    <div className="intro" aria-hidden="true">
      {piece("top")}
      {piece("bottom")}
      <motion.div
        className="intro-plane"
        initial={{ left: "-12%", top: "78%", rotate: -20 }}
        animate={{ left: ["-12%", "22%", "62%", "108%"], top: ["78%", "55%", "52%", "12%"], rotate: [-20, 6, -24, -30] }}
        transition={{ duration: 0.85, ease: "easeIn" }}
      >
        <Plane size={140} />
      </motion.div>
      <div className="intro-card-wrap">
        <motion.div
          className="intro-card"
          initial={{ scaleY: 0, rotate: -2 }}
          animate={{ scaleY: 1, rotate: -2 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 20 }}
        >
          <span className="intro-kicker">{title[0]}</span>
          <h1>{title[1]}</h1>
        </motion.div>
      </div>
    </div>
  );
}
