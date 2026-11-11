import { useState } from "react";
import type { GameState } from "../types";
import { entryFor, score, scoreText } from "../scoring";
import { binText, modeOf, teamOf } from "../mode";
import { winnersOf } from "./Podium";
import { saveResult } from "../resultPhoto";

/** "Save my result" photo button, for the player's pass and the results page (once everything is revealed). */
export function SaveResult({ state, me }: { state: GameState; me: string }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const person = state.players.find((p) => p.id === me);
  if (!person) return null;

  const make = async () => {
    setBusy(true);
    setNote("");
    try {
      const scored = score(state);
      const entry = entryFor(scored, me);
      const crew = teamOf(state, me);
      const place = entry ? winnersOf(scored, state.winners).findIndex((w) => w.id === entry.id) + 1 : 0;
      const mode = modeOf(state);
      const flight = person.distance ? `${person.distance.toFixed(2)} m` : "no flight";
      const bin = `${binText(state, person.bins ?? 0)} in`;
      const mine = mode === "distance" ? flight : mode === "bin" ? bin : `${flight} · ${bin}`;
      const how = await saveResult({
        name: person.name,
        place: place || undefined,
        tied: !!entry?.tied && place > 0,
        team: crew ? { name: crew.name, members: crew.members.map((id) => state.players.find((p) => p.id === id)?.name ?? id) } : undefined,
        mine,
        teamScore: crew && entry ? `${scoreText(entry, state, mode)}${mode === "both" ? "" : " average"}` : undefined,
        pin: state.pin,
      });
      setNote(how === "downloaded" ? "Saved to your downloads." : how === "shared" ? "Done!" : "");
    } catch {
      setNote("Couldn't make the photo on this phone. Take a screenshot instead!");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="save-result">
      <button className="btn navy" disabled={busy} onClick={make}>
        {busy ? "Making your photo…" : "📸 Save my result photo"}
      </button>
      {note && <p className="hint">{note}</p>}
    </div>
  );
}
