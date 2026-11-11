import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Player } from "../types";
import { Plane } from "./Plane";

type Drop = { key: number; label: string };

/** Watches bin counts and returns a short-lived "drop" for every new plane in the bin. Misses do nothing. */
export function useBinDrops(players: Player[] | undefined, onlyId?: string) {
  const prev = useRef<Map<string, number> | null>(null);
  const [drops, setDrops] = useState<Drop[]>([]);

  useEffect(() => {
    if (!players) return;
    const now = new Map(players.map((p) => [p.id, p.bins ?? 0]));
    const before = prev.current;
    prev.current = now;
    if (!before) return; // first load: don't replay old hits

    const added: Drop[] = [];
    for (const p of players) {
      if (onlyId && p.id !== onlyId) continue;
      const gained = (p.bins ?? 0) - (before.get(p.id) ?? 0);
      for (let i = 0; i < gained; i++) added.push({ key: Math.random(), label: p.name });
    }
    if (!added.length) return;
    setDrops((d) => [...d, ...added]);
    // Not cleared on re-run on purpose: each batch of drops removes itself.
    setTimeout(() => setDrops((d) => d.filter((x) => !added.includes(x))), 1800);
  }, [players, onlyId]);

  return drops;
}

export function BinDrop({ drops, small, points = 3 }: { drops: Drop[]; small?: boolean; points?: number | null }) {
  const last = drops[drops.length - 1]?.key ?? 0;
  return (
    <div className={`bin-stage ${small ? "small" : ""}`}>
      <AnimatePresence>
        {drops.map((d, i) => (
          <motion.div
            key={d.key}
            className="bin-fall"
            style={{ left: `${44 + (i % 3) * 4}%` }}
            initial={{ y: "-120%", rotate: 50, opacity: 1 }}
            animate={{ y: "120%", rotate: 80, opacity: [1, 1, 0] }}
            transition={{ duration: 0.55, ease: "easeIn", delay: i * 0.12 }}
          >
            <Plane size={small ? 56 : 90} />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Re-keying on each drop replays the squash-and-bounce */}
      <motion.div
        key={last}
        className="bin"
        initial={false}
        animate={last ? { scaleY: [1, 0.86, 1.08, 0.97, 1], scaleX: [1, 1.08, 0.95, 1.02, 1] } : {}}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <svg viewBox="0 0 120 130" aria-hidden="true">
          <path d="M14 18h92l-10 106H24Z" fill="#fbfcf9" stroke="#172133" strokeWidth="4" strokeLinejoin="round" />
          <path d="M10 12h100v10H10Z" fill="#1e3b8f" stroke="#172133" strokeWidth="4" strokeLinejoin="round" />
          {[38, 60, 82].map((x) => (
            <path key={x} d={`M${x} 30 ${x + (x - 60) * 0.1} 114`} stroke="#b9c7ce" strokeWidth="3" />
          ))}
        </svg>
      </motion.div>

      <AnimatePresence>
        {drops.slice(-1).map((d) => (
          <motion.div
            key={d.key}
            className="bin-plus hand"
            initial={{ opacity: 0, y: 10, rotate: -6 }}
            animate={{ opacity: 1, y: -10, rotate: -6 }}
            exit={{ opacity: 0, y: -30, transition: { duration: 0.25 } }}
            transition={{ delay: 0.55, type: "spring", stiffness: 400, damping: 18 }}
          >
            {points ? `+${points}` : "In!"} {small ? "" : d.label}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
