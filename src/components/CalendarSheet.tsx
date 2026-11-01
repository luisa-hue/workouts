import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonth, fromISO, toISO } from '../lib/dates';

interface Props {
  open: boolean;
  selected: string;
  today: string;
  /** Dates (YYYY-MM-DD) that have a workout for the active program. */
  marked: Set<string>;
  onSelect: (date: string) => void;
  onClose: () => void;
}

const HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function CalendarSheet({ open, selected, today, marked, onSelect, onClose }: Props) {
  const [view, setView] = useState(() => {
    const d = fromISO(selected);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  useEffect(() => {
    if (open) {
      const d = fromISO(selected);
      setView({ y: d.getFullYear(), m: d.getMonth() });
    }
  }, [open, selected]);

  const cells = useMemo(() => {
    const lead = (new Date(view.y, view.m, 1, 12).getDay() + 6) % 7; // Monday first
    const days = new Date(view.y, view.m + 1, 0, 12).getDate();
    const out: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= days; d++) out.push(toISO(new Date(view.y, view.m, d, 12)));
    return out;
  }, [view]);

  const step = (delta: number) =>
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1, 12);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <>
      <div className={open ? 'backdrop open' : 'backdrop'} onClick={onClose} />
      <div className={open ? 'sheet open' : 'sheet'} role="dialog" aria-modal="true" aria-hidden={!open} aria-label="Choose a date">
        <div className="sheet-grab" />
        <div className="cal-head">
          <button type="button" className="round-btn" onClick={() => step(-1)} aria-label="Previous month">
            <ChevronLeft size={20} />
          </button>
          <div className="cal-title">{formatMonth(view.y, view.m)}</div>
          <button type="button" className="round-btn" onClick={() => step(1)} aria-label="Next month">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="cal-grid">
          {HEADERS.map((h, i) => (
            <div key={i} className="cal-dow">
              {h}
            </div>
          ))}
          {cells.map((iso, i) =>
            iso ? (
              <button
                key={iso}
                type="button"
                className={[
                  'cal-day',
                  iso === selected ? 'selected' : '',
                  iso === today ? 'today' : '',
                  marked.has(iso) ? 'marked' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelect(iso)}
              >
                {Number(iso.slice(8))}
              </button>
            ) : (
              <div key={`b${i}`} />
            ),
          )}
        </div>
        <div className="cal-actions">
          <button type="button" className="link-btn" onClick={() => onSelect(today)}>
            Today
          </button>
          <button type="button" className="link-btn strong" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}
