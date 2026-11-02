import {
  addDays, addMonths, exerciseKey, isTrainingDay, nextTrainingDate, parsePlanRows, planEnd, planStatus,
  prettyName, previousTrainingDate, suggestRestDays, targetReps, trainingDaysPerWeek, weekdayOf, workoutIndex,
} from '../src/lib/plan.ts';

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log('FAIL', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); }
};

// ---- dates
eq('weekday mon', weekdayOf('2026-11-02'), 1);
eq('weekday sun', weekdayOf('2026-11-01'), 0);
eq('weekday epoch', weekdayOf('1970-01-01'), 4);
eq('add days', addDays('2026-12-30', 3), '2027-01-02');
eq('add months', addMonths('2026-07-15', 3), '2026-10-15');
eq('add months clamp', addMonths('2026-01-31', 1), '2026-02-28');
eq('add months leap', addMonths('2028-01-31', 1), '2028-02-29');
eq('add months year', addMonths('2026-11-02', 3), '2027-02-02');
eq('add months back', addMonths('2027-01-14', -1), '2026-12-14');
eq('end', planEnd({ start_date: '2026-11-02', months: 3 }), '2027-02-01');
eq('end 1 month', planEnd({ start_date: '2026-11-02', months: 1 }), '2026-12-01');

// ---- status (3 months from Mon 2026-11-02 ends 2027-02-01; last month starts 2027-01-01)
const p3 = { start_date: '2026-11-02', months: 3 };
eq('status active', planStatus(p3, '2026-12-31'), 'active');
eq('status last month first day', planStatus(p3, '2027-01-01'), 'last-month');
eq('status last day', planStatus(p3, '2027-02-01'), 'last-month');
eq('status ended', planStatus(p3, '2027-02-02'), 'ended');
eq('status 1 month plan', planStatus({ start_date: '2026-11-02', months: 1 }, '2026-11-02'), 'last-month');

// ---- rotation: 6 workouts, Sunday rest, starting Monday
const six = { start_date: '2026-11-02', rest_days: [0], days: 'ABCDEF'.split('').map((label) => ({ label, tag: null, items: [] })) };
const idx = (d: string) => workoutIndex(six, d);
eq('mon = A', idx('2026-11-02'), 0);
eq('tue = B', idx('2026-11-03'), 1);
eq('sat = F', idx('2026-11-07'), 5);
eq('sun rest', idx('2026-11-08'), null);
eq('next mon = A', idx('2026-11-09'), 0);
eq('before start', idx('2026-11-01'), null);
eq('far future', idx('2027-02-01'), 0); // Mon, 13 weeks later
eq('far future sat', idx('2027-02-06'), 5);
eq('per week', trainingDaysPerWeek([0]), 6);

// 5 workouts but 6 training days: the sequence runs into the next week
const five = { start_date: '2026-11-02', rest_days: [0], days: 'ABCDE'.split('').map((label) => ({ label, tag: null, items: [] })) };
eq('5 on 6: sat = A', workoutIndex(five, '2026-11-07'), 0);
eq('5 on 6: next mon = B', workoutIndex(five, '2026-11-09'), 1);

// starting on a Wednesday with Sat+Sun rest
const wed = { start_date: '2026-11-04', rest_days: [0, 6], days: 'ABC'.split('').map((label) => ({ label, tag: null, items: [] })) };
eq('wed start = A', workoutIndex(wed, '2026-11-04'), 0);
eq('fri = C', workoutIndex(wed, '2026-11-06'), 2);
eq('sat rest', workoutIndex(wed, '2026-11-07'), null);
eq('next mon = A', workoutIndex(wed, '2026-11-09'), 0);
eq('next wed = C', workoutIndex(wed, '2026-11-11'), 2);

eq('nav next skips rest', nextTrainingDate(six, '2026-11-07'), '2026-11-09');
eq('nav prev skips rest', previousTrainingDate(six, '2026-11-09'), '2026-11-07');
eq('nav prev at start', previousTrainingDate(six, '2026-11-02'), null);
eq('nav next before start', nextTrainingDate(six, '2026-10-20'), '2026-11-02');
eq('training day', isTrainingDay(six, '2026-11-08'), false);

// suggestions
eq('suggest 6', suggestRestDays(6), [0]);
eq('suggest 5', suggestRestDays(5), [0, 6]);
eq('suggest 3', suggestRestDays(3), [0, 2, 4, 6]);
eq('suggest 7', suggestRestDays(7), []);
eq('suggest 9 clamps', suggestRestDays(9), []);

// ---- names
eq('pretty caps', prettyName('AGACHAMENTO BARRA LIVRE'), 'Agachamento Barra Livre');
eq('pretty small words', prettyName('ELEVAÇÃO PÉLVICA UNILATERAL'), 'Elevação Pélvica Unilateral');
eq('pretty paren', prettyName('LEG PRESS(anilhas)'), 'Leg Press (anilhas)');
eq('pretty mixed', prettyName('STIFF halteres'), 'Stiff halteres');
eq('pretty small', prettyName('ROLINHO E AQUECE 5MIN ESCADA'), 'Rolinho e Aquece 5min Escada');
eq('key accents+paren', exerciseKey('LEG PRESS(anilhas) '), 'leg press');
eq('key same', exerciseKey('Glúteo coice polia'), exerciseKey('GLUTEO COICE POLIA '));
eq('target slash', targetReps('15/12/10/8', 2), '10');
eq('target slash overflow', targetReps('15/12', 3), '12');
eq('target plain', targetReps('10', 3), '10');
eq('target range', targetReps('10 a 12', 0), '10 a 12');
eq('target empty', targetReps('', 0), '');

// ---- parser: a faithful copy of the coach's sheet (A, C, E side by side; B, D, F below; header repeated
// between the blocks). Only the coach's and the client's names are replaced.
const CELLS: [string, string | number][] = [["A1", "COACH NAME "], ["E1", "COACH NAME "], ["I1", "COACH NAME "], ["A2", "CONSULTORIA E PERIODIZAÇÃO DE TREINAMENTO "], ["E2", "CONSULTORIA E PERIODIZAÇÃO DE TREINAMENTO "], ["I2", "CONSULTORIA E PERIODIZAÇÃO DE TREINAMENTO "], ["M2", "SEGUNDA "], ["N2", "coxa ant e glúteo "], ["A3", "Client Name"], ["E3", "Client Name"], ["I3", "Client Name"], ["M3", "TERÇA "], ["N3", "peito, bíceps e ombro"], ["O3", "CORRIDA"], ["A4", "DATA DE INÍCIO: 15/07 TREINO 18"], ["E4", "DATA DE INÍCIO: 15/07 TREINO 18"], ["I4", "DATA DE INÍCIO: 15/07 TREINO 18"], ["M4", "QUARTA "], ["N4", "coxa post, glúteo "], ["A5", "TREINO A"], ["B5", "SÉRIE"], ["C5", "REP."], ["E5", "TREINO C"], ["F5", "SÉRIE"], ["G5", "REP."], ["I5", "TREINO E"], ["J5", "SÉRIE"], ["K5", "REP."], ["M5", "QUINTA "], ["N5", "costas, tríceps"], ["O5", "CORRIDA"], ["A6", "ROLINHO E AQUECE 5MIN ESCADA "], ["E6", "ROLINHO E AQUECE 5MIN ESCADA "], ["I6", "ROLINHO E AQUECE BIKE 5 MIN"], ["M6", "SEXTA "], ["N6", "coxa ant, post, glúteo "], ["M7", "SÁBADO "], ["N7", "ombro, tríceps e costas "], ["O7", "CORRIDA"], ["A8", "AGACHAMENTO BARRA LIVRE"], ["B8", 4], ["C8", "15/12/10/8"], ["E8", "BULGARO HALTERES "], ["F8", 4], ["G8", 8], ["I8", "HACK INCLINADO "], ["J8", 4], ["K8", "12/10/10/8"], ["M8", "DOMINGO "], ["O8", "CORRIDA"], ["A9", "FLEXÃO NÓRDICA REVERSA"], ["B9", 4], ["C9", "10 a 12"], ["E9", "FLEXÃO MÁQUINA DEITADA"], ["F9", 4], ["G9", 12], ["I9", "GLÚTEO BAND JOELHO ESTENDIDO "], ["J9", 4], ["K9", "15 ou +"], ["A11", "AGACHAMENTO UNILATERAL SMITH "], ["B11", 4], ["C11", 10], ["E11", "GLÚTEO JOELHO ESTENDIDO POLIA "], ["F11", 4], ["G11", 8], ["I11", "LEG PRESS(anilhas)"], ["J11", 4], ["K11", 10], ["A12", "ELEVAÇÃO PÉLVICA UNILATERAL(peso sobre a pelve)"], ["B12", 4], ["C12", 8], ["E12", "STIFF halteres "], ["F12", 4], ["G12", 10], ["I12", "PÉLVICA NA POLIA "], ["J12", 4], ["K12", 10], ["A14", "GLUTEO POLIA JOELHO ESTENDIDO/CRUZADO "], ["B14", 4], ["C14", 10], ["E14", "ELEVAÇÃO PÉLVICA(Band nos joelhos)"], ["F14", 4], ["G14", "15/12/10/10"], ["I14", "AGACHAMENTO UNILATERAL SMITH PÉ NO STEP "], ["J14", 4], ["K14", 10], ["A15", "ABS LIVRE"], ["B15", 4], ["E15", "ABS LIVRE"], ["F15", 4], ["I15", "ABS LIVRE"], ["J15", 4], ["A17", "GLÚTEO COICE POLIA "], ["B17", 3], ["C17", 10], ["E17", "TERRA SUMÔ(barra livre)"], ["F17", 4], ["G17", 10], ["I17", "GLÚTEO COICE POLIA"], ["J17", 4], ["K17", 10], ["E18", "PASSADA COM HALTERES "], ["F18", 4], ["G18", "vai 10 volta 10"], ["I18", "ABDUTOR NA POLIA"], ["J18", 4], ["K18", 10], ["A19", "ADUTOR MÁQUINA "], ["B19", 4], ["C19", "20/10/20/10"], ["A20", "ABDUTOR MÁQUINA INCLINADA"], ["B20", 4], ["C20", "12+12 curtos"], ["E20", "ADUTOR MÁQUINA "], ["F20", 3], ["G20", 12], ["I20", "EXTENSÃO DE JOELHOS"], ["J20", 4], ["K20", "8/10/12/15"], ["A21", "ALONGAMENTO"], ["E21", "ABDUTOR MÁQUINA NO STEP"], ["F21", 3], ["G21", 12], ["I21", "FLEXÃO MÁQUINA DEITADA"], ["J21", 4], ["K21", 10], ["E22", "ALONGAMENTO"], ["I22", "ALONGAMENTO"], ["A24", "COACH NAME "], ["A25", "CONSULTORIA E PERIODIZAÇÃO DE TREINAMENTO "], ["E25", "COACH NAME "], ["I25", "COACH NAME "], ["A26", "Client Name"], ["E26", "CONSULTORIA E PERIODIZAÇÃO DE TREINAMENTO "], ["I26", "CONSULTORIA E PERIODIZAÇÃO DE TREINAMENTO "], ["A27", "DATA DE INÍCIO: 15/07 TREINO 18"], ["E27", "Client Name"], ["I27", "Client Name"], ["A28", "TREINO B(CORRIDA)"], ["B28", "SÉRIE"], ["C28", "REP."], ["E28", "DATA DE INÍCIO: 15/07 TREINO 18"], ["I28", "DATA DE INÍCIO: 15/07 TREINO 18"], ["A29", "5 MIN ESTEIRA(aumenta velocidade a cada min.)"], ["E29", "TREINO D(CORRIDA)"], ["F29", "SÉRIE"], ["G29", "REP."], ["I29", "TREINO F(CORRIDA)"], ["J29", "SÉRIE"], ["K29", "REP."], ["E30", "AQUECE 5MIN REMO"], ["I30", "AQUECE BIKE DE POTÊNCIA 5 MIN"], ["A31", "SUPINO INCLINADO HALTERES "], ["B31", 4], ["C31", 10], ["A32", "ELEVAÇÃO LATERAL HALTERES "], ["B32", 4], ["C32", 10], ["E32", "REMADA ABERTA APARELHO(anilhas)"], ["F32", 4], ["G32", 10], ["I32", "REMADA CURVADA ABERTA HALTERES "], ["J32", 4], ["K32", 10], ["E33", "TRÍCEPS FRANCÊS HALTERES "], ["F33", 4], ["G33", 12], ["I33", "CRUCIFIXO INVERSO MÁQUINA "], ["J33", 4], ["K33", 12], ["A34", "CRUCIFIXO RETO HALTERES "], ["B34", 4], ["C34", 12], ["A35", "ELEVAÇÃO FRONTAL HALTERES "], ["B35", 4], ["C35", 10], ["E35", "REMADA SENTADA POLIA(no Cross) PEGADA BÍCEPS "], ["F35", 4], ["G35", 10], ["I35", "REMADA MÁQUINA FECHADA(anilhas)"], ["J35", 4], ["K35", 10], ["E36", "TRÍCEPS CORDA "], ["F36", 4], ["G36", 10], ["I36", "ELEVAÇÃO FRONTAL HALTERES "], ["J36", 4], ["K36", 10], ["A37", "SUPINO RETO BARRA LIVRE"], ["B37", 4], ["C37", "10 a 15"], ["A38", "CRUCIFIXO INVERSO HALTERES "], ["B38", 4], ["C38", 10], ["E38", "PUXADA ALTA ABERTA MÁQUINA(entrada da acad.)"], ["F38", 4], ["G38", 12], ["I38", "PUXADA ALTA ABERTA MÁQUINA (anilhas)"], ["J38", 4], ["K38", 12], ["A39", "BÍCEPS MARTELO HALTERES "], ["B39", 4], ["C39", 8], ["E39", "SERROTE "], ["F39", 4], ["G39", 10], ["I39", "ELEVAÇÃO LATERAL HALTERES "], ["J39", 4], ["K39", 12], ["E40", "APOIO FECHADO NO CHÃO(foco tríceps)"], ["F40", 4], ["G40", "8 a 12"], ["A41", "DESENVOLVIMENTO HALTERES "], ["B41", 4], ["C41", 10], ["I41", "PUXADA ALTA FECHADA POLIA"], ["J41", 4], ["K41", 8], ["A42", "BÍCEPS SCOTT MÁQUINA "], ["B42", 4], ["C42", 10], ["E42", "PUXADA ALTA AJOELHADA NA POLIA UNILATERAL "], ["F42", 4], ["G42", 8], ["I42", "DESENVOLVIMENTO HALTERES "], ["J42", 4], ["K42", 10], ["A43", "ROLINHO e ALONGAMENTO "], ["E43", "TRÍCEPS BARRA V POLIA"], ["F43", 4], ["G43", 12], ["E44", "ROLINHO e ALONGAMENTO "], ["I44", "TRÍCEPS CORDA "], ["J44", 4], ["K44", 10], ["I45", "TRÍCEPS FRANCÊS CORDA "], ["J45", 4], ["K45", 10], ["I46", "ABS LIVRE"], ["J46", 4], ["I47", "ROLINHO e ALONGAMENTO "]];
function grid(cells: [string, string | number][]): (string | number | null)[][] {
  const rows: (string | number | null)[][] = Array.from({ length: 60 }, () => Array(23).fill(null));
  for (const [addr, v] of cells) {
    const m = /^([A-Z]+)(\d+)$/.exec(addr)!;
    rows[Number(m[2]) - 1][m[1].charCodeAt(0) - 65] = v;
  }
  return rows;
}
const parsed = parsePlanRows(grid(CELLS));
eq('name', parsed.name, 'Treino 18');
eq('letters', parsed.days.map((d) => d.label), ['A', 'B', 'C', 'D', 'E', 'F']);
eq('tags', parsed.days.map((d) => d.tag), [null, 'CORRIDA', null, 'CORRIDA', null, 'CORRIDA']);
const exCount = (i: number) => parsed.days[i].items.filter((x) => x.kind === 'exercise').length;
eq('exercise counts', [0, 1, 2, 3, 4, 5].map(exCount), [9, 9, 10, 9, 10, 11]);
const A = parsed.days[0];
eq('A first lines', A.items.slice(0, 3).map((i) => i.name), ['ROLINHO E AQUECE 5MIN ESCADA', 'AGACHAMENTO BARRA LIVRE', 'FLEXÃO NÓRDICA REVERSA']);
eq('A first kinds', A.items.slice(0, 2).map((i) => i.kind), ['note', 'exercise']);
eq('A squat', A.items[1], { kind: 'exercise', name: 'AGACHAMENTO BARRA LIVRE', sets: 4, reps: '15/12/10/8' });
eq('A range reps', A.items[2].reps, '10 a 12');
eq('A numeric reps', A.items[3].reps, '10');
eq('A abs no reps', A.items.find((i) => i.name === 'ABS LIVRE'), { kind: 'exercise', name: 'ABS LIVRE', sets: 4, reps: '' });
eq('A ends with stretch', A.items[A.items.length - 1], { kind: 'note', name: 'ALONGAMENTO', sets: null, reps: '' });
const everything = parsed.days.flatMap((d) => d.items.map((i) => i.name)).join('|');
eq('no header leaked', /COACH|CONSULT|Client|DATA DE|TREINO/i.test(everything), false);
eq('no schedule table leaked', /SEGUNDA|CORRIDA$|coxa ant/i.test(everything), false);
eq('C items', parsed.days[2].items.map((i) => i.name).slice(0, 2), ['ROLINHO E AQUECE 5MIN ESCADA', 'BULGARO HALTERES']);
eq('C last is stretch', parsed.days[2].items.at(-1)!.name, 'ALONGAMENTO');
eq('B first is cardio note', parsed.days[1].items[0], { kind: 'note', name: '5 MIN ESTEIRA(aumenta velocidade a cada min.)', sets: null, reps: '' });
eq('D sets and reps', parsed.days[3].items.find((i) => i.name.startsWith('APOIO FECHADO')), { kind: 'exercise', name: 'APOIO FECHADO NO CHÃO(foco tríceps)', sets: 4, reps: '8 a 12' });
eq('E slash reps', parsed.days[4].items.find((i) => i.name.startsWith('EXTENSÃO')), { kind: 'exercise', name: 'EXTENSÃO DE JOELHOS', sets: 4, reps: '8/10/12/15' });
eq('F ends with stretch', parsed.days[5].items.map((i) => i.name).slice(-2), ['ABS LIVRE', 'ROLINHO e ALONGAMENTO']);
eq('weekly count', parsed.days.length, 6);
eq('suggested rest for 6', suggestRestDays(parsed.days.length), [0]);

// header line right above a block-ending header is dropped even without empty rows
eq('banner right after items', parsePlanRows([['TREINO A', 'SÉRIE', 'REP.'], ['X', 3, 10], ['COACH NAME'], ['CONSULTORIA E PERIODIZAÇÃO']]).days[0].items.map((i) => i.name), ['X']);
// spacing of one or two empty rows inside a block is fine
eq('gaps inside', parsePlanRows([['TREINO A'], ['X', 3, 10], [null], [null], ['Y', 3, 10]]).days[0].items.map((i) => i.name), ['X', 'Y']);

// parser errors
let msg = '';
try { parsePlanRows([['hello', null], [null, 'world']]); } catch (e) { msg = (e as Error).message; }
eq('no blocks error', /No "TREINO A"/.test(msg), true);
msg = '';
try { parsePlanRows([['TREINO A', 'SÉRIE', 'REP.'], ['ALONGAMENTO', null, null]]); } catch (e) { msg = (e as Error).message; }
eq('no exercises error', /no exercises/.test(msg), true);
eq('standalone TREINO 18 is not a block', (() => { try { parsePlanRows([['TREINO 18']]); return 'parsed'; } catch { return 'error'; } })(), 'error');
eq('duplicate letter keeps first', parsePlanRows([['TREINO A', 'SÉRIE', 'REP.'], ['X', 3, 10], [null], [null], ['TREINO A', 'SÉRIE', 'REP.'], ['Y', 3, 10]]).days[0].items[0].name, 'X');
eq('sets as text', parsePlanRows([['TREINO A'], ['X', '3', '8']]).days[0].items[0].sets, 3);
eq('reps number float', parsePlanRows([['TREINO A'], ['X', 3, 7.5]]).days[0].items[0].reps, '7.5');

console.log(fail === 0 ? 'ALL PASS' : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
