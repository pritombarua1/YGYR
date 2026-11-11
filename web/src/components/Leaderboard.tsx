import type { Scored } from "../scoring";
import type { GameState } from "../types";
import { SCORING } from "../config";
import { binText, isTeam, members, modeOf } from "../mode";

/**
 * Standings, always strictly sorted by what's shown. With both challenges: distance points in round 1,
 * total points after. Distance only: metres. Bin only: planes in.
 * (No sliding animation: rows are simply re-drawn in order, and a row that just changed flashes.)
 */
export function Leaderboard({
  rows,
  cfg,
  limit = 5,
  show,
  onPick,
  title = "Top",
}: {
  rows: Scored[];
  cfg: Pick<GameState, "rounds">;
  limit?: number;
  show: "distance" | "all";
  onPick?: (id: string) => void;
  title?: string;
}) {
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

  return (
    <div className="board sheet taped">
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
        <ol className="board-rows">
          {top.map(({ r, rank }) => (
            <li
              key={`${r.id}-${value(r)}-${r.distance}`} // re-keyed on change so the row flashes
              className={`row r${rank} ${onPick ? "pickable" : ""}`}
              onClick={onPick && (() => onPick(r.id))}
              title={onPick ? `Fix ${r.name}'s scores` : undefined}
            >
              <span className="row-rank">{rank}</span>
              <span className="row-name">
                {r.name}
                <small>
                  {r.id}
                  {isTeam(r) && ` · ${members(r)}`}
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
            </li>
          ))}
        </ol>
      )}
      {mode === "both" && show === "distance" && (
        <p className="board-more">
          The {SCORING.distancePlaces} longest flights score ({SCORING.distancePlaces} → 1). Everyone can still score in the bin.
        </p>
      )}
    </div>
  );
}
