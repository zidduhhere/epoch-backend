'use client';

import { useState } from 'react';
import { focusRing, money, shareOf } from './metrics';

const TONES = {
  strong: { swatch: 'bg-ink', slice: 'fill-ink', label: 'fill-surface' },
  medium: { swatch: 'bg-ink-2', slice: 'fill-ink-2', label: 'fill-surface' },
  quiet: { swatch: 'bg-ink-3', slice: 'fill-ink-3', label: 'fill-ink' },
  /** Money still to collect: the empty part of the target. */
  remaining: { swatch: 'bg-line', slice: 'fill-line', label: 'fill-ink' },
} as const;

const CENTER = 100;
const RADIUS = 92;
const PULL_OUT = 6;
const MIN_SHARE_FOR_LABEL = 0.08;

export interface PiePart {
  name: string;
  note?: string;
  amount: number;
  tone: keyof typeof TONES;
  /** Printed on the slice. Defaults to the percentage. */
  sliceLabel?: string;
}

const asMoney = (value: number) => money(value);

function pointAt(angle: number, radius: number) {
  return { x: CENTER + radius * Math.sin(angle), y: CENTER - radius * Math.cos(angle) };
}

function slicePath(start: number, end: number) {
  const from = pointAt(start, RADIUS);
  const to = pointAt(end, RADIUS);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)} Z`;
}

/** A pie with every amount printed in the list beside it, so no number depends on hover. */
export function PieChart({
  label,
  parts,
  formatValue = asMoney,
}: {
  label: string;
  parts: PiePart[];
  /** How each part's value is printed. Defaults to rupees; pass a count formatter for students. */
  formatValue?: (value: number) => string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = parts.reduce((sum, part) => sum + part.amount, 0);
  const visible = parts.filter((part) => part.amount > 0);
  const describe = (part: PiePart) => `${part.name}: ${formatValue(part.amount)}, ${shareOf(part.amount, total)}%`;

  const slices = visible.map((part, index) => {
    const before = visible.slice(0, index).reduce((sum, earlier) => sum + earlier.amount, 0);
    const start = (before / total) * 2 * Math.PI;
    const end = ((before + part.amount) / total) * 2 * Math.PI;
    return { part, start, end, middle: (start + end) / 2 };
  });

  const handlers = (name: string) => ({
    onPointerEnter: () => setActive(name),
    onPointerLeave: () => setActive(null),
    onFocus: () => setActive(name),
    onBlur: () => setActive(null),
  });

  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-4 @xl:flex-row @xl:items-start">
      <svg viewBox="0 0 200 200" role="group" aria-label={label} className="w-52 shrink-0 overflow-visible">
        {slices.map(({ part, start, end, middle }) => {
          const offset = active === part.name && slices.length > 1 ? pointAt(middle, PULL_OUT) : null;
          const transform = offset ? `translate(${offset.x - CENTER} ${offset.y - CENTER})` : undefined;
          const common = {
            ...handlers(part.name),
            role: 'img',
            tabIndex: 0,
            'aria-label': describe(part),
            transform,
            className: `${TONES[part.tone].slice} stroke-surface ${focusRing}`,
            strokeWidth: 2,
          };
          return slices.length === 1 ? (
            <circle key={part.name} {...common} cx={CENTER} cy={CENTER} r={RADIUS}>
              <title>{describe(part)}</title>
            </circle>
          ) : (
            <path key={part.name} {...common} d={slicePath(start, end)}>
              <title>{describe(part)}</title>
            </path>
          );
        })}

        {slices.map(({ part, start, end, middle }) => {
          if ((end - start) / (2 * Math.PI) < MIN_SHARE_FOR_LABEL) return null;
          const at = slices.length === 1 ? { x: CENTER, y: CENTER } : pointAt(middle, RADIUS * 0.68);
          return (
            <text
              key={part.name}
              x={at.x}
              y={at.y}
              aria-hidden
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={12}
              fontWeight={600}
              className={`pointer-events-none tabular-nums ${TONES[part.tone].label}`}
            >
              {part.sliceLabel ?? `${shareOf(part.amount, total)}%`}
            </text>
          );
        })}
      </svg>

      <ul className="w-full min-w-0 flex-1">
        {parts.map((part) => (
          <li
            key={part.name}
            onPointerEnter={() => setActive(part.name)}
            onPointerLeave={() => setActive(null)}
            className={`flex items-start gap-2.5 rounded-sm px-1 py-1.5 ${active === part.name ? 'bg-line' : ''}`}
          >
            <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-xs ${TONES[part.tone].swatch}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{part.name}</span>
              {part.note && <span className="block text-sm text-ink-2">{part.note}</span>}
            </span>
            <span className="shrink-0 text-right text-sm tabular-nums">
              <span className="font-semibold">{formatValue(part.amount)}</span>
              <span className="ml-2 inline-block w-9 text-ink-2">{shareOf(part.amount, total)}%</span>
            </span>
          </li>
        ))}
      </ul>
      </div>
    </div>
  );
}
