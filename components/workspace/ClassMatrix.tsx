'use client';

import { DEPARTMENTS, YEARS } from '@/lib/departments';
import type { ClassInfo } from '@/lib/types';

export type ClassStats = { students: number; target: number; collected: number; paidInFull: number };

/** Every class in the college as one department by year grid. */
export function ClassMatrix({
  classes,
  stats,
  activeId,
  onSelect,
}: {
  classes: ClassInfo[];
  stats: Map<string, ClassStats>;
  activeId: string;
  onSelect: (classId: string) => void;
}) {
  const byCell = new Map(classes.map((c) => [`${c.branch}-${c.year}`, c]));

  return (
    <div className="grid grid-cols-[3.5rem_repeat(4,minmax(0,1fr))] gap-1 text-sm">
      <span className="text-xs text-ink-2">Year</span>
      {YEARS.map((year) => (
        <span key={year} className="text-center text-xs text-ink-2">
          {year}
        </span>
      ))}

      {DEPARTMENTS.map((department) => (
        <div key={department} className="contents">
          <span className="flex items-center font-medium">{department}</span>
          {YEARS.map((year) => {
            const cls = byCell.get(`${department}-${year}`);
            if (!cls) return <span key={year} aria-hidden />;

            const stat = stats.get(cls.id);
            const percent = stat && stat.target > 0 ? Math.floor((stat.collected / stat.target) * 100) : null;
            const active = cls.id === activeId;

            return (
              <button
                key={year}
                onClick={() => onSelect(cls.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={`${cls.name}, ${percent === null ? 'no fees expected yet' : `${percent}% collected`}`}
                className={`relative h-10 overflow-hidden rounded-sm tabular-nums ${
                  active ? 'on-ink bg-ink text-white' : 'bg-canvas text-ink hover:bg-line'
                }`}
              >
                {percent === null ? <span className={active ? '' : 'text-ink-3'}>–</span> : percent}
                {percent !== null && !active && (
                  <span className="absolute bottom-0 left-0 h-[3px] bg-ink" style={{ width: `${percent}%` }} aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
