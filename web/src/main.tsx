import React from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "motion/react";
import App from "./App";
import { DialogProvider } from "./components/Dialog";
import { unlockSound } from "./sound";
import "./styles.css";

// Browsers only allow sound after a tap/click/key, so the first one anywhere switches audio on.
for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, unlockSound, { passive: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* reducedMotion="user" turns movement off for people who ask for less motion */}
    <MotionConfig reducedMotion="user">
      <DialogProvider>
        <App />
      </DialogProvider>
    </MotionConfig>
  </React.StrictMode>,
);
