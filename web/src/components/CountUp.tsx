import { useEffect, useRef, useState } from "react";

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Rolls a number up (or down) to `value` over ~0.7s. Starts from 0 on first show. */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [shown, setShown] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    const start = current.current;
    if (start === value) return;
    if (reduceMotion()) {
      current.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 700);
      const v = start + (value - start) * (1 - (1 - k) ** 3);
      current.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{shown.toFixed(decimals)}</>;
}
