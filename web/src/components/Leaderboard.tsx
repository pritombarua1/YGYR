import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Scored } from "../scoring";
import type { GameState } from "../types";
import { SCORING } from "../config";
import { binText, modeOf, teamLabel } from "../mode";
import { play } from "../sound";

type Move = { delta: number; key: number }; // delta > 0: moved up that many places; Infinity: new on the board

/**
 * Standings, always strictly sorted by what's shown. With both rounds: distance points in round 1, total
 * points after. Distance only: metres. Bin only: planes in.
 *
 * `live` (the big screen): every row keeps its identity, so after a throw each row slides from where it
 * was to its new place. A climber rises in front of everyone (▲ badge), the ones it passes slide down a
 * place (▼), a newcomer slides in from below, and a new No. 1 gets a "NEW LEADER!" stamp and a cheer.
 */
export function Leaderboard({
  rows,
  cfg,
  limit = 5,
  show,
  onPick,
  title = "Top",
  live = false,
}: {
  rows: Scored[];
  cfg: Pick<GameState, "rounds">;
  limit?: number;
  show: "distance" | "all";
  onPick?: (id: string) => void;
  title?: string;
  live?: boolean;
}) {
  const reduce = useReducedMotion();
  const mode = modeOf(cfg);
  const value = (r: Scored) => (mode === "both" ? (show === "distance" ? r.distPts : r.total) : r.total);
  const flightCol = mode !== "bin";
  const binCol = mode === "bin" || (mode === "both" && show === "all");
  const ptsCol = mode === "both";
  const sorted = rows
    .filter((r) => value(r) > 0 || (show === "distance" && r.distance))
    .sort((a, b) => value(b) - value(a) || (b.distance ?? 0) - (a.distance ?? 0) || (b.tiebreak ?? 0) - (a.tiebreak ?? 0) || a.id.localeCompare(b.id));
  // shared rank when level on what's shown
  const ranked = sorted.map((r, i) => ({ r, rank: i + 1 }));
  ranked.forEach((x, i) => {
    const prev = ranked[i - 1];
    if (prev && value(prev.r) === value(x.r) && (prev.r.distance ?? 0) === (x.r.distance ?? 0) && (prev.r.tiebreak ?? 0) === (x.r.tiebreak ?? 0)) x.rank = prev.rank;
  });
  const top = ranked.slice(0, limit);

  // ---- who moved, and is there a new leader? (big screen only) ----
  // Worked out while rendering the very update that changes the order (not an effect a frame later),
  // so a climber's first frame is already at its old place and the slide is never skipped.
  const listRef = useRef<HTMLOListElement>(null);
  const before = useRef<string[] | null>(null);
  const changes = useRef<{ key: number; moves: Record<string, Move>; leader: { id: string; name: string } | null; takeover: boolean }>({
    key: 0,
    moves: {},
    leader: null,
    takeover: false,
  });
  const [, redraw] = useState(0);
  if (live) {
    const now = sorted.map((r) => r.id);
    const was = before.current;
    if (!was) before.current = now; // first draw: nothing "moved"
    else if (now.join("|") !== was.join("|")) {
      before.current = now;
      const moves: Record<string, Move> = {};
      const key = Date.now();
      now.forEach((id, i) => {
        const j = was.indexOf(id);
        // new on the board, or coming up from below the visible rows: climbs in from the bottom
        if (j === -1 || (j >= limit && i < limit)) moves[id] = { delta: Infinity, key };
        else if (j !== i) moves[id] = { delta: j - i, key };
      });
      const leader = now[0] && now[0] !== was[0] ? { id: now[0], name: sorted[0].name } : null;
      changes.current = { key, moves, leader, takeover: !!leader && was.length > 0 };
    }
  }
  const { moves, leader, key: changeKey } = changes.current;
  useEffect(() => {
    if (!changeKey) return;
    if (changes.current.takeover) play("cheer", 0.55);
    const t = setTimeout(() => {
      if (changes.current.key === changeKey) (changes.current = { ...changes.current, moves: {}, leader: null }), redraw((n) => n + 1);
    }, 3000);
    return () => clearTimeout(t);
  }, [changeKey]);
  const rowHeight = (listRef.current?.firstElementChild as HTMLElement | null)?.offsetHeight || 44;

  // A climber leaves quickly, then slows right down over the last stretch and glides into its place
  // (ease-out, no bounce). The rows it passes move faster, so they're out of the way before it arrives.
  const CLIMB_S = 2;
  const spring = (delta: number | undefined) =>
    reduce
      ? { duration: 0 }
      : delta && delta > 0
        ? { duration: CLIMB_S, ease: [0.5, 0, 0.15, 1] as const } // eases off the mark, rushes, then a long slow glide in
        : { duration: 0.75, ease: [0.25, 1, 0.5, 1] as const };

  return (
    <div className={`board sheet taped ${live ? "live" : ""}`}>
      <div className="board-head">
        <h2>{title}</h2>
        <span className="board-cols">
          {flightCol && <span>Flight</span>}
          {binCol && <span>Bin</span>}
          {ptsCol && <span>Pts</span>}
        </span>
      </div>
      {top.length === 0 ? (
        <p className="hand empty">Nobody's landed yet…</p>
      ) : (
        <ol className="board-rows" ref={listRef}>
          {top.map(({ r, rank }, i) => {
            const mv = moves[r.id];
            const up = !!mv && mv.delta > 0;
            const isNewLeader = leader?.id === r.id;
            return (
              <motion.li
                key={r.id}
                layout={live ? "position" : false}
                // lifted a touch while it climbs, settling back down as it arrives
                transition={{ layout: spring(mv?.delta), y: spring(mv?.delta), scale: { duration: CLIMB_S, times: [0, 0.25, 1], ease: "easeOut" } }}
                // a newcomer starts just below the last row and climbs past everyone to its place
                initial={live && mv?.delta === Infinity && !reduce ? { y: (top.length - i) * rowHeight } : false}
                animate={{ opacity: 1, y: 0, scale: up && !reduce ? [1, 1.05, 1] : 1 }}
                style={{ zIndex: up ? 3 : 1, position: "relative" }}
                className={`row r${rank} ${onPick ? "pickable" : ""} ${up ? "climbing" : ""} ${isNewLeader ? "new-leader" : ""}`}
                onClick={onPick && (() => onPick(r.id))}
                title={onPick ? `Fix ${r.name}'s scores` : undefined}
              >
                {/* re-keyed on every change of score, so the row flashes without being remounted */}
                <span key={`${value(r)}-${r.distance}-${r.bins}`} className="row-flash" aria-hidden="true" />
                <span className="row-rank">{rank}</span>
                <span className="row-name">
                  {r.name}
                  <small>
                    {r.id}
                    {r.team && ` · ${teamLabel(r)}`}
                  </small>
                </span>
                <span className="row-cols">
                  {flightCol && (
                    <span className="row-dist">
                      {r.distance ? (
                        <>
                          {r.distance.toFixed(2)}
                          <i>m</i>
                        </>
                      ) : (
                        "–"
                      )}
                    </span>
                  )}
                  {binCol && <span className="row-bin">{binText(cfg, r.bins)}</span>}
                  {ptsCol && <span className="row-pts">{value(r)}</span>}
                </span>
                {mv && (
                  <span key={mv.key} className={`row-move ${mv.delta === Infinity ? "new" : mv.delta > 0 ? "up" : "down"}`}>
                    {mv.delta === Infinity ? "NEW" : mv.delta > 0 ? `▲${mv.delta}` : `▼${-mv.delta}`}
                  </span>
                )}
              </motion.li>
            );
          })}
        </ol>
      )}
      {leader && (
        <div key={changeKey} className="leader-stamp" role="status">
          <span>New leader!</span>
          <strong className="hand">{leader.name}</strong>
        </div>
      )}
      {mode === "both" && show === "distance" && (
        <p className="board-more">
          Every flight scores: 1 point for each flight it beats, plus 1. Then the bin round adds {SCORING.binPoints} a plane.
        </p>
      )}
    </div>
  );
}
