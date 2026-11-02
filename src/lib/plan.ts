// Gym plans: a rotation of workouts (A, B, C, ...) read from the coach's spreadsheet.
// No dates in the plan itself: the user picks a start date and which weekdays are rest days,
// and the workouts follow in order on every training day.

export interface PlanItem {
  /** 'exercise' has sets to log; 'note' is a warm-up, stretch or cardio line. */
  kind: 'exercise' | 'note';
  name: string;
  sets: number | null;
  /** Target reps as written by the coach: "10", "15/12/10/8", "10 a 12". Empty when none. */
  reps: string;
}

export interface PlanDay {
  /** "A", "B", ... */
  label: string;
  /** Extra text from the heading, e.g. "CORRIDA" for "TREINO B(CORRIDA)". */
  tag: string | null;
  items: PlanItem[];
}

export interface Plan {
  id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  months: number;
  /** Weekdays without training, 0 = Sunday ... 6 = Saturday. */
  rest_days: number[];
  days: PlanDay[];
}

export interface SetLog {
  id: string;
  plan_id: string;
  date: string;
  day_index: number;
  item_index: number;
  set_index: number;
  /** exerciseKey(name), so "last time" works across plans. */
  exercise: string;
  weight_kg: number | null;
  reps: number | null;
}

// ---------------------------------------------------------------------------
// Dates (UTC day numbers, so no timezone or DST surprises)
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

export function dayNum(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function fromDayNum(n: number): string {
  const d = new Date(n * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(iso: string): number {
  return (((dayNum(iso) + 4) % 7) + 7) % 7;
}

export function addDays(iso: string, n: number): string {
  return fromDayNum(dayNum(iso) + n);
}

/** Jan 31 + 1 month = Feb 28 (or 29). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const dim = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, dim))}`;
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

/** Weekdays used for N workouts per week, when the user has not chosen yet. */
const SUGGESTED_TRAINING_DAYS: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/** Rest days that fit `workouts` workouts per week (Monday first). */
export function suggestRestDays(workouts: number): number[] {
  const n = Math.min(7, Math.max(1, Math.round(workouts)));
  const train = new Set(SUGGESTED_TRAINING_DAYS[n]);
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => !train.has(d));
}

export function trainingDaysPerWeek(restDays: number[]): number {
  return 7 - new Set(restDays).size;
}

export function isTrainingDay(plan: Pick<Plan, 'start_date' | 'rest_days'>, iso: string): boolean {
  return iso >= plan.start_date && !plan.rest_days.includes(weekdayOf(iso));
}

/** Index into plan.days for this date, or null on rest days and before the start. */
export function workoutIndex(plan: Pick<Plan, 'start_date' | 'rest_days' | 'days'>, iso: string): number | null {
  if (plan.days.length === 0 || !isTrainingDay(plan, iso)) return null;
  const perWeek = trainingDaysPerWeek(plan.rest_days);
  if (perWeek === 0) return null;
  const diff = dayNum(iso) - dayNum(plan.start_date);
  const full = Math.floor(diff / 7);
  const rem = diff % 7;
  const startDay = weekdayOf(plan.start_date);
  let count = full * perWeek;
  for (let i = 0; i < rem; i++) if (!plan.rest_days.includes((startDay + i) % 7)) count++;
  return count % plan.days.length;
}

export function previousTrainingDate(plan: Pick<Plan, 'start_date' | 'rest_days'>, iso: string): string | null {
  for (let i = 1; i <= 14; i++) {
    const d = addDays(iso, -i);
    if (d < plan.start_date) return null;
    if (isTrainingDay(plan, d)) return d;
  }
  return null;
}

export function nextTrainingDate(plan: Pick<Plan, 'start_date' | 'rest_days'>, iso: string): string | null {
  const from = iso < plan.start_date ? addDays(plan.start_date, -1) : iso;
  for (let i = 1; i <= 14; i++) {
    const d = addDays(from, i);
    if (isTrainingDay(plan, d)) return d;
  }
  return null;
}

/** Last day of the plan: start + months, minus one day. */
export function planEnd(plan: Pick<Plan, 'start_date' | 'months'>): string {
  return addDays(addMonths(plan.start_date, plan.months), -1);
}

export type PlanStatus = 'active' | 'last-month' | 'ended';

/** 'last-month' from one month before the end date, 'ended' after it. */
export function planStatus(plan: Pick<Plan, 'start_date' | 'months'>, today: string): PlanStatus {
  const end = planEnd(plan);
  if (today > end) return 'ended';
  if (today >= addMonths(end, -1)) return 'last-month';
  return 'active';
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

const SMALL_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'na', 'no', 'nas', 'nos', 'e', 'ou', 'a', 'o', 'com', 'em', 'para', 'por', 'sobre']);

/** "AGACHAMENTO BARRA LIVRE" -> "Agachamento Barra Livre". Words that already have lowercase letters are kept. */
export function prettyName(raw: string): string {
  const words = raw.replace(/\(/g, ' (').trim().replace(/\s+/g, ' ').split(' ');
  return words
    .map((w, i) => {
      if (/[a-z\u00e0-\u00ff]/.test(w)) return w; // already mixed or lowercase
      const lower = w.toLowerCase();
      if (/^\d/.test(lower)) return lower;
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return lower.replace(/[a-z\u00e0-\u00ff]/, (c) => c.toUpperCase());
    })
    .join(' ');
}

/** Same exercise written slightly differently (case, accents, "(anilhas)") gets the same key. */
export function exerciseKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Target reps for one set. "15/12/10/8" gives each set its own number; anything else applies to all sets. */
export function targetReps(reps: string, setIndex: number): string {
  const t = reps.trim();
  if (/^\d+(\s*\/\s*\d+)+$/.test(t)) {
    const parts = t.split('/').map((p) => p.trim());
    return parts[Math.min(setIndex, parts.length - 1)];
  }
  return t;
}

// ---------------------------------------------------------------------------
// Reading the coach's spreadsheet
// ---------------------------------------------------------------------------

// Any cell value from the spreadsheet reader; only text and numbers are used.
type Cell = unknown;

const HEADING = /^TREINO\s+([A-Z])(?![A-Za-z0-9À-ɏ])\s*(.*)$/i;
const BANNER = /^(CONSULTORIA|DATA DE IN)/i;

function text(v: Cell): string {
  if (v === null || v === undefined) return '';
  return String(v).trim().replace(/\s+/g, ' ');
}

function repsText(v: Cell): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)));
  return text(v);
}

export interface ParsedPlan {
  /** From "TREINO 18" in the sheet header, when present. */
  name: string | null;
  days: PlanDay[];
}

/**
 * Reads a plan laid out as blocks: a "TREINO A" heading with SÉRIE / REP. to its right,
 * then one exercise per row. Lines without a series count (warm-up, stretching) become notes.
 * A block ends at the next heading in its column, at the coach's header (repeated between
 * blocks) or after three empty rows.
 */
export function parsePlanRows(rows: readonly (readonly Cell[])[]): ParsedPlan {
  const at = (r: number, c: number): Cell => rows[r]?.[c];

  const headings: { r: number; c: number; label: string; tag: string | null }[] = [];
  let name: string | null = null;
  for (let r = 0; r < rows.length; r++) {
    const width = rows[r]?.length ?? 0;
    for (let c = 0; c < width; c++) {
      const t = text(at(r, c));
      if (!t) continue;
      const m = HEADING.exec(t);
      if (m) {
        const tag = m[2].replace(/^[\s(\-–:]+/, '').replace(/[\s)]+$/, '');
        headings.push({ r, c, label: m[1].toUpperCase(), tag: tag || null });
      } else if (!name && /DATA DE IN/i.test(t)) {
        const n = /TREINO\s+(\d+)/i.exec(t);
        if (n) name = `Treino ${n[1]}`;
      }
    }
  }
  if (headings.length === 0) throw new Error('No "TREINO A" style blocks found in this spreadsheet.');

  const headingAt = new Set(headings.map((h) => `${h.r},${h.c}`));
  const seen = new Set<string>();
  const days: PlanDay[] = [];

  for (const h of headings) {
    if (seen.has(h.label)) continue;
    seen.add(h.label);
    const found: { row: number; item: PlanItem }[] = [];
    let blank = 0;
    for (let r = h.r + 1; r < rows.length; r++) {
      if (headingAt.has(`${r},${h.c}`)) break;
      const nameCell = text(at(r, h.c));
      const setsCell = at(r, h.c + 1);
      const setsText = text(setsCell);
      const repsCell = repsText(at(r, h.c + 2));
      if (!nameCell && !setsText && !repsCell) {
        // Several empty rows in a row: the block is over (single empty rows are just spacing).
        if (++blank >= 3) break;
        continue;
      }
      blank = 0;
      if (BANNER.test(nameCell)) {
        // The coach's header repeats between blocks: its first line (the coach's name) sits right above.
        const last = found[found.length - 1];
        if (last && last.row === r - 1 && last.item.kind === 'note') found.pop();
        break;
      }
      if (!nameCell) continue;
      const n = Number(setsText.replace(',', '.'));
      const sets = setsText !== '' && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
      if (sets !== null || repsCell) found.push({ row: r, item: { kind: 'exercise', name: nameCell, sets: sets ?? 1, reps: repsCell } });
      else found.push({ row: r, item: { kind: 'note', name: nameCell, sets: null, reps: '' } });
    }
    const items = found.map((f) => f.item);
    if (items.some((i) => i.kind === 'exercise')) days.push({ label: h.label, tag: h.tag, items });
  }

  if (days.length === 0) throw new Error('Found the workout headings, but no exercises under them.');
  days.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
  return { name, days };
}
