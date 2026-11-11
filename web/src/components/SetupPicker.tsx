import type { Entries, Round, Setup } from "../types";
import { binThrows } from "../mode";

const MIN_TEAM = 2;
const MAX_TEAM = 6;

/** One line saying what this game is, e.g. "Longest throw wins · solo pilots or teams of up to 4". */
export function describeSetup(s: Setup) {
  const what =
    s.rounds.length > 1
      ? `Distance + bin (${binThrows(s)} throws), points added up`
      : s.rounds[0] === "distance"
        ? "Longest throw wins"
        : `Bin only: most planes in from ${binThrows(s)} throws`;
  const who = s.entries === "solo" ? "individuals only" : s.entries === "teams" ? `teams of up to ${s.teamMax}` : `solo pilots or teams of up to ${s.teamMax}`;
  return `${what} · ${who}`;
}

/**
 * Which challenges run and who can enter. Used when creating a game and in the control Menu
 * (where it is locked once the first round has started).
 */
export function SetupPicker({
  value,
  onChange,
  locked,
  noShrink,
  winners = 3,
}: {
  value: Setup;
  onChange: (s: Setup) => void;
  locked?: boolean; // challenges + who can enter: fixed once the first round starts
  noShrink?: boolean; // teams exist: team size can still grow, never shrink
  winners?: number; // how many places win: for the prize totals
}) {
  const toggle = (r: Round) => {
    const on = value.rounds.includes(r);
    if (on && value.rounds.length === 1) return; // at least one challenge
    const rounds = (["distance", "bin"] as Round[]).filter((x) => (x === r ? !on : value.rounds.includes(x)));
    onChange({ ...value, rounds });
  };
  const entries: [Entries, string][] = [
    ["both", "Both"],
    ["solo", "Individuals"],
    ["teams", "Teams"],
  ];
  return (
    <div className="setup-pick">
      <span className="setup-k">Rounds</span>
      <div className="seg" role="group" aria-label="Rounds">
        {(
          [
            ["distance", "Longest throw"],
            ["bin", "Bin throw"],
          ] as [Round, string][]
        ).map(([r, label]) => {
          const on = value.rounds.includes(r);
          return (
            <button
              type="button"
              key={r}
              aria-pressed={on}
              className={on ? "on" : ""}
              disabled={locked}
              title={on && value.rounds.length === 1 ? "At least one round has to be on" : undefined}
              onClick={() => toggle(r)}
            >
              {on ? "✓ " : ""}
              {label}
            </button>
          );
        })}
      </div>

      <span className="setup-k">Who can enter</span>
      <div className="seg" role="radiogroup" aria-label="Who can enter">
        {entries.map(([e, label]) => (
          <button
            type="button"
            key={e}
            role="radio"
            aria-checked={value.entries === e}
            className={value.entries === e ? "on" : ""}
            disabled={locked}
            onClick={() => onChange({ ...value, entries: e })}
          >
            {label}
          </button>
        ))}
      </div>

      {value.entries !== "solo" && (
        <div className="winners-pick">
          <span>Team size up to</span>
          <button type="button" className="btn" disabled={noShrink || value.teamMax <= MIN_TEAM} onClick={() => onChange({ ...value, teamMax: value.teamMax - 1 })} aria-label="Smaller teams">
            −
          </button>
          <strong>{value.teamMax}</strong>
          <button type="button" className="btn" disabled={value.teamMax >= MAX_TEAM} onClick={() => onChange({ ...value, teamMax: value.teamMax + 1 })} aria-label="Bigger teams">
            +
          </button>
          {noShrink && <small>Teams have formed: it can go up, not down.</small>}
        </div>
      )}

      {value.entries !== "solo" && (
        <>
          <span className="setup-k">If a team wins</span>
          {value.teamPrize === "each" && (
            <small className="setup-warn">
              Every member of a winning team gets a prize: with {winners} winning teams of {value.teamMax} that's {winners * value.teamMax} prizes. Have enough ready.
            </small>
          )}
          <div className="seg" role="radiogroup" aria-label="If a team wins">
            {(
              [
                ["shared", `One prize, shared (${winners} prizes)`],
                ["each", `A prize each (up to ${winners * value.teamMax})`],
              ] as const
            ).map(([k, label]) => (
              <button
                type="button"
                key={k}
                role="radio"
                aria-checked={value.teamPrize === k}
                className={value.teamPrize === k ? "on" : ""}
                onClick={() => onChange({ ...value, teamPrize: k })}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="setup-sum">{describeSetup(value)}</p>
      <p className="hint">Players join on their own, then start a team or ask to join one (the captain approves). Team-mates are called one after another (own planes or one shared plane, their choice); a team scores the average of its members.</p>
    </div>
  );
}
