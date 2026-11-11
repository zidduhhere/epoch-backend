import { money, percentOf, Totals } from './metrics';

export interface BarRow {
  name: string;
  totals: Totals;
}

/** Collected against target for each group. Values are printed, so nothing relies on hover. */
export function BarChart({ label, rows }: { label: string; rows: BarRow[] }) {
  return (
    <div>
      <h4 className="mb-1 text-sm font-medium text-ink-2">{label}</h4>
      <ul>
        {rows.map(({ name, totals }) => {
          const percent = percentOf(totals.collected, totals.target);
          const summary =
            percent === null
              ? `${name}: no students`
              : `${name}: ${percent}%, ${money(totals.collected)} of ${money(totals.target)}`;
          return (
            <li key={name} title={summary} className="py-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{name}</span>
                {percent === null ? (
                  <span className="text-ink-2">No students</span>
                ) : (
                  <span className="tabular-nums">
                    <span className="font-semibold">{percent}%</span>
                    <span className="ml-2 text-ink-2">
                      {money(totals.collected)} of {money(totals.target)}
                    </span>
                  </span>
                )}
              </div>
              <div aria-hidden className="mt-1 h-2 bg-line">
                <div className="h-full bg-ink" style={{ width: `${Math.min(percent ?? 0, 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
