import { useEffect, useRef } from "react";

const COLOURS = ["#d3362c", "#1e3b8f", "#ffd23f", "#2e8a4d", "#fbfcf9"];

/** A burst of torn paper scraps. Skipped entirely for reduced motion. */
export function Confetti({ fire, amount = 170 }: { fire: number; amount?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!fire || !canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d")!;
    const w = (canvas.width = innerWidth);
    const h = (canvas.height = innerHeight);
    const bits = Array.from({ length: amount }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.2,
      y: h * 0.45,
      vx: (Math.random() - 0.5) * 22,
      vy: -Math.random() * 22 - 6,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      s: 8 + Math.random() * 12,
      c: COLOURS[Math.floor(Math.random() * COLOURS.length)],
    }));
    let t0 = 0;
    let raf = 0;
    const draw = (t: number) => {
      t0 ||= t;
      ctx.clearRect(0, 0, w, h);
      for (const b of bits) {
        b.vy += 0.45;
        b.vx *= 0.985;
        b.x += b.vx;
        b.y += b.vy;
        b.r += b.vr;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.r);
        ctx.scale(1, Math.abs(Math.cos(b.r * 2))); // flutter
        ctx.fillStyle = b.c;
        ctx.strokeStyle = "#172133";
        ctx.lineWidth = 1;
        ctx.fillRect(-b.s / 2, -b.s / 3, b.s, (b.s * 2) / 3);
        ctx.strokeRect(-b.s / 2, -b.s / 3, b.s, (b.s * 2) / 3);
        ctx.restore();
      }
      if (t - t0 < 3500) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, w, h);
    };
    // Wait for the winner's card to land before bursting.
    const start = setTimeout(() => (raf = requestAnimationFrame(draw)), 500);
    return () => {
      clearTimeout(start);
      cancelAnimationFrame(raf);
    };
  }, [fire]);

  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
