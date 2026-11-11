import { useState } from "react";
import { Plane } from "../components/Plane";
import { EVENT } from "../config";

export default function Home() {
  const [pin, setPin] = useState("");
  return (
    <div className="phone">
      <div className="airmail" />
      <main className="phone-main">
        <header className="phone-hero">
          <Plane size={120} className="hero-plane" />
          <h1 className="display">{EVENT.title}</h1>
          <p className="hand">Fold it. Throw it. Bin it.</p>
          <p className="hosted">Hosted by {EVENT.hostedBy}</p>
        </header>
        <form
          className="sheet taped form"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^\d{4}$/.test(pin)) location.href = `/join?pin=${pin}`;
          }}
        >
          <label htmlFor="pin">Game PIN</label>
          <input
            id="pin"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="0000"
            className="pin-input"
          />
          <button className="btn red" disabled={pin.length !== 4}>
            Find my gate
          </button>
        </form>
        <p className="foot-link">
          Running the event? <a href="/host">Open the host screen</a>
        </p>
      </main>
    </div>
  );
}
