import { motion } from "motion/react";
import type { Phase } from "../types";
import { PHASE_LABEL } from "../mode";
import { Plane } from "./Plane";

/** The run of show as a dashed flight route. The plane sits on the current stop. */
/** `phases` = this game's run of show (rounds that are switched off are left out). */
export function StepBar({ phase, phases, onPick }: { phase: Phase; phases: Phase[]; onPick?: (p: Phase) => void }) {
  const at = phases.indexOf(phase);
  return (
    <nav className="route" aria-label="Event steps">
      {phases.map((p, i) => (
        <button
          key={p}
          className={`stop ${i < at ? "past" : ""} ${i === at ? "here" : ""}`}
          onClick={onPick && (() => onPick(p))}
          tabIndex={onPick ? undefined : -1}
          aria-current={i === at ? "step" : undefined}
        >
          <span className="stop-dot">
            {i === at && (
              <motion.span className="stop-plane" layoutId="route-plane" transition={{ type: "spring", stiffness: 200, damping: 22 }}>
                <Plane size={46} />
              </motion.span>
            )}
          </span>
          <span className="stop-label">{PHASE_LABEL[p]}</span>
        </button>
      ))}
    </nav>
  );
}
