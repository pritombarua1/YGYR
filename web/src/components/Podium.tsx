import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import QRCode from "qrcode";
import { level, ordinal, scoreText, type Scored } from "../scoring";
import type { GameState } from "../types";
import { binText, isTeam, members, modeOf, prizeText } from "../mode";
import { play } from "../sound";
import { Confetti } from "./Confetti";

export const SUSPENSE_MS = 2600; // drumroll before each place appears

/** The places that win, in order (1st first). Ties keep their shared rank. */
export const winnersOf = (scored: Scored[], count: number) => scored.filter((s) => s.total > 0).slice(0, count);

/**
 * The control phone sets how many places are revealed; screens show them one at a time,
 * each after a drumroll. On first load, whatever was already revealed shows straight away.
 * Phones use the same timing, so nobody's phone gives the result away early.
 */
export function useRevealShown(reveal: number | undefined, sounds = false) {
  const [shown, setShown] = useState(reveal ?? 0);
  const [suspense, setSuspense] = useState(false);
  // Before the game state has arrived there is nothing to count from. The first real value is
  // shown as-is (no replaying drumrolls for places revealed before this screen opened).
  const loaded = useRef(reveal !== undefined);
  useEffect(() => {
    if (reveal === undefined) return;
    if (!loaded.current) {
      loaded.current = true;
      setShown(reveal);
      return;
    }
    if (reveal < shown) {
      setShown(reveal);
      setSuspense(false);
      return;
    }
    if (reveal === shown) return;
    setSuspense(true);
    if (sounds) play("drumroll", 0.8);
    const t = setTimeout(() => {
      setShown((s) => s + 1);
      setSuspense(false);
    }, SUSPENSE_MS);
    return () => clearTimeout(t);
  }, [reveal, shown, sounds]);
  return { shown, suspense };
}

function useQr(url: string) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#172133", light: "#fbfcf9" } }).then(setSvg);
  }, [url]);
  return svg;
}

/** Ties among the winning places that still need a throw-off (same points and same flight). */
export function podiumTies(scored: Scored[], count: number) {
  const groups: Scored[][] = [];
  for (const s of scored.filter((s) => s.total > 0)) {
    const g = groups.find((g) => level(g[0], s));
    if (g) g.push(s);
    else groups.push([s]);
  }
  return groups.filter(
    (g) => g.length > 1 && Math.min(...g.map((s) => s.rank)) <= count && (g.some((s) => !s.tiebreak) || g.some((s) => s.tied)),
  );
}

/** Big-screen podium: places count..4 on an honours strip, then 3rd, 2nd, 1st on the podium. */
export function Podium({ scored, count, reveal, pin, cfg }: { scored: Scored[]; count: number; reveal: number; pin: string; cfg: Pick<GameState, "rounds" | "teamPrize"> }) {
  const mode = modeOf(cfg);
  const winners = winnersOf(scored, count);
  const { shown, suspense } = useRevealShown(reveal, true);
  const next = count - shown; // the place being revealed next
  const ties = podiumTies(scored, count);
  const allDone = shown >= count;
  const results = useQr(`${location.origin}/results?pin=${pin}`);

  // a bigger celebration the higher the place
  const last = useRef(shown);
  useEffect(() => {
    if (shown > last.current) {
      const place = count - shown + 1;
      play("reveal"); // taiko hit for every place
      if (place === 1) play("fanfare"); // + fanfare and crowd for the winner
      else if (place <= 3) play("cheer", 0.6);
    }
    last.current = shown;
  }, [shown, count]);
  const placeJustShown = count - shown + 1;

  const card = (place: number, big = false) => {
    const w = winners[place - 1];
    const visible = place > count - shown;
    if (!visible || !w) {
      return (
        <div className={`winner hidden ${!w && visible ? "empty" : ""}`}>{!w && visible ? `no ${ordinal(place)}` : "?"}</div>
      );
    }
    return (
      <motion.div
        key={w.id}
        className={`winner ${big ? "champion" : ""}`}
        initial={{ y: -160, opacity: 0, rotate: -12, scale: 0.7 }}
        animate={{ y: 0, opacity: 1, rotate: place === 1 ? -2 : place % 2 ? 1.5 : -1.5, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }} // lands with one small settle, no jelly
      >
        <span className="spotlight" aria-hidden="true" />
        <span className="place-seal">{w.tied ? `=${ordinal(w.rank)}` : ordinal(place)}</span>
        <span className="winner-name">{w.name}</span>
        {isTeam(w) && <span className="winner-team">{members(w)}</span>}
        {isTeam(w) && (w.members?.length ?? 0) > 1 && <span className="winner-prize">{prizeText(cfg, w)}</span>}
        <span className="winner-id">{w.id}</span>
        <span className="winner-pts">{scoreText(w, cfg, mode)}</span>
        {mode === "both" && (
          <span className="winner-detail">
            {w.distance ? `${w.distance.toFixed(2)} m` : "no flight"} · {binText(cfg, w.bins ?? 0)} in the bin
          </span>
        )}
      </motion.div>
    );
  };

  return (
    <div className="podium-wrap">
      {ties.map((group) => (
        <div className="tie-banner" key={group[0].id} role="status">
          <strong className="display">Tie for {ordinal(group[0].rank)}!</strong>
          <span>
            {group.map((p) => p.name).join(" & ")}: {mode === "both" ? "same points, same flight" : mode === "distance" ? "the exact same flight" : "the same number in the bin"}. Throw-off
            time: one more throw each, longest wins.
          </span>
        </div>
      ))}

      {/* 1st-3rd on the podium; with more winners, 4th and down get their own column beside it */}
      <div className={`podium-stage ${count > 3 ? "with-list" : ""}`}>
        <div className="podium">
          {[2, 1, 3].map((place) => (
            <div className={`place p${place}`} key={place}>
              <div className="winner-slot">{card(place, place === 1)}</div>
              <div className="block">
                <span>{place}</span>
              </div>
            </div>
          ))}
        </div>

        {count > 3 && (
          <aside className="also-winning sheet taped">
            <span className="kicker">Also winning</span>
            <ol>
              {Array.from({ length: count - 3 }, (_, i) => i + 4).map((place) => {
                const w = winners[place - 1];
                const visible = place > count - shown;
                return (
                  <li key={place} className={visible ? "shown" : ""}>
                    <span className="aw-place">{w?.tied && visible ? `=${ordinal(w.rank)}` : ordinal(place)}</span>
                    {visible && w ? (
                      <motion.span
                        className="aw-who"
                        initial={{ x: 60, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 26 }}
                      >
                        <b className="aw-name">{w.name}</b>
                        <small>{w.id}</small>
                        <span className="aw-pts">{scoreText(w, cfg, mode)}</span>
                      </motion.span>
                    ) : (
                      <span className="aw-q">{visible ? "nobody" : "?"}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </aside>
        )}
      </div>

      {suspense && (
        <div className="suspense" aria-live="polite">
          <span className="hand">And in</span>
          <strong className="display">{ordinal(next)} place…</strong>
        </div>
      )}

      {allDone && (
        <div className="results-call sheet">
          <div className="results-qr" dangerouslySetInnerHTML={{ __html: results }} />
          <div>
            <strong className="display">Everyone's results</strong>
            <span>Scan to find your score</span>
          </div>
        </div>
      )}
      {shown === 0 && !suspense && winners.length === 0 && <p className="hand podium-empty">No scores yet.</p>}
      <Confetti fire={shown} amount={placeJustShown === 1 ? 260 : placeJustShown <= 3 ? 140 : 60} />
    </div>
  );
}
