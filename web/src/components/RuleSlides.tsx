import { createContext, useContext, useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { pageTear } from "./tear";
import { play } from "../sound";
import { PERKS, SCORING } from "../config";
import { binThrows, modeOf, type Mode } from "../mode";
import type { GameState } from "../types";
import { PlaneShape } from "./Plane";

const N = SCORING.distancePlaces;

/** Rule text mentions how many win; {W} is filled in with this game's number. */
export const withWinners = (text: string, winners: number) => text.split("{W}").join(String(winners));

// One rule per screen. The host steps through them with Next / Back; phones show the same step.
// The slides depend on the game: which challenges run, and whether teams can enter.

export type Art = "fold" | "shape" | "team" | "distance" | "bin" | "total";
export type Rule = { short: string; title: string; text: string; phone: string; art: Art };
type RuleCfg = Pick<GameState, "rounds" | "entries" | "teamMax"> & Partial<Pick<GameState, "teamPrize">>;

export function rulesFor(cfg: RuleCfg): Rule[] {
  const mode = modeOf(cfg);
  const throws = binThrows(cfg);
  const word = ["zero", "one", "two", "Three", "Four", "Five", "Six"][throws] ?? String(throws);
  const teams = cfg.entries !== "solo";
  const who = cfg.entries === "teams" ? "Every team" : teams ? "Solo or team, everyone" : "Everyone";
  const rules: Rule[] = [
    {
      short: "Fold",
      title: "Fold your plane",
      text: "Grab one sheet from the table and fold it into a plane, any design you like. Here's the Glider, step by step.",
      phone: "Grab one sheet from the table and fold your plane. Any design you like.",
      art: "fold",
    },
    {
      short: "Real planes only",
      title: "It has to be a plane",
      text:
        "Wings and a nose, a proper plane shape. Scrunched-up paper balls don't count." +
        (mode === "both" ? " The same plane flies both rounds, so fold it well." : " Fold it well: it's the only one you get."),
      phone: "Wings and a nose. No paper balls." + (mode === "both" ? " The same plane flies both rounds." : ""),
      art: "shape",
    },
  ];
  if (teams)
    rules.push({
      short: cfg.entries === "teams" ? "Teams" : "Solo or team",
      title: cfg.entries === "teams" ? "Teams of 2 to " + cfg.teamMax : "Fly solo or as a team",
      text:
        (cfg.entries === "teams" ? `Teams of up to ${cfg.teamMax}.` : `On your own, or in a team of up to ${cfg.teamMax}.`) +
        " On your phone: start a team, or ask to join one and the captain lets you in. Everyone throws, one after another: fold your own planes or pass one plane along, your call. A team scores the average of its members, so a big team has no advantage over a solo pilot.",
      phone: "Start a team or ask to join one. Everyone throws, one after another (own planes or one shared plane). A team scores its average.",
      art: "team",
    });
  if (cfg.rounds.includes("distance"))
    rules.push({
      short: "Distance",
      title: mode === "both" ? "Round 1: Distance" : "Who can fly the furthest?",
      text:
        mode === "both"
          ? `We call your name. Throw once from the line, and we measure to where it stops. The ${N} longest flights score ${N}, ${N - 1} … down to 1.`
          : "We call your name. Throw once from the line, and we measure to where it stops. The longest flight wins.",
      phone: mode === "both" ? `When your name is called, throw once from the line. The ${N} longest flights score ${N} down to 1.` : "When your name is called, throw once from the line. Longest flight wins.",
      art: "distance",
    });
  if (cfg.rounds.includes("bin"))
    rules.push({
      short: "Bin",
      title: mode === "both" ? "Round 2: Bin" : "Land it in the bin",
      text:
        mode === "both"
          ? `${word} throws at the bin. Every plane that lands in scores ${SCORING.binPoints} points. Short thrower? This is your comeback.`
          : `${word} throws at the bin. The most planes in the bin wins.`,
      phone: mode === "both" ? `${word} throws at the bin. Every plane in scores ${SCORING.binPoints} points.` : `${word} throws at the bin. Most planes in wins.`,
      art: "bin",
    });
  const teamPrize = teams ? (cfg.teamPrize === "each" ? " A winning team: a prize for everyone in it." : " A winning team shares its prize.") : "";
  rules.push({
    short: mode === "both" ? "Add it up" : "Winners",
    title: mode === "both" ? "Add it up" : "The winners",
    text:
      (mode === "both"
        ? "Distance points + bin points = your total. On a tie, the longer flight wins. "
        : "Exactly the same result? One more throw each to settle it. ") + PERKS + teamPrize,
    phone: (mode === "both" ? "Distance + bin = your total. Tie? Longer flight wins. " : "Tie? One more throw each. ") + PERKS + teamPrize,
    art: "total",
  });
  return rules;
}

/** Red seal with a little folded plane in it (the origami touch, no words). */
export function Seal({ className = "hanko" }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <path d="M6 22 L34 8 L22 32 L19 24 Z M19 24 L34 8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/**
 * The rules, one at a time. Changing step plays a page turn: an indigo sheet slides over the
 * old rule, then tears in two and falls away to show the new one. The new rule only mounts
 * once it is covered, so its drawing starts from the beginning as it is revealed.
 * The bar underneath jumps straight to any rule (host only, via onPick).
 */
export function RulePager({ rules, step, onPick, winners = 3, mode }: { rules: Rule[]; step: number; onPick?: (step: number) => void; winners?: number; mode: Mode }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(step);
  const [turn, setTurn] = useState<{ to: number; dir: 1 | -1; n: number } | null>(null);

  useEffect(() => {
    if (step === shown && !turn) return;
    if (reduce) return setShown(step);
    setTurn((t) => ({ to: step, dir: step >= (t?.to ?? shown) ? 1 : -1, n: (t?.n ?? 0) + 1 }));
  }, [step]);

  return (
    <div className="pager">
      <div className="pager-stage">
        <RuleSlide rules={rules} step={Math.min(shown, rules.length - 1)} winners={winners} mode={mode} />
        {turn && <PageTurn key={turn.n} rules={rules} to={Math.min(turn.to, rules.length - 1)} dir={turn.dir} onCovered={() => setShown(turn.to)} onDone={() => setTurn(null)} />}
      </div>
      <nav className="slide-dots" aria-label="Rules">
        {rules.map((r, i) => (
          <button
            key={r.short}
            className={i === step ? "on" : i < step ? "past" : ""}
            onClick={() => onPick?.(i)}
            disabled={!onPick}
            aria-label={`Rule ${i + 1}: ${r.short}`}
            aria-current={i === step ? "step" : undefined}
            title={`${i + 1}. ${r.short}`}
          >
            <span>{i + 1}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function PageTurn({ rules, to, dir, onCovered, onDone }: { rules: Rule[]; to: number; dir: 1 | -1; onCovered: () => void; onDone: () => void }) {
  useEffect(() => {
    const s = setTimeout(() => play("tear", 0.6), 520); // the sheet starts tearing
    const a = setTimeout(onCovered, 430); // sheet fully over the old rule
    const b = setTimeout(onDone, 1200);
    return () => {
      clearTimeout(s);
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  const cut = pageTear();
  const edge = pageTear(0.9); // white torn-paper edge
  const face = (
    <div className="turn-face">
      <Seal />
      <span className="kicker">
        Rule {to + 1} of {rules.length}
      </span>
      <strong className="display">{rules[to].title}</strong>
    </div>
  );
  return (
    <div className="turn" style={{ "--from": dir > 0 ? "105%" : "-105%" } as React.CSSProperties} aria-hidden="true">
      <div className="turn-piece left" style={{ clipPath: edge.left }}>
        <div className="turn-inner seigaiha" style={{ clipPath: cut.left }}>{face}</div>
      </div>
      <div className="turn-piece right" style={{ clipPath: edge.right }}>
        <div className="turn-inner seigaiha" style={{ clipPath: cut.right }}>{face}</div>
      </div>
    </div>
  );
}

export function RuleSlide({ rules, step, winners = 3, mode }: { rules: Rule[]; step: number; winners?: number; mode: Mode }) {
  const rule = rules[step];
  const still = !!useReducedMotion();
  return (
    <div className="slide">
      <div className="slide-text">
        <span className="slide-n">{step + 1}</span>
        <span className="kicker">
          Rule {step + 1} of {rules.length}
        </span>
        <h2 className="display">{rule.title}</h2>
        <p>{withWinners(rule.text, winners)}</p>
      </div>
      <div className="slide-art washi">
        <Seal />
        <Still.Provider value={still}>
          {rule.art === "fold" && <FoldArt />}
          {rule.art === "shape" && <ShapeArt />}
          {rule.art === "team" && <TeamArt />}
          {rule.art === "distance" && <DistanceArt />}
          {rule.art === "bin" && <BinArt throws={binThrowsFor(mode)} points={mode === "both"} />}
          {rule.art === "total" && <TotalArt mode={mode} />}
        </Still.Provider>
      </div>
    </div>
  );
}

/*
 * The drawings below animate with SVG's own animation elements (SMIL): the browser runs them
 * natively with no JavaScript per frame, which keeps them smooth on a projector laptop.
 * Every animation in a drawing shares one loop length T, so they stay in step.
 */

const INK = "#1e3b8f"; // ballpoint blue, like a sketchbook
const PAPER = "#fbfcf9";
const INDIGO = "#dbe2f3"; // back of the paper (ai-iro tint)
const INDIGO2 = "#c3cdeb";
const RED = "#d3362c";

const Still = createContext(false); // reduced motion: draw a still frame instead

const kt = (times: number[]) => times.map((t) => +Math.min(1, Math.max(0, t)).toFixed(4)).join(";");
const loop = (T: number) => ({ dur: `${T}s`, repeatCount: "indefinite" });

/** Turns opacity on/off at given loop fractions. `steps` = [[time, value], …] starting at time 0. */
function Toggle({ T, steps }: { T: number; steps: [number, number][] }) {
  if (useContext(Still)) return null;
  return (
    <animate
      attributeName="opacity"
      values={steps.map((s) => s[1]).join(";")}
      keyTimes={kt(steps.map((s) => s[0]))}
      calcMode="discrete"
      {...loop(T)}
    />
  );
}

/** A group that is only visible between `on` and `off` (fractions of the loop). */
function Window({ T, on, off, stillShow = false, children }: { T: number; on: number; off: number; stillShow?: boolean; children: React.ReactNode }) {
  const still = useContext(Still);
  const steps: [number, number][] = on > 0 ? [[0, 0], [on, 1]] : [[0, 1]];
  if (off < 1) steps.push([off, 0]);
  return (
    <g opacity={still ? (stillShow ? 1 : 0) : on > 0 ? 0 : 1}>
      <Toggle T={T} steps={steps} />
      {children}
    </g>
  );
}

/**
 * A flap of paper that folds over a straight crease, from point A to point B.
 * The flap is squashed to nothing across the crease and out the other side, which reads as a
 * real fold; the face colour swaps halfway, when you'd start seeing the back of the paper.
 * mode "crease" folds over and opens back out again.
 */
function Flap({
  T,
  axis: [ax, ay, bx, by],
  t0,
  t1,
  outline,
  front,
  back = INDIGO,
  mode = "fold",
}: {
  T: number;
  axis: [number, number, number, number];
  t0: number;
  t1: number;
  outline: string;
  front?: React.ReactNode;
  back?: string;
  mode?: "fold" | "crease";
}) {
  const still = useContext(Still);
  const th = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  const mid = (t0 + t1) / 2;
  const fold = mode === "fold";
  const values = fold ? "1 1;1 1;1.05 0;1 -1;1 -1" : "1 1;1 1;1 -1;1 1;1 1";
  const showBack: [number, number][] = fold ? [[0, 0], [mid, 1]] : [[0, 0], [(t0 + mid) / 2, 1], [(mid + t1) / 2, 0]];
  const showFront: [number, number][] = showBack.map(([t, v]) => [t, 1 - v]);
  const face = (fill: string) => (
    <polygon points={outline} fill={fill} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  );
  return (
    <g transform={`translate(${ax} ${ay}) rotate(${th})`}>
      <g transform={still && fold ? "scale(1 -1)" : undefined}>
        {!still && (
          <animateTransform
            attributeName="transform"
            type="scale"
            values={values}
            keyTimes={kt([0, t0, mid, t1, 1])}
            calcMode="spline"
            keySplines="0 0 1 1;0.45 0 0.9 0.6;0.1 0.4 0.55 1;0 0 1 1"
            {...loop(T)}
          />
        )}
        <g transform={`rotate(${-th}) translate(${-ax} ${-ay})`}>
          <g opacity={still && fold ? 0 : 1}>
            <Toggle T={T} steps={showFront} />
            {front ?? face(PAPER)}
          </g>
          <g opacity={still && fold ? 1 : 0}>
            <Toggle T={T} steps={showBack} />
            {face(back)}
          </g>
        </g>
      </g>
    </g>
  );
}

const Poly = ({ points, fill = PAPER }: { points: string; fill?: string }) => (
  <polygon points={points} fill={fill} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
);
const Crease = ({ d }: { d: string }) => <path d={d} stroke={INK} strokeWidth="1.6" strokeDasharray="6 5" fill="none" opacity="0.7" />;
const Arrow = ({ d, both = false }: { d: string; both?: boolean }) => (
  <path
    d={d}
    fill="none"
    stroke={RED}
    strokeWidth="2.6"
    strokeLinecap="round"
    markerEnd="url(#pp-head)"
    markerStart={both ? "url(#pp-head)" : undefined}
  />
);
const Defs = () => (
  <defs>
    <marker id="pp-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M1 1 L8 5 L1 9" fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round" />
    </marker>
  </defs>
);

/**
 * Blue-pen stick figure, feet at (x, y), facing right. `throws` = loop fractions [start, windUp, release, end]
 * for an overarm throw. `hand` is drawn in the throwing hand (e.g. a plane).
 */
function StickMan({
  x,
  y,
  T,
  throws,
  hand,
  armDur,
}: {
  x: number;
  y: number;
  T: number;
  throws?: [number, number, number, number];
  hand?: React.ReactNode;
  armDur?: number; // when the arm repeats on its own shorter loop (bin: 3 throws)
}) {
  const still = useContext(Still);
  const line = { stroke: INK, strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const dur = armDur ?? T;
  const [a, b, c, d] = throws ?? [0, 0, 0, 0];
  return (
    <g transform={`translate(${x} ${y})`}>
      <g>
        {throws && !still && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 0 0;0 0 0;-5 0 0;6 0 0;0 0 0;0 0 0"
            keyTimes={kt([0, a, b, c, d, 1])}
            calcMode="spline"
            keySplines="0 0 1 1;0.3 0 0.7 1;0.5 0 0.5 1;0.3 0 0.7 1;0 0 1 1"
            {...loop(dur)}
          />
        )}
        <circle cx="2" cy="-139" r="13" fill={PAPER} stroke={INK} strokeWidth="3" />
        <path d="M6 -142 h4 M13 -142 h3" {...line} strokeWidth={2.5} />
        <path d="M1 -126 C 3 -106, -2 -84, 0 -62" {...line} />
        <path d="M0 -62 C -4 -40, -9 -20, -12 -1 l -9 2" {...line} />
        <path d="M0 -62 C 6 -40, 11 -20, 13 -1 l 10 1" {...line} />
        <path d="M0 -112 C -9 -98, -13 -84, -15 -68" {...line} />
        <g>
          {throws && !still && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 0 -112;0 0 -112;-85 0 -112;40 0 -112;0 0 -112;0 0 -112"
              keyTimes={kt([0, a, b, c, d, 1])}
              calcMode="spline"
              keySplines="0 0 1 1;0.3 0 0.7 1;0.6 0 0.4 1;0.3 0 0.7 1;0 0 1 1"
              {...loop(dur)}
            />
          )}
          <path d="M0 -112 C 12 -113, 24 -116, 34 -124" {...line} />
          {hand}
        </g>
      </g>
    </g>
  );
}

/** Plane held in the hand at (34, -124), nose forward. */
const HandPlane = () => (
  <g transform="translate(22 -136)">
    <PlaneShape scale={0.32} />
  </g>
);

/** A plane that follows `path` (nose along the curve) between loop fractions `from` → `to`, then vanishes at `hideAt`. */
function FlyingPlane({
  T,
  path,
  from,
  to,
  hideAt,
  scale = 0.36,
  children,
}: {
  T: number;
  path: string;
  from: number;
  to: number;
  hideAt: number;
  scale?: number;
  children?: React.ReactNode; // something other than a plane (the paper ball)
}) {
  const still = useContext(Still);
  if (still) return null;
  return (
    <g opacity="0">
      <Toggle T={T} steps={[[0, 0], [from, 1], [hideAt, 0]]} />
      <animateMotion
        path={path}
        rotate="auto"
        keyPoints="0;0;1;1"
        keyTimes={kt([0, from, to, 1])}
        calcMode="spline"
        keySplines="0 0 1 1;0.25 0.1 0.55 1;0 0 1 1"
        {...loop(T)}
      />
      {children ?? (
        <g transform={`translate(${-60 * scale} ${-24 * scale})`}>
          <PlaneShape scale={scale} />
        </g>
      )}
    </g>
  );
}

/** Draws a stroke on (pathLength trick) between `from` and `to`, holds, and clears at `clearAt`. */
const drawOn = (T: number, from: number, to: number, clearAt: number) => (
  <animate
    attributeName="stroke-dashoffset"
    values="1;1;0;0;1"
    keyTimes={kt([0, from, to, clearAt, 1])}
    {...loop(T)}
  />
);

/* --- 1. The Glider: fold it step by step on the table, then the stick man throws it --- */

const STEP = 2.2; // seconds per fold step
const STEPS = 6;
const FOLD_T = STEP * STEPS + 3.6; // + the throw

const FOLD_CAPTIONS = [
  "Fold in half, open it out",
  "Top corners to the centre",
  "Fold the top down to the dot",
  "Corners to the centre again",
  "Fold the tip up to lock it",
  "Fold in half, wings down",
  "Ready to fly!",
];
const NUMERALS = ["1", "2", "3", "4", "5", "6", "Go"];

function FoldArt() {
  const T = FOLD_T;
  const d = STEP / T;
  const on = (i: number) => i * d;
  // fold happens in the middle of each step's window
  const t0 = (i: number) => on(i) + 0.28 * d;
  const t1 = (i: number) => on(i) + 0.78 * d;
  const throwAt = STEPS * d; // throw scene starts
  const s = (sec: number) => throwAt + sec / T; // seconds into the throw scene → loop fraction
  const release = s(0.98);

  return (
    <svg viewBox="0 0 420 330" className="art" role="img" aria-label="A sheet of paper folded step by step into a glider, then thrown">
      <Defs />
      {/* the table, with a stack of fresh sheets */}
      <path d="M120 252 H412" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M140 252 v58 M392 252 v58" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={340 + i * 3} y={226 - i * 5} width="52" height="24" fill={PAPER} stroke={INK} strokeWidth="2" transform={`rotate(${-5 + i * 4} 366 240)`} />
      ))}

      {/* the sheet: 150 × 210, sitting on the table */}
      <g transform="translate(168 32)">
        {/* 1. crease down the middle */}
        <Window T={T} on={on(0)} off={on(1)}>
          <Poly points="0,0 75,0 75,210 0,210" />
          <Flap T={T} axis={[75, 0, 75, 210]} t0={t0(0)} t1={t1(0)} outline="75,0 150,0 150,210 75,210" mode="crease" />
          <Crease d="M75 0 V210" />
          <Arrow d="M28 105 H122" both />
        </Window>

        {/* 2. top corners to the centre */}
        <Window T={T} on={on(1)} off={on(2)}>
          <Poly points="0,75 75,0 150,75 150,210 0,210" />
          <Crease d="M75 0 V210" />
          <Flap T={T} axis={[0, 75, 75, 0]} t0={t0(1)} t1={t1(1)} outline="0,0 75,0 0,75" />
          <Flap T={T} axis={[75, 0, 150, 75]} t0={t0(1)} t1={t1(1)} outline="75,0 150,0 150,75" />
          <Crease d="M0 75 L75 0 L150 75" />
          <Arrow d="M10 14 Q 34 44 62 52" />
          <Arrow d="M140 14 Q 116 44 88 52" />
        </Window>

        {/* 3. fold the top down to the dot */}
        <Window T={T} on={on(2)} off={on(3)}>
          <Poly points="0,95 150,95 150,210 0,210" />
          <Crease d="M75 95 V210" />
          <Flap
            T={T}
            axis={[0, 95, 150, 95]}
            t0={t0(2)}
            t1={t1(2)}
            outline="0,95 0,75 75,0 150,75 150,95"
            front={
              <>
                <Poly points="0,95 0,75 75,0 150,75 150,95" />
                <Poly points="0,75 75,0 75,75" fill={INDIGO} />
                <Poly points="75,0 150,75 75,75" fill={INDIGO} />
              </>
            }
          />
          <Crease d="M-8 95 H158" />
          <circle cx="75" cy="190" r="4.5" fill="none" stroke={RED} strokeWidth="2.5" />
          <Arrow d="M92 20 Q 128 110 82 182" />
        </Window>

        {/* 4. the new corners to the centre */}
        <Window T={T} on={on(3)} off={on(4)}>
          <Poly points="0,170 75,95 150,170 150,210 0,210" />
          <Poly points="75,95 27.5,142.5 75,190 122.5,142.5" fill={INDIGO} />
          <Flap
            T={T}
            axis={[0, 170, 75, 95]}
            t0={t0(3)}
            t1={t1(3)}
            outline="0,95 75,95 0,170"
            back={PAPER}
            front={
              <>
                <Poly points="0,115 27.5,142.5 0,170" />
                <Poly points="0,95 75,95 27.5,142.5 0,115" fill={INDIGO} />
              </>
            }
          />
          <Flap
            T={T}
            axis={[75, 95, 150, 170]}
            t0={t0(3)}
            t1={t1(3)}
            outline="150,95 75,95 150,170"
            back={PAPER}
            front={
              <>
                <Poly points="150,115 122.5,142.5 150,170" />
                <Poly points="150,95 75,95 122.5,142.5 150,115" fill={INDIGO} />
              </>
            }
          />
          <Crease d="M0 170 L75 95 L150 170" />
          <Arrow d="M8 106 Q 26 148 58 150" />
          <Arrow d="M142 106 Q 124 148 92 150" />
        </Window>

        {/* 5. lock the little tip up */}
        <Window T={T} on={on(4)} off={on(5)}>
          <Poly points="75,95 150,170 150,210 0,210 0,170" />
          <Poly points="75,95 0,170 75,170" />
          <Poly points="75,95 150,170 75,170" />
          <Flap T={T} axis={[55, 170, 95, 170]} t0={t0(4)} t1={t1(4)} outline="55,170 95,170 75,190" back={INDIGO2} front={<Poly points="55,170 95,170 75,190" fill={INDIGO} />} />
          <Crease d="M45 170 H105" />
          <Arrow d="M100 196 Q 116 176 92 160" />
        </Window>

        {/* 6. fold in half (away from you), then the wings come down: the glider */}
        <Window T={T} on={on(5)} off={on(6)}>
          <g>
            <Toggle T={T} steps={[[0, 1], [on(5) + 0.62 * d, 0]]} />
            {/* right half folds behind, so it's drawn first */}
            <Flap
              T={T}
              axis={[75, 95, 75, 210]}
              t0={on(5) + 0.15 * d}
              t1={on(5) + 0.5 * d}
              outline="75,95 150,170 150,210 75,210"
              back={PAPER}
              front={
                <>
                  <Poly points="75,95 150,170 150,210 75,210" />
                  <Poly points="75,95 150,170 75,170" />
                  <Poly points="75,170 95,170 75,150" fill={INDIGO} />
                </>
              }
            />
            <Poly points="75,95 0,170 0,210 75,210" />
            <Poly points="75,95 0,170 75,170" />
            <Poly points="75,170 55,170 75,150" fill={INDIGO} />
          </g>
          <g opacity="0">
            <Toggle T={T} steps={[[0, 0], [on(5) + 0.62 * d, 1]]} />
            <Glider />
          </g>
        </Window>
      </g>

      {/* captions, each with a red seal numeral */}
      {FOLD_CAPTIONS.map((text, i) => (
        <Window key={text} T={T} on={on(i)} off={i === STEPS ? 1 : on(i + 1)} stillShow={i === STEPS}>
          <rect x="124" y="270" width="28" height="28" rx="5" fill={RED} />
          <text x="138" y="291" textAnchor="middle" className="art-seal">
            {NUMERALS[i]}
          </text>
          <text x="160" y="290" className="art-hand art-caption">
            {text}
          </text>
        </Window>
      ))}

      {/* the stick man waits, then throws the finished glider across the room */}
      <StickMan
        x={64}
        y={312}
        T={T}
        throws={[s(0.25), s(0.8), s(1.05), s(1.4)]}
        hand={
          <g opacity="0">
            <Toggle T={T} steps={[[0, 0], [throwAt, 1], [release, 0]]} />
            <HandPlane />
          </g>
        }
      />
      <FlyingPlane T={T} path="M100 196 C 170 120, 290 70, 470 120" from={release} to={s(2.6)} hideAt={s(2.6)} scale={0.42} />
    </svg>
  );
}

/** The finished glider, sketched in three quarter view (like the last picture on the instruction sheet). */
function Glider() {
  return (
    <g transform="translate(-12 60)">
      <Poly points="160,40 20,58 44,74" fill={INDIGO} />
      <Poly points="160,40 10,96 66,112" />
      <Poly points="160,42 66,112 88,140 108,94" fill={INDIGO2} />
      <path d="M160 40 L 30 92" stroke={INK} strokeWidth="1.5" opacity="0.6" />
    </g>
  );
}

/* --- 2. The stick man throws a paper ball (flops, crossed out), then a real plane (glides, circled) --- */

/** Scrunched paper ball, centred on 0,0. */
const Ball = () => (
  <g>
    <path d="M-10 -2 L-6 -9 L2 -10 L9 -5 L10 3 L5 9 L-3 10 L-9 6 Z" fill={PAPER} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M-5 -4 L1 1 L-1 6 M3 -6 L2 0 L7 3" fill="none" stroke={INK} strokeWidth="1.4" opacity="0.5" />
  </g>
);

function ShapeArt() {
  const T = 8;
  const arm = T / 2; // two throws
  const still = useContext(Still);
  const ballGo = (0.255 * arm) / T;
  const planeGo = 0.5 + ballGo;
  const label = (x: number, text: string, at: number) => (
    <g opacity={still ? 1 : 0}>
      <Toggle T={T} steps={[[0, 0], [at, 1], [0.97, 0]]} />
      <text x={x} y="300" textAnchor="middle" className="art-label">
        {text}
      </text>
    </g>
  );
  return (
    <svg viewBox="0 0 420 330" className="art" role="img" aria-label="A stick figure throws a paper ball, which flops and is crossed out, then a paper plane, which glides and is circled">
      <path d="M0 262 H420" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <StickMan
        x={44}
        y={262}
        T={T}
        armDur={arm}
        throws={[0.05, 0.19, 0.27, 0.4]}
        hand={
          <>
            <g opacity={still ? 0 : 1}>
              <Toggle T={T} steps={[[0, 1], [ballGo, 0]]} />
              <g transform="translate(38 -126)">
                <Ball />
              </g>
            </g>
            <g opacity="0">
              <Toggle T={T} steps={[[0, 0], [0.5, 1], [planeGo, 0]]} />
              <HandPlane />
            </g>
          </>
        }
      />

      {/* the ball flops down a short way */}
      <FlyingPlane T={T} path="M80 147 Q 112 110 150 252" from={ballGo} to={ballGo + 0.07} hideAt={0.97}>
        <Ball />
      </FlyingPlane>
      <path d="M120 222 L180 282 M180 222 L120 282" pathLength={1} strokeDasharray="1" strokeDashoffset={still ? 0 : 1} stroke={RED} strokeWidth="9" strokeLinecap="round" fill="none">
        {!still && drawOn(T, ballGo + 0.1, ballGo + 0.17, 0.97)}
      </path>
      {label(150, "paper ball: no", ballGo + 0.1)}

      {/* the plane glides much further */}
      <FlyingPlane T={T} path="M80 147 C 160 70, 290 100, 342 252 L 362 255" from={planeGo} to={planeGo + 0.17} hideAt={0.97} />
      <ellipse cx="350" cy="248" rx="52" ry="30" pathLength={1} strokeDasharray="1" strokeDashoffset={still ? 0 : 1} fill="none" stroke="#2e8a4d" strokeWidth="6">
        {!still && drawOn(T, planeGo + 0.19, planeGo + 0.26, 0.97)}
      </ellipse>
      {label(350, "real plane: yes", planeGo + 0.19)}
    </svg>
  );
}

/* --- 3. The stick man throws from the line; the tape measures to where it stops --- */

function DistanceArt() {
  const T = 5.5;
  const still = useContext(Still);
  const release = 0.255;
  const landed = 0.56;
  return (
    <svg viewBox="0 0 420 330" className="art" role="img" aria-label="A stick figure throws a plane from the line and a tape measures the flight">
      <Defs />
      <path d="M0 272 H420" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M92 200 V286" stroke={RED} strokeWidth="5" strokeDasharray="10 8" />
      <text x="96" y="192" className="art-label">throw line</text>

      {/* faint flight trail */}
      <path
        d="M80 158 C 150 70, 262 84, 330 258 L 352 262"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={still ? 0 : 1}
        fill="none"
        stroke={INK}
        strokeWidth="2"
        opacity="0.3"
      >
        {!still && drawOn(T, release, landed, 0.95)}
      </path>

      <StickMan
        x={44}
        y={272}
        T={T}
        throws={[0.05, 0.19, 0.27, 0.4]}
        hand={
          <g>
            <Toggle T={T} steps={[[0, 1], [release, 0], [0.92, 1]]} />
            <HandPlane />
          </g>
        }
      />
      <FlyingPlane T={T} path="M80 158 C 150 70, 262 84, 330 258 L 352 262" from={release} to={landed} hideAt={0.97} />

      {/* the tape rolls out from the line to the plane */}
      <rect x="92" y="282" height="16" width={still ? 258 : 0} fill="#ffd23f" stroke={INK} strokeWidth="2">
        {!still && <animate attributeName="width" values="0;0;258;258;0" keyTimes={kt([0, landed + 0.04, 0.74, 0.95, 1])} {...loop(T)} />}
      </rect>
      <g opacity={still ? 1 : 0}>
        <Toggle T={T} steps={[[0, 0], [0.75, 1], [0.95, 0]]} />
        <text x="220" y="324" textAnchor="middle" className="art-big">
          7.42 m
        </text>
      </g>
    </svg>
  );
}

/* --- 4. Three throws at the bin, +3 each --- */

const binThrowsFor = (mode: Mode) => binThrows({ rounds: mode === "bin" ? ["bin"] : ["distance", "bin"] });

function BinArt({ throws = 3, points = true }: { throws?: number; points?: boolean }) {
  const T = 2.5 * throws;
  const arm = T / throws; // one throw every 2.5 s
  const still = useContext(Still);
  const release = (i: number) => (i * arm + 0.255 * arm) / T;
  return (
    <svg viewBox="0 0 420 330" className="art" role="img" aria-label="A stick figure throws three planes into a bin, three points each">
      <Defs />
      <path d="M0 290 H420" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M100 222 V302" stroke={RED} strokeWidth="5" strokeDasharray="10 8" />
      <StickMan
        x={50}
        y={290}
        T={T}
        armDur={arm}
        throws={[0.05, 0.19, 0.27, 0.4]}
        hand={
          <g>
            {!still && <animate attributeName="opacity" values="1;0;1" keyTimes="0;0.255;0.7" calcMode="discrete" {...loop(arm)} />}
            <HandPlane />
          </g>
        }
      />
      {/* planes drop in behind the bin's front */}
      {Array.from({ length: throws }, (_, i) => (
        <FlyingPlane key={i} T={T} path="M86 176 Q 210 40 330 222" from={release(i)} to={release(i) + 0.085} hideAt={release(i) + 0.085} scale={0.32} />
      ))}
      <path d="M288 196h88l-10 94h-68Z" fill={PAPER} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M282 186h100v12H282Z" fill={INK} />
      <path d="M312 210 l3 70 M332 210 v70 M352 210 l-3 70" stroke={INK} strokeWidth="1.6" opacity="0.4" />
      {Array.from({ length: throws }, (_, i) => (
        <g key={i} opacity={still ? 1 : 0}>
          <Toggle T={T} steps={[[0, 0], [release(i) + 0.085, 1], [0.97, 0]]} />
          <text x={332 + (i - (throws - 1) / 2) * (throws > 3 ? 24 : 36)} y="164" textAnchor="middle" className="art-plus">
            {points ? `+${SCORING.binPoints}` : i + 1}
          </text>
        </g>
      ))}
      <text x="70" y="320" textAnchor="middle" className="art-label">{throws} throws</text>
    </svg>
  );
}

/* --- Teams: a team is one entry, just like a solo pilot --- */

function TeamArt() {
  const T = 5.5;
  const still = useContext(Still);
  const plane = (
    <g>
      <Toggle T={T} steps={[[0, 1], [0.255, 0], [0.92, 1]]} />
      <HandPlane />
    </g>
  );
  return (
    <svg viewBox="0 0 420 330" className="art" role="img" aria-label="A team of three, each with a plane, scores their average: the same scale as a solo pilot">
      <Defs />
      <path d="M0 262 H420" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      {/* the team: three figures, only the front one holds the plane */}
      <g transform="translate(0 30) scale(0.86)">
        <StickMan x={44} y={270} T={T} hand={<HandPlane />} />
        <StickMan x={92} y={270} T={T} hand={<HandPlane />} />
        <StickMan x={140} y={270} T={T} throws={[0.05, 0.19, 0.27, 0.4]} hand={plane} />
      </g>
      <g opacity={still ? 1 : 0}>
        <Toggle T={T} steps={[[0, 0], [0.45, 1], [0.95, 0]]} />
        <text x="226" y="160" textAnchor="middle" className="art-big">=</text>
      </g>
      <g transform="translate(0 30) scale(0.86)">
        <StickMan x={330} y={270} T={T} throws={[0.05, 0.19, 0.27, 0.4]} hand={plane} />
      </g>
      <text x="96" y="292" textAnchor="middle" className="art-label">team: the average</text>
      <text x="300" y="292" textAnchor="middle" className="art-label">solo: your throw</text>
      <text x="210" y="322" textAnchor="middle" className="art-label">same scale, so it's fair</text>
    </svg>
  );
}

/* --- 5. Distance points + bin points = total, then the podium rises --- */

function TotalArt({ mode = "both" }: { mode?: Mode }) {
  const T = 6;
  const still = useContext(Still);
  const pop = (at: number) => <Toggle T={T} steps={[[0, 0], [at, 1], [0.95, 0]]} />;
  const box = (x: number, label: string, value: string, at: number, fill = PAPER) => (
    <g opacity={still ? 1 : 0}>
      {pop(at)}
      <rect x={x} y="40" width="100" height="82" fill={fill} stroke={INK} strokeWidth="3" />
      {label && (
        <text x={x + 50} y="70" textAnchor="middle" className="art-label">
          {label}
        </text>
      )}
      <text x={x + 50} y={label ? 110 : 96} textAnchor="middle" className="art-big">
        {value}
      </text>
    </g>
  );
  return (
    <svg viewBox="0 0 420 330" className="art" role="img" aria-label="Distance points plus bin points make your total. Top three make the podium.">
      {mode === "both" ? (
        <>
          {box(10, "distance", "8", 0.04)}
          <g opacity={still ? 1 : 0}>
            {pop(0.14)}
            <text x="130" y="96" textAnchor="middle" className="art-big">+</text>
          </g>
          {box(150, "bin", "6", 0.2)}
          <g opacity={still ? 1 : 0}>
            {pop(0.3)}
            <text x="270" y="96" textAnchor="middle" className="art-big">=</text>
          </g>
          {box(290, "", "14", 0.36, "#ffd23f")}
        </>
      ) : (
        <>
          {box(60, "", mode === "distance" ? "9.10 m" : "4 in", 0.04, "#ffd23f")}
          {box(260, "", mode === "distance" ? "7.42 m" : "3 in", 0.2)}
          <g opacity={still ? 1 : 0}>
            {pop(0.12)}
            <text x="210" y="96" textAnchor="middle" className="art-big">&gt;</text>
          </g>
        </>
      )}

      {[
        { x: 100, h: 60, n: "2", at: 0.5 },
        { x: 180, h: 92, n: "1", at: 0.56 },
        { x: 260, h: 42, n: "3", at: 0.62 },
      ].map((b) => (
        <g key={b.n}>
          <rect x={b.x} width="80" y={still ? 290 - b.h : 290} height={still ? b.h : 0} fill={b.n === "1" ? "#ffd23f" : PAPER} stroke={INK} strokeWidth="3">
            {!still && (
              <>
                <animate attributeName="y" values={`290;290;${290 - b.h};${290 - b.h};290`} keyTimes={kt([0, b.at, b.at + 0.07, 0.93, 1])} {...loop(T)} />
                <animate attributeName="height" values={`0;0;${b.h};${b.h};0`} keyTimes={kt([0, b.at, b.at + 0.07, 0.93, 1])} {...loop(T)} />
              </>
            )}
          </rect>
          <g opacity={still ? 1 : 0}>
            <Toggle T={T} steps={[[0, 0], [b.at + 0.07, 1], [0.93, 0]]} />
            <text x={b.x + 40} y={290 - b.h + 34} textAnchor="middle" className="art-big">
              {b.n}
            </text>
          </g>
        </g>
      ))}
      <path d="M60 290 H380" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <text x="220" y="318" textAnchor="middle" className="art-label">{mode === "both" ? "tie? the longer flight wins" : "tie? one more throw each"}</text>
    </svg>
  );
}
