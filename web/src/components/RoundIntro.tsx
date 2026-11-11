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

/*
 * The flight line, in the trail's 1000 x 600 box: two cubic curves, written out so the plane can be put
 * exactly on it. FLIGHT is sampled once into points at equal distances along the line; the plane and the
 * line's drawing then share one timeline (FLIGHT_S long, easing in like a throw), so the plane is always
 * at the tip of the line and never stops at a waypoint.
 */
const SEGMENTS: [number, number][][] = [
  [[-40, 470], [220, 300], [420, 520], [620, 330]],
  [[620, 330], [820, 140], [900, 120], [1060, 90]], // "S 900 120, 1060 90": first control mirrors (420,520) round (620,330)
];
const FLIGHT = "M-40 470 C 220 300, 420 520, 620 330 C 820 140, 900 120, 1060 90";
const FLIGHT_S = 0.85;
const STEPS = 28;

const bez = (p: [number, number][], t: number): [number, number] => {
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [k.reduce((a, c, i) => a + c * p[i][0], 0), k.reduce((a, c, i) => a + c * p[i][1], 0)];
};

/** Plane keyframes: position (% of the screen), heading (deg, for the real screen shape) and the line drawn so far. */
function flightPlan(width: number, height: number) {
  // dense samples with cumulative length, to read off points by distance travelled
  const pts: [number, number][] = [];
  for (const seg of SEGMENTS) for (let i = pts.length ? 1 : 0; i <= 200; i++) pts.push(bez(seg, i / 200));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];
  const at = (d: number) => {
    const i = Math.max(1, cum.findIndex((c) => c >= d * total));
    return { p: pts[i], q: pts[i - 1] };
  };
  const times: number[] = [];
  const left: string[] = [];
  const top: string[] = [];
  const rotate: number[] = [];
  const drawn: number[] = [];
  let prevAngle = 0;
  for (let s = 0; s <= STEPS; s++) {
    const t = s / STEPS;
    const d = t * t; // ease in: slow off the hand, fast across the screen
    const { p, q } = at(Math.max(d, 0.0005));
    let angle = (Math.atan2(((p[1] - q[1]) * height) / 600, ((p[0] - q[0]) * width) / 1000) * 180) / Math.PI;
    while (angle - prevAngle > 180) angle -= 360; // never spin the long way round
    while (angle - prevAngle < -180) angle += 360;
    prevAngle = angle;
    times.push(t);
    left.push(`${p[0] / 10}%`);
    top.push(`${p[1] / 6}%`);
    rotate.push(+angle.toFixed(1));
    drawn.push(+d.toFixed(4));
  }
  return { times, left, top, rotate, drawn };
}

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
  const plan = flightPlan(window.innerWidth, window.innerHeight);
  const along = { duration: FLIGHT_S, times: plan.times, ease: "linear" as const };
  const cut = flightTear();
  const edge = flightTear(1.1); // a little wider: the white torn-paper edge

  // Both pieces draw the same background and flight line, each clipped to its side of the tear.
  const piece = (side: "top" | "bottom") => (
    <div className={`intro-piece ${side}`} style={{ clipPath: edge[side] }}>
      <div className="intro-bg seigaiha" style={{ clipPath: cut[side] }}>
        <svg className="intro-trail" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
          <motion.path d={FLIGHT} initial={{ pathLength: 0 }} animate={{ pathLength: plan.drawn }} transition={along} />
        </svg>
      </div>
    </div>
  );

  return (
    <div className="intro" aria-hidden="true">
      {piece("top")}
      {piece("bottom")}
      {/* centred on the line by its CSS margins, nose along it */}
      <motion.div
        className="intro-plane"
        initial={{ left: plan.left[0], top: plan.top[0], rotate: plan.rotate[0] }}
        animate={{ left: plan.left, top: plan.top, rotate: plan.rotate }}
        transition={along}
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
