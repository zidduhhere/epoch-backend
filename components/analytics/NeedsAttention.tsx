'use client';

import { useState } from 'react';
import { AttentionItem, focusRing, money, plural } from './metrics';

const PREVIEW_COUNT = 3;

const linkClass = `inline-flex min-h-10 items-center gap-2 rounded-sm border border-line bg-surface px-3 py-1 text-left text-sm hover:border-ink cursor-pointer ${focusRing}`;

interface NeedsAttentionProps {
  items: AttentionItem[];
  onNavigateToClass: (classId: string) => void;
  onNavigateToBills?: () => void;
}

export function NeedsAttention({ items, onNavigateToClass, onNavigateToBills }: NeedsAttentionProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <section aria-labelledby="needs-attention-heading" className="border-t-2 border-ink pt-4">
      <h3 id="needs-attention-heading" className="text-xl font-semibold">
        Needs attention
      </h3>

      {items.length === 0 ? (
        <div className="mt-3">
          <p className="text-base font-medium">Nothing needs attention</p>
          <p className="mt-1 text-sm text-ink-2">
            All money has reached the treasurer, no expenses are waiting, and no class has money still due.
          </p>
        </div>
      ) : (
        <ul className="mt-1 divide-y divide-line">
          {items.map((item) => {
            const isExpanded = expanded[item.key];
            const visibleLinks = isExpanded ? item.links : item.links.slice(0, PREVIEW_COUNT);
            const canExpand = item.links.length > PREVIEW_COUNT;

            return (
              <li
                key={item.key}
                className="grid gap-x-8 gap-y-1 py-5 sm:grid-cols-[11rem_minmax(0,1fr)]"
              >
                <p className="text-3xl font-semibold leading-tight tabular-nums text-alert">
                  {money(item.amount)}
                </p>
                <div className="min-w-0">
                  <h4 className="text-base font-semibold">{item.title}</h4>
                  <p className="mt-0.5 text-sm text-ink-2">{item.detail}</p>

                  {(visibleLinks.length > 0 || (item.opensBills && onNavigateToBills)) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {item.opensBills && onNavigateToBills && (
                        <button type="button" onClick={onNavigateToBills} className={linkClass}>
                          <span className="font-medium">Review expenses</span>
                        </button>
                      )}
                      {visibleLinks.map((link) => (
                        <button
                          key={link.classId}
                          type="button"
                          onClick={() => onNavigateToClass(link.classId)}
                          aria-label={`Open ${link.label}, ${link.amountLabel}`}
                          className={linkClass}
                        >
                          <span className="font-medium">{link.label}</span>
                          <span className="tabular-nums text-ink-2">{link.amountLabel}</span>
                        </button>
                      ))}
                      {canExpand && (
                        <button
                          type="button"
                          aria-expanded={Boolean(isExpanded)}
                          onClick={() => setExpanded((prev) => ({ ...prev, [item.key]: !isExpanded }))}
                          className={`min-h-10 cursor-pointer rounded-sm px-2 text-sm text-ink-2 underline underline-offset-2 hover:text-ink ${focusRing}`}
                        >
                          {isExpanded ? 'Show fewer' : `Show all ${plural(item.links.length, 'class', 'classes')}`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
