// Turns the coach's xlsx into a plan file (.json) the app can import, so the blocks can be checked first.
// Usage: npx tsx scripts/xlsx-to-plan-json.ts <plan.xlsx> [out.json]
import { writeFileSync } from 'node:fs';
import { readSheet } from 'read-excel-file/node';
import { parsePlanRows, planToJson, blocksOf, BLOCK_LABEL } from '../src/lib/plan.ts';

const [input, output] = process.argv.slice(2);
if (!input) {
  console.error('Usage: npx tsx scripts/xlsx-to-plan-json.ts <plan.xlsx> [out.json]');
  process.exit(1);
}
const parsed = parsePlanRows(await readSheet(input));
const json = planToJson(parsed);
if (output) writeFileSync(output, JSON.stringify(json, null, 2) + '\n');
for (const d of parsed.days) {
  console.log(`Treino ${d.label}${d.tag ? ` (${d.tag})` : ''}`);
  for (const b of blocksOf(d)) {
    const first = b.items[0].item;
    if (b.kind === 'note') console.log(`  note: ${first.name}`);
    else console.log(`  ${BLOCK_LABEL[b.kind] ?? 'solo'}: ${b.items.map((x) => `${x.item.name} ${x.item.sets}x${x.item.reps || '-'}`).join('  +  ')}`);
  }
}
if (output) console.log(`\nWrote ${output}`);
