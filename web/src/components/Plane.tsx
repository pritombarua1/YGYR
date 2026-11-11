/** The same plane as bare shapes, for moving around inside another SVG (120 × 66 units, scaled by `scale`). */
export function PlaneShape({ scale = 0.5 }: { scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <path d="M2 30 118 4 46 40Z" fill="#fbfcf9" stroke="#172133" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M46 40 118 4 60 62Z" fill="#dfe6ea" stroke="#172133" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M46 40 118 4" stroke="#d3362c" strokeWidth="3" />
    </g>
  );
}

// A folded dart, drawn side-on. Points to the right.
export function Plane({ className, size = 64 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size * 0.55} viewBox="0 0 120 66" aria-hidden="true">
      <path d="M2 30 118 4 46 40Z" fill="#fbfcf9" stroke="#172133" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M46 40 118 4 60 62Z" fill="#dfe6ea" stroke="#172133" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M46 40 118 4" stroke="#d3362c" strokeWidth="3" />
    </svg>
  );
}
