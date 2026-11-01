import { buildMatcher, annotate, readReps } from '../src/lib/lifts.ts';
import { buildStats, estimateOneRM, rmPercent } from '../src/lib/rm.ts';
import { unmatchedNames } from '../src/lib/names.ts';
import { DEFAULT_LIFTS } from '../src/lib/defaultLifts.ts';

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log('FAIL', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); }
};

// RM maths
eq('pct5', rmPercent(5), 89);
eq('est 5x80', Math.round(estimateOneRM(80, 5)! * 10) / 10, 89.9);
eq('pct0', rmPercent(0), null);
eq('pct31', rmPercent(31), null);

const lifts = DEFAULT_LIFTS.map((l, i) => ({ id: 'l' + i, name: l.name, aliases: l.aliases }));
const id = (n: string) => lifts.find((l) => l.name === n)!.id;
const m = buildMatcher(lifts);
const rec = (lift: string, reps: number, kg: number, date = '2026-01-01') => ({ id: Math.random() + '', lift_id: id(lift), reps, weight_kg: kg, date, note: null });
const stats = new Map([
  [id('Power Clean'), buildStats([rec('Power Clean', 1, 90, '2026-02-01'), rec('Power Clean', 5, 75)])],
  [id('Back Squat'), buildStats([rec('Back Squat', 5, 100)])],
  [id('Push Press'), buildStats([rec('Push Press', 3, 70)])],
]);
const statsOf = (x: string) => stats.get(x);
const render = (line: string) => annotate(line, m, statsOf).map((s) => (s.kind === 'text' ? s.text : `[${s.text}${s.estimated ? '~' : ''}]`)).join('');

// matcher
eq('match plural+case', m.find('10 THRUSTERS').length, 1);
eq('c&j vs clean', m.find('3 Clean & Jerk').map((x) => x.liftId), [id('Clean and Jerk')]);
eq('c and j', m.find('Clean and Jerk').map((x) => x.liftId), [id('Clean and Jerk')]);
eq('C&J', m.find('3 C&J').map((x) => x.liftId), [id('Clean and Jerk')]);
eq('hang power clean -> power clean', m.find('3 Hang Power Clean').map((x) => x.liftId), [id('Power Clean')]);
eq('power snatch beats snatch', m.find('2 Power Snatch').map((x) => x.liftId), [id('Power Snatch')]);
eq('snatch alone', m.find('2 Snatch').map((x) => x.liftId), [id('Squat Snatch')]);
eq('two lifts', m.find('1 Power Clean + 2 Front Squat').map((x) => x.liftId), [id('Power Clean'), id('Front Squat')]);
eq('push-press hyphen', m.find('5 Push-Press').length, 1);
eq('no false pos', m.find('21 Wall Balls').length, 0);
eq('press words', m.find('Push Presses').map((x) => x.liftId), [id('Push Press')]);
eq('not inside word', m.find('Cleanse').length, 0);

// reps
eq('reps lead', readReps('5 ', ' (60kg)'), 5);
eq('reps rounds prefix', readReps('3 Rounds: 5 ', ''), 5);
eq('reps 5x3', readReps('5x3 ', ''), 3);
eq('reps after 5x5', readReps('', ' 5x5 @75%'), 5);
eq('reps seq', readReps('5-3-1 ', ''), 5);
eq('reps 3RM', readReps('Build to a 3RM ', ''), 3);
eq('reps none', readReps('', ' @75%'), null);
eq('reps pct not reps', readReps('', ' 75%'), null);
eq('reps after plain', readReps('', ': 3 reps'), 3);

// annotate
eq('tested 1RM', render('1 Power Clean'), '1 Power Clean[1RM 90kg]');
eq('tested 5RM', render('5 Power Clean'), '5 Power Clean[5RM 75kg]');
eq('est 3RM', render('3 Power Clean'), '3 Power Clean[3RM 85kg~]');
eq('no reps -> 1RM', render('Power Clean'), 'Power Clean[1RM 90kg]');
eq('pct', render('Back Squat @75%'), 'Back Squat @75%[85kg~]');
eq('pct tested base', render('Power Clean @75%'), 'Power Clean @75%[67.5kg]');
eq('pct range', render('Back Squat 70-80%'), 'Back Squat 70-80%[77.5–90kg~]');
eq('pct of 3RM', render('Back Squat 5x3 @80% of 3RM'), 'Back Squat 5x3 @80% of 3RM[85kg~]');
eq('no data lift untouched', render('5 Front Squat'), '5 Front Squat');
eq('conditioning skipped', render('21-15-9 Push Press'), '21-15-9 Push Press');
eq('3 rounds', render('3 Rounds: 5 Power Clean'), '3 Rounds: 5 Power Clean[5RM 75kg]');
eq('plain text', render('Rest 2 min'), 'Rest 2 min');
eq('two lifts line', render('1 Power Clean + 3 Push Press'), '1 Power Clean[1RM 90kg] + 3 Push Press[3RM 70kg]');

// scan
eq('scan chunk', unmatchedNames('5 Zercher Squat @70%', m), ['Zercher Squat']);
eq('scan colon', unmatchedNames('Strength: 5x5 Zercher Squat', m), ['Zercher Squat']);
eq('scan matched line skipped', unmatchedNames('5 Back Squat', m), []);
eq('scan plus', unmatchedNames('1 Back Squat + 3 Landmine Press', m), ['Landmine Press']);
eq('scan noise', unmatchedNames('3 Rounds', m), []);
eq('scan no digits', unmatchedNames('Warm up with the barbell', m), []);
eq('scan pullups', unmatchedNames('10 Pull-ups', m), ['Pull-ups']);

console.log(fail === 0 ? 'ALL PASS' : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
