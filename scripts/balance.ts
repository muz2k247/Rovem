// Simulates all 27 builds on all three missions and prints a pass/fail table.
// Run with `npm run balance` (Node runs the TypeScript directly).
import { content } from '../src/content/index.ts';
import { balanceReport } from '../src/game/balance.ts';

const report = balanceReport(content);
const mark = (pass: boolean) => (pass ? 'Pass' : 'FAIL');
const pad = (s: string, n: number) => s.padEnd(n);
const num = (x: number, d = 3) => x.toFixed(d).padStart(7);

console.log(`${pad('Build', 54)} ${'M1 asph'.padStart(7)} ${'M1 sand'.padStart(7)} M1     ${'M2 ice'.padStart(7)} ${'M2 coast'.padStart(8)} M2     ${'M3 stop'.padStart(7)} M3`);
for (const r of report.rows) {
  console.log(
    `${pad(r.name, 54)} ${num(r.mission1AsphaltS)} ${num(r.mission1SandS)} ${pad(mark(r.mission1Pass), 6)} ${num(r.mission2IceS)} ${num(r.mission2CoastM).padStart(8)} ${pad(mark(r.mission2Pass), 6)} ${num(r.mission3StopM)} ${mark(r.mission3Pass)}`,
  );
}

const total = report.rows.length;
console.log('');
console.log(`Mission 1 passes:   ${report.mission1Passes} of ${total}   (sheet: 20)`);
console.log(`Mission 2 passes:   ${report.mission2Passes} of ${total}   (sheet: 9)`);
console.log(`Mission 3 passes:   ${report.mission3Passes} of ${total}   (sheet: 23)`);
console.log(`Faster on shortcut: ${report.shortcutFaster} of ${total}   (sheet: 17)`);
console.log('');
console.log(`Mission 1: a power-up rescues ${report.mission1PowerUpRescues} of ${report.mission1Failing} failing builds   (spec: 5 of 7)`);
console.log(`Mission 2: Grip tyres rescue ${report.mission2GripRescues} of ${report.mission2Failing}; Smooth bearings rescue ${report.mission2BearingRescues}   (spec: 18 of 18; 9)`);
console.log(`Mission 3: Brake boost rescues ${report.mission3BrakeBoostRescues} of ${report.mission3Failing}; Grip tyres rescue ${report.mission3GripRescues}   (spec: 4 of 4; 0)`);

const expected = [report.mission1Passes === 20, report.mission2Passes === 9, report.mission3Passes === 23, report.shortcutFaster === 17];
if (!expected.every(Boolean)) {
  throw new Error('MISMATCH with the Pass check sheet. Log it under Open issues in docs/ROADMAP.md.');
}
