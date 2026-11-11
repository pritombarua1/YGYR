export function Dots({ n, max = 3 }: { n: number | null; max?: number }) {
  return (
    <span className="dots" aria-label={n === null ? "not thrown yet" : `${n} of ${max} in`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`dot ${n !== null && i < n ? "in" : ""} ${n === null ? "todo" : ""}`} />
      ))}
    </span>
  );
}

export function Search({
  value,
  onChange,
  placeholder = "Search name or ID (e.g. 07)",
  label = "Search players by name or ID",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <input className="search" type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
  );
}
