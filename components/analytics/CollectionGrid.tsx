'use client';

import { useMemo, useRef, useState } from 'react';
import type { FocusEvent, PointerEvent } from 'react';
import { departmentHasYear } from '../../lib/departments';
import { ClassStats, Totals, focusRing, money, percentOf, plural, rollUp } from './metrics';

const TOOLTIP_WIDTH = 248;

interface CollectionGridProps {
  stats: ClassStats[];
  departments: string[];
  years: number[];
  behindIds: Set<string>;
  onNavigateToClass: (classId: string) => void;
}

interface Slot extends Totals {
  id: string;
  label: string;
  coordinators: string;
  isBehind: boolean;
}

interface Tip {
  slot: Slot;
  left: number;
  top: number;
}

function HeaderPercent({ totals }: { totals: Totals | undefined }) {
  const percent = totals ? percentOf(totals.collected, totals.target) : null;
  if (percent === null) return null;
  return <span className="block text-sm font-normal tabular-nums text-ink-2">{percent}%</span>;
}

function describeSlot(slot: Slot): string {
  if (slot.studentCount === 0) return `${slot.label}, no students. Open class.`;
  return `${slot.label}, ${percentOf(slot.collected, slot.target) ?? 0}% collected, ${money(
    slot.collected,
  )} of ${money(slot.target)}, ${money(slot.outstanding)} still due${
    slot.isBehind ? ', among the classes furthest behind' : ''
  }. Open class.`;
}

export function CollectionGrid({ stats, departments, years, behindIds, onNavigateToClass }: CollectionGridProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const { slots, departmentTotals, yearTotals } = useMemo(() => {
    const grouped = new Map<string, ClassStats[]>();
    stats.forEach((row) => {
      const key = `${row.cls.branch}|${row.cls.year}`;
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    });

    const slots = new Map<string, Slot>();
    grouped.forEach((rows, key) => {
      const [first] = rows;
      slots.set(key, {
        ...rollUp(rows),
        id: first.cls.id,
        label: `${first.cls.branch} Year ${first.cls.year}`,
        coordinators: [first.cls.coordinator_1_name, first.cls.coordinator_2_name].filter(Boolean).join(' and '),
        isBehind: rows.some((row) => behindIds.has(row.cls.id)),
      });
    });

    const totalsBy = (match: (row: ClassStats) => string | number) => {
      const groups = new Map<string | number, ClassStats[]>();
      stats.forEach((row) => groups.set(match(row), [...(groups.get(match(row)) ?? []), row]));
      return new Map(Array.from(groups, ([key, rows]) => [key, rollUp(rows)]));
    };

    return {
      slots,
      departmentTotals: totalsBy((row) => row.cls.branch),
      yearTotals: totalsBy((row) => row.cls.year),
    };
  }, [stats, behindIds]);

  const showTip = (slot: Slot, element: HTMLElement) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const box = wrapper.getBoundingClientRect();
    const cell = element.getBoundingClientRect();
    const left = Math.max(0, Math.min(cell.left - box.left, box.width - TOOLTIP_WIDTH));
    setTip({ slot, left, top: cell.top - box.top });
  };

  const handlePointerEnter = (slot: Slot) => (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse') showTip(slot, event.currentTarget);
  };

  const handleFocus = (slot: Slot) => (event: FocusEvent<HTMLButtonElement>) => {
    if (event.currentTarget.matches(':focus-visible')) showTip(slot, event.currentTarget);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">
          Share of the target collected for each department and year. Select a class to open it.
        </caption>
        <thead>
          <tr>
            <td className="w-14 sm:w-24" />
            {years.map((year) => (
              <th key={year} scope="col" className="px-1.5 pb-2 text-left align-bottom text-sm font-medium sm:px-3">
                Year {year}
                <HeaderPercent totals={yearTotals.get(year)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {departments.map((department) => (
            <tr key={department} className="border-t border-line">
              <th scope="row" className="pr-1 text-left align-middle text-sm font-semibold">
                {department}
                <HeaderPercent totals={departmentTotals.get(department)} />
              </th>
              {years.map((year) => {
                const slot = slots.get(`${department}|${year}`);

                if (!departmentHasYear(department, year) || !slot) {
                  return (
                    <td key={year} className="border-l border-line px-1.5 text-xs text-ink-2 sm:px-3 sm:text-sm">
                      {departmentHasYear(department, year) ? 'No class' : 'Not applicable'}
                    </td>
                  );
                }

                const percent = percentOf(slot.collected, slot.target);
                const hasStudents = slot.studentCount > 0;

                return (
                  <td key={year} className="border-l border-line p-0">
                    <button
                      type="button"
                      aria-label={describeSlot(slot)}
                      onClick={() => onNavigateToClass(slot.id)}
                      onPointerEnter={handlePointerEnter(slot)}
                      onPointerLeave={() => setTip(null)}
                      onFocus={handleFocus(slot)}
                      onBlur={() => setTip(null)}
                      onKeyDown={(event) => event.key === 'Escape' && setTip(null)}
                      className={`relative block h-16 w-full cursor-pointer bg-surface px-1.5 py-1.5 text-left align-top hover:bg-canvas focus-visible:-outline-offset-2 sm:h-[4.5rem] sm:px-3 ${focusRing}`}
                    >
                      {!hasStudents ? (
                        <span className="block text-sm leading-tight text-ink-2">No students</span>
                      ) : (
                        <>
                          <span
                            className={`block text-base font-semibold leading-tight tabular-nums ${
                              slot.isBehind ? 'text-alert' : ''
                            }`}
                          >
                            {percent === null ? 'Nothing due' : `${percent}%`}
                          </span>
                          <span className="block text-xs leading-tight tabular-nums text-ink-2 sm:text-sm">
                            {slot.outstanding > 0 ? (
                              <>
                                {money(slot.outstanding)}
                                <span className="hidden sm:inline"> due</span>
                              </>
                            ) : (
                              'All paid'
                            )}
                          </span>
                          <span aria-hidden className="absolute inset-x-1.5 bottom-1.5 h-1 bg-line sm:inset-x-3">
                            <span
                              className={`block h-full ${slot.isBehind ? 'bg-alert' : 'bg-ink'}`}
                              style={{ width: `${Math.min(percent ?? 0, 100)}%` }}
                            />
                          </span>
                        </>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {tip && (
        <div
          aria-hidden
          style={{ left: tip.left, top: tip.top - 4, width: TOOLTIP_WIDTH }}
          className="pointer-events-none absolute z-10 -translate-y-full rounded-sm border border-ink bg-surface px-3 py-2"
        >
          {tip.slot.studentCount > 0 ? (
            <p className="text-sm font-semibold tabular-nums">
              {money(tip.slot.collected)} of {money(tip.slot.target)}
            </p>
          ) : (
            <p className="text-sm font-semibold">No students</p>
          )}
          <p className="text-sm text-ink-2">{tip.slot.label}</p>
          {tip.slot.studentCount > 0 && (
            <p className="text-sm text-ink-2">
              {plural(tip.slot.studentCount, 'student')}, {tip.slot.unpaidStudentCount} yet to pay in full
            </p>
          )}
          {tip.slot.coordinators && <p className="text-sm text-ink-2">{tip.slot.coordinators}</p>}
        </div>
      )}
    </div>
  );
}
