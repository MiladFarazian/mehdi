// Dependency-free charts (plain CSS/flex). Safe in client components.

function prettyCategory(s: string): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="muted">No data yet.</p>;
  return (
    <div className="barlist">
      {items.map((i) => (
        <div className="barrow" key={i.label}>
          <span className="barlabel" title={prettyCategory(i.label)}>{prettyCategory(i.label)}</span>
          <span className="bartrack">
            <span className="barfill" style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          <span className="barval">${i.value.toFixed(0)}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendBars({ data }: { data: { month: string; spend: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.spend));
  if (!data.length) return <p className="muted">Not enough history yet.</p>;
  return (
    <div className="trend">
      {data.map((d) => (
        <div className="trendcol" key={d.month}>
          <span className="trendval">${Math.round(d.spend)}</span>
          <div className="trendbarwrap">
            <div
              className="trendbar"
              style={{ height: `${Math.max(2, (d.spend / max) * 100)}%` }}
              title={`${d.month}: $${d.spend.toFixed(0)}`}
            />
          </div>
          <span className="trendlabel">{d.month.slice(5)}/{d.month.slice(2, 4)}</span>
        </div>
      ))}
    </div>
  );
}
