import { useState } from "react";
import { motion } from "motion/react";
import type { GameState, Player } from "../types";
import { binThrows, teamOf } from "../mode";

/** team: the team id they throw for (null = solo); newTeam: start a new team with this name instead. */
export type Fix = { name: string; team: string | null; newTeam?: string; distance: number | null; bins: number | null; tiebreak: number | null };

/**
 * Fix one player's name, flight distance and bin hits in one place.
 * Opened from a leaderboard row or "Edit" on any player row. Everything it saves can be undone.
 */
export function EditPlayer({
  p,
  cfg,
  onSave,
  onClose,
  onRemove,
}: {
  p: Player;
  cfg: Pick<GameState, "rounds" | "teams" | "entries" | "teamMax">;
  onSave: (fix: Fix) => void;
  onClose: () => void;
  onRemove?: () => void;
}) {
  const [name, setName] = useState(p.name);
  const current = teamOf(cfg, p.id);
  const [team, setTeam] = useState<string>(current?.id ?? "");
  const [newTeam, setNewTeam] = useState("");
  const max = binThrows(cfg);
  const [metres, setMetres] = useState(p.distance?.toString() ?? "");
  const [bins, setBins] = useState<number | null>(p.bins);
  const [throwOff, setThrowOff] = useState(p.tiebreak?.toString() ?? "");
  const [error, setError] = useState("");

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean || clean.length > 20) return setError("The name needs 1 to 20 characters.");
    if (team === "+new" && !newTeam.trim()) return setError("Type a name for the new team.");
    const text = metres.trim().replace(",", ".");
    const m = text === "" ? null : Number(text);
    if (m !== null && !(m > 0 && m <= 60)) return setError("Distance should be between 0 and 60 m, or empty if they haven't thrown.");
    const t = throwOff.trim().replace(",", ".");
    const tb = t === "" ? null : Number(t);
    if (tb !== null && !(tb > 0 && tb <= 60)) return setError("Throw-off should be between 0 and 60 m, or empty.");
    onSave({
      name: clean,
      team: team === "+new" ? null : team || null,
      newTeam: team === "+new" ? newTeam.trim() : undefined,
      distance: m === null ? null : Math.round(m * 100) / 100, bins, tiebreak: tb });
  };

  return (
    <div className="dialog-back" onClick={onClose}>
      <motion.form
        className="dialog edit sheet taped"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${p.name}`}
        initial={{ y: 40, rotate: -3 }}
        animate={{ y: 0, rotate: -1 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        onSubmit={save}
      >
        <h2 className="display">Fix {p.id}</h2>

        <label htmlFor="edit-name">Name</label>
        <input id="edit-name" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />

        {cfg.entries !== "solo" && (
          <>
            <label htmlFor="edit-team">Team (you can move people without the captain's OK)</label>
            <select id="edit-team" value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">No team (flies solo{cfg.entries === "teams" ? ": won't throw in a teams-only event" : ""})</option>
              {(cfg.teams ?? []).map((t) => (
                <option key={t.id} value={t.id} disabled={t.id !== current?.id && t.members.length >= cfg.teamMax}>
                  {t.name} ({t.members.length}/{cfg.teamMax})
                </option>
              ))}
              <option value="+new">New team…</option>
            </select>
            {team === "+new" && <input aria-label="New team name" maxLength={20} placeholder="Team name" value={newTeam} onChange={(e) => setNewTeam(e.target.value)} />}
          </>
        )}

        {cfg.rounds.includes("distance") && (
          <>
            <label htmlFor="edit-m">Flight distance (metres)</label>
            <input
              id="edit-m"
              inputMode="decimal"
              autoFocus
              placeholder="empty = hasn't thrown yet"
              value={metres}
              onChange={(e) => setMetres(e.target.value)}
            />
          </>
        )}

        {cfg.rounds.includes("bin") && (
          <>
        <span className="edit-label">Planes in the bin</span>
        <div className="seg" role="radiogroup" aria-label="Planes in the bin">
          {[null, ...Array.from({ length: max + 1 }, (_, i) => i)].map((n) => (
            <button
              type="button"
              key={String(n)}
              role="radio"
              aria-checked={bins === n}
              className={bins === n ? "on" : ""}
              onClick={() => setBins(n)}
            >
              {n === null ? "Not yet" : n}
            </button>
          ))}
        </div>
          </>
        )}

        <label htmlFor="edit-tb">Throw-off (metres): only to split a tie</label>
        <input
          id="edit-tb"
          inputMode="decimal"
          placeholder="empty = no throw-off"
          value={throwOff}
          onChange={(e) => setThrowOff(e.target.value)}
        />

        {p.code && (
          <p className="edit-code">
            Rejoin code <b>{p.code}</b>: give this to them if they switch phone or browser.
          </p>
        )}
        {error && <p className="error">{error}</p>}

        <div className="dialog-actions">
          {onRemove && (
            <button type="button" className="link danger edit-remove" onClick={onRemove}>
              Remove pilot
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn navy">Save</button>
        </div>
      </motion.form>
    </div>
  );
}
