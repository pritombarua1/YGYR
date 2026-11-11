import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { store, useGame } from "../api";
import { entryFor, ordinal, place, score, scoreText } from "../scoring";
import { binText, modeOf, teamLabel } from "../mode";
import { matches } from "../queue";
import { EVENT, RECYCLE } from "../config";
import { Search } from "../components/Inputs";
import { Seal } from "../components/RuleSlides";
import { useRevealShown, winnersOf } from "../components/Podium";
import { SaveResult } from "../components/SaveResult";

/**
 * Everyone's results, for anyone to look at (QR on the big screen after the podium).
 * View-only. Opens once every winning place has been revealed, so it never spoils the show.
 * If this phone joined the game, its own row is highlighted.
 */
export default function Results() {
  const pin = new URLSearchParams(location.search).get("pin");
  const token = pin ? store.get<string>(`pp:player:${pin}`) : null;
  const [me, setMe] = useState<string | null>(null);
  const [noGame, setNoGame] = useState(false);
  const [query, setQuery] = useState("");

  const { state } = useGame(
    pin && /^\d{4}$/.test(pin) ? pin : null,
    () => (token ? { t: "hello", role: "player", token } : { t: "hello", role: "viewer" }),
    (m) => {
      if (m.t === "you") setMe(m.id);
      if (m.t === "nogame") setNoGame(true);
    },
  );
  const cfg = { rounds: state?.rounds ?? ["distance" as const, "bin" as const] };
  const mode = modeOf(cfg);
  const scored = useMemo(
    () => (state ? score(state) : []),
    [state?.players, state?.teams, state?.rounds?.join(), state?.entries],
  );
  const { shown } = useRevealShown(state?.reveal); // undefined until loaded
  const open = !!state && state.phase === "winners" && shown >= state.winners;

  const shell = (children: React.ReactNode) => (
    <div className="phone results">
      <header className="results-head seigaiha">
        <Seal />
        <span className="kicker">{EVENT.title}</span>
        <h1 className="display">Results</h1>
        {state && <span className="results-gate">Gate {state.pin}</span>}
      </header>
      <main className="phone-main">{children}</main>
    </div>
  );

  if (!pin || noGame) return shell(<p className="sheet msg">{noGame ? `No game with PIN ${pin}.` : "Open this page from the QR code on the big screen."}</p>);
  if (!state) return shell(<p className="hand center-note">Loading…</p>);
  if (!open)
    return shell(
      <section className="sheet msg">
        <h2 className="display">Not yet!</h2>
        <p>The results open as soon as the winners have been revealed on the big screen. Keep this page open; it updates by itself.</p>
      </section>,
    );

  const winners = winnersOf(scored, state.winners);
  const mine = me ? entryFor(scored, me) : undefined;
  // search by name, ID, or team name (so a team finds all its members)
  const rows = scored.filter((s) => matches(s, query) || (!!s.team && !!query.trim() && s.team.name.toLowerCase().includes(query.trim().toLowerCase())));

  return shell(
    <>
      {mine && (
        <motion.section className="sheet you-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <span className="kicker">You</span>
          <strong className="display">
            {place(mine)} of {scored.length}
          </strong>
          <span>
            {mine.name} · {scoreText(mine, cfg, mode)}
            {mode === "both" && ` (${mine.distPts} distance + ${mine.binPts} bin)`}
          </span>
          {me && <SaveResult state={state} me={me} />}
          <p className="recycle-note">♻️ {RECYCLE.short}</p>
        </motion.section>
      )}

      <section className="winners-list">
        <h2 className="display">Winners</h2>
        <ol>
          {winners.map((w, i) => (
            <motion.li
              key={w.id}
              className={`w${i + 1} ${w.id === mine?.id ? "me" : ""}`}
              initial={{ x: -40, opacity: 0, rotate: -2 }}
              animate={{ x: 0, opacity: 1, rotate: 0 }}
              transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 260, damping: 20 }}
            >
              <span className="place-seal small">{w.tied ? `=${ordinal(w.rank)}` : ordinal(i + 1)}</span>
              <span className="wl-name">
                {w.name}
                <small>
                  {w.id}
                  {w.team && ` · ${teamLabel(w)}`}
                </small>
              </span>
              <span className="wl-pts">{scoreText(w, cfg, mode)}</span>
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="sheet all-results">
        <header className="pilots-head">
          <h3 className="display">Everyone ({scored.length})</h3>
          <Search value={query} onChange={setQuery} />
        </header>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Pilot</th>
              {mode !== "bin" && <th>Flight</th>}
              {mode !== "distance" && <th>Bin</th>}
              {mode === "both" && <th>Pts</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className={s.id === mine?.id ? "me" : ""}>
                <td>{s.total > 0 ? place(s) : "–"}</td>
                <td>
                  {s.name}
                  <small>
                    {s.id}
                    {s.team && ` · ${teamLabel(s)}`}
                  </small>
                </td>
                {mode !== "bin" && <td>{s.distance ? `${s.distance.toFixed(2)} m` : "–"}</td>}
                {mode !== "distance" && <td>{binText(cfg, s.bins)}</td>}
                {mode === "both" && <td className="pts">{s.total}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="hand empty">No one matches "{query}".</p>}
      </section>
    </>,
  );
}
