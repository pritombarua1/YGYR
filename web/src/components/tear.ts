// Torn-paper edges for transitions, as CSS clip-path polygons (in %).

type Pt = [number, number];

const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};

// Small, fixed wobble so the edge looks torn, not cut (same every time).
const jag = (i: number) => [0.7, -0.5, 0.9, -0.8, 0.4, -0.6, 0.8, -0.3][i % 8];

const poly = (pts: Pt[]) => `polygon(${pts.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(", ")})`;

/**
 * The round intro's white flight line ("M-40 470 C 220 300, 420 520, 620 330 S 900 120, 1060 90"
 * in a 1000 × 600 box), as a jagged line in % so the screen can tear exactly along it.
 */
const FLIGHT_LINE: Pt[] = (() => {
  const a: Pt[] = [[-40, 470], [220, 300], [420, 520], [620, 330]];
  const b: Pt[] = [[620, 330], [820, 140], [900, 120], [1060, 90]];
  const pts: Pt[] = [];
  for (const [p0, p1, p2, p3] of [a, b]) for (let i = 0; i <= 14; i++) pts.push(cubic(p0, p1, p2, p3, i / 14));
  return pts.map(([x, y], i) => [x / 10, y / 6 + jag(i)]);
})();

/** Top and bottom pieces of the screen torn along the flight line. `grow` widens the piece (for the white paper edge). */
export function flightTear(grow = 0) {
  const line = FLIGHT_LINE;
  const top: Pt[] = [[-10, -10], [110, -10], ...[...line].reverse().map(([x, y]) => [x, y + grow] as Pt)];
  const bottom: Pt[] = [...line.map(([x, y]) => [x, y - grow] as Pt), [110, 110], [-10, 110]];
  return { top: poly(top), bottom: poly(bottom) };
}

/** Left and right pieces of a sheet torn roughly down the middle. */
export function pageTear(grow = 0) {
  const line: Pt[] = Array.from({ length: 16 }, (_, i) => [50 + jag(i) * 3 + (i % 3) - 1, (i / 15) * 100]);
  const left: Pt[] = [[-5, -5], ...line.map(([x, y]) => [x + grow, y] as Pt), [-5, 105]];
  const right: Pt[] = [...line.map(([x, y]) => [x - grow, y] as Pt), [105, 105], [105, -5]];
  return { left: poly(left), right: poly(right) };
}
