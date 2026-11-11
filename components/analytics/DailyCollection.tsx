'use client';

import { useEffect, useRef } from 'react';
import { compactMoney, dayLabel, money, percentOf, plural, type DayRow } from './metrics';

const BAR_SLOT = 52;
const BAR_WIDTH = 30;
const CHART_HEIGHT = 230;
const TOP = 26;
const BOTTOM = 28;

/** A round upper bound above the tallest bar, so labels never touch the top. */
function ceilingFor(max: number) {
  if (max <= 0) return 1000;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((value) => value >= max * 1.05);
  return step ?? magnitude * 10;
}

/** Money collected on each day, with the value printed on every bar and the full detail underneath. */
export function DailyCollection({ rows, target }: { rows: DayRow[]; target: number }) {
  const scroller = useRef<HTMLDivElement>(null);

  // Open on the latest days.
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [rows.length]);

  if (rows.length === 0) {
    return <p className="text-sm text-ink-2">No payments recorded yet, so there is nothing to chart.</p>;
  }

  const peak = Math.max(...rows.map((row) => row.total));
  const ceiling = ceilingFor(peak);
  const plotHeight = CHART_HEIGHT - TOP - BOTTOM;
  const width = Math.max(rows.length * BAR_SLOT, 320);
  const yFor = (value: number) => TOP + plotHeight - (value / ceiling) * plotHeight;
  const last = rows[rows.length - 1];
  const best = rows.reduce((top, row) => (row.total > top.total ? row : top), rows[0]);
  const activeDays = rows.filter((row) => row.total > 0).length;

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-2 text-sm text-ink-2">
          Best day {dayLabel(best.date)} with {money(best.total)}. Averaging{' '}
          {money(last.cumulative / Math.max(activeDays, 1))} on the {plural(activeDays, 'day')} with payments.
        </p>

        <div ref={scroller} className="overflow-x-auto border border-line bg-surface p-2" tabIndex={0} role="group" aria-label="Money collected each day">
          <svg width={width} height={CHART_HEIGHT} viewBox={`0 0 ${width} ${CHART_HEIGHT}`} className="block">
            {[0, 0.5, 1].map((fraction) => (
              <line
                key={fraction}
                x1={0}
                x2={width}
                y1={yFor(ceiling * fraction)}
                y2={yFor(ceiling * fraction)}
                className="stroke-line"
                strokeWidth={1}
              />
            ))}

            {rows.map((row, index) => {
              const x = index * BAR_SLOT + (BAR_SLOT - BAR_WIDTH) / 2;
              const upiHeight = (row.upi / ceiling) * plotHeight;
              const cashHeight = (row.cash / ceiling) * plotHeight;
              const base = TOP + plotHeight;
              const detail = `${dayLabel(row.date, true)}: ${money(row.total)} from ${plural(row.count, 'payment')} (UPI ${money(row.upi)}, cash ${money(row.cash)})`;
              return (
                <g key={row.date} role="img" aria-label={detail}>
                  <title>{detail}</title>
                  {row.upi > 0 && <rect x={x} y={base - upiHeight} width={BAR_WIDTH} height={upiHeight} className="fill-ink" />}
                  {row.cash > 0 && (
                    <rect x={x} y={base - upiHeight - cashHeight} width={BAR_WIDTH} height={cashHeight} className="fill-ink-3" />
                  )}
                  {row.total === 0 && <rect x={x} y={base - 2} width={BAR_WIDTH} height={2} className="fill-line" />}
                  <text
                    x={x + BAR_WIDTH / 2}
                    y={base - upiHeight - cashHeight - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    className="fill-ink tabular-nums"
                  >
                    {row.total > 0 ? compactMoney(row.total) : '0'}
                  </text>
                  <text x={x + BAR_WIDTH / 2} y={CHART_HEIGHT - 8} textAnchor="middle" fontSize={11} className="fill-ink-2">
                    {dayLabel(row.date)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 bg-ink" /> UPI
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 bg-ink-3" /> Cash
          </span>
        </p>
      </div>

      <RunningTotal rows={rows} target={target} />

      <div>
        <h4 className="mb-2 text-sm font-medium text-ink-2">Day by day details</h4>
        <div className="max-h-96 overflow-auto border border-line bg-surface">
          <table className="w-full min-w-[34rem] text-left text-sm tabular-nums">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line text-ink-2">
                <th className="px-3 py-2 font-medium">Day</th>
                <th className="px-3 py-2 text-right font-medium">Payments</th>
                <th className="px-3 py-2 text-right font-medium">UPI</th>
                <th className="px-3 py-2 text-right font-medium">Cash</th>
                <th className="px-3 py-2 text-right font-medium">Collected</th>
                <th className="px-3 py-2 text-right font-medium">Running total</th>
                <th className="px-3 py-2 text-right font-medium">Of target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...rows].reverse().map((row) => (
                <tr key={row.date} className={row.total === 0 ? 'text-ink-3' : ''}>
                  <td className="px-3 py-2">{dayLabel(row.date, true)}</td>
                  <td className="px-3 py-2 text-right">{row.count}</td>
                  <td className="px-3 py-2 text-right">{money(row.upi)}</td>
                  <td className="px-3 py-2 text-right">{money(row.cash)}</td>
                  <td className="px-3 py-2 text-right font-medium">{money(row.total)}</td>
                  <td className="px-3 py-2 text-right">{money(row.cumulative)}</td>
                  <td className="px-3 py-2 text-right">
                    {percentOf(row.cumulative, target) === null ? '—' : `${percentOf(row.cumulative, target)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Total collected so far, climbing towards the target line. */
function RunningTotal({ rows, target }: { rows: DayRow[]; target: number }) {
  const W = 640;
  const H = 220;
  const LEFT = 8;
  const RIGHT = 8;
  const TOP_PAD = 28;
  const BOTTOM_PAD = 26;
  const last = rows[rows.length - 1];
  const ceiling = Math.max(target, last.cumulative, 1);
  const x = (index: number) => (rows.length === 1 ? W / 2 : LEFT + (index / (rows.length - 1)) * (W - LEFT - RIGHT));
  const y = (value: number) => TOP_PAD + (1 - value / ceiling) * (H - TOP_PAD - BOTTOM_PAD);
  const points = rows.map((row, index) => `${x(index).toFixed(1)},${y(row.cumulative).toFixed(1)}`).join(' ');
  const percent = percentOf(last.cumulative, target);

  return (
    <div>
      <h4 className="mb-2 text-sm font-medium text-ink-2">
        Running total against the target
        {percent !== null && `: ${money(last.cumulative)} of ${money(target)} (${percent}%)`}
      </h4>
      <div className="border border-line bg-surface p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`Running total ${money(last.cumulative)} of ${money(target)} target`}>
          {target > 0 && (
            <>
              <line x1={LEFT} x2={W - RIGHT} y1={y(target)} y2={y(target)} className="stroke-ink" strokeDasharray="5 4" strokeWidth={1.5} />
              <text x={W - RIGHT} y={y(target) - 6} textAnchor="end" fontSize={12} fontWeight={600} className="fill-ink tabular-nums">
                Target {money(target)}
              </text>
            </>
          )}
          <polyline points={points} fill="none" strokeWidth={2.5} strokeLinejoin="round" className="stroke-ink" />
          {rows.length <= 31 &&
            rows.map((row, index) => (
              <circle key={row.date} cx={x(index)} cy={y(row.cumulative)} r={3} className="fill-ink">
                <title>{`${dayLabel(row.date, true)}: ${money(row.cumulative)} collected so far`}</title>
              </circle>
            ))}
          <text
            x={x(rows.length - 1)}
            y={y(last.cumulative) + (last.cumulative > ceiling * 0.85 ? 18 : -10)}
            textAnchor={rows.length === 1 ? 'middle' : 'end'}
            fontSize={12}
            fontWeight={600}
            className="fill-ink tabular-nums"
          >
            {money(last.cumulative)}
          </text>
          <text x={LEFT} y={H - 6} fontSize={11} className="fill-ink-2">
            {dayLabel(rows[0].date)}
          </text>
          <text x={W - RIGHT} y={H - 6} textAnchor="end" fontSize={11} className="fill-ink-2">
            {dayLabel(last.date)}
          </text>
        </svg>
      </div>
    </div>
  );
}
