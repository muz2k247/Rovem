import type { Content, EventKind } from '../../content/index.ts';
import { EVENT_KINDS, FORMULA_KINDS } from '../../content/types.ts';
import type { GarageNumbers } from './garageNumbers.ts';
import { speedText, type SpeedUnit } from './feedback.ts';
import { formatForce, formatMass } from '../partEffects.ts';

// What the garage shows, as plain data so it can be tested (docs/DEMO_BUILD_PLAN.md A8). No React.

export interface GarageRow {
  label: string;
  value: string;
}

/** The rows of "Your rover in the canyon". Same numbers, same order, for the fitted rover and for a previewed part. */
export function garageRows(n: GarageNumbers, unit: SpeedUnit): GarageRow[] {
  const k = unit === 'kmh' ? 3.6 : 1;
  return [
    { label: 'Mass', value: formatMass(n.massKg) },
    { label: 'Motor force', value: formatForce(n.motorForceN) },
    { label: 'Top speed', value: speedText(n.topSpeedMps, unit) },
    { label: 'In mud', value: `friction ${formatForce(n.mud.frictionN)} vs motor ${formatForce(n.mud.motorN)}: ${n.mud.verdict}` },
    { label: 'Boost pad', value: `+${speedText(n.boostGainMps, unit)}` },
    { label: 'Sandbag hit', value: `${(n.sandbag.fromMps * k).toFixed(2)} → ${speedText(n.sandbag.toMps, unit)}` },
    { label: 'Weight, low gravity', value: formatForce(n.weightLowN) },
    { label: 'Weight, high gravity', value: formatForce(n.weightHighN) },
  ];
}

export interface CompareRow extends GarageRow {
  /** The value with the previewed part fitted, when it differs from the fitted rover's. */
  after?: string;
}

/** Rows with "before → after" where the previewed rover differs from the fitted one. */
export function compareRows(fitted: GarageRow[], previewed: GarageRow[] | undefined): CompareRow[] {
  return fitted.map((row, i) => {
    const other = previewed?.[i];
    return other && other.value !== row.value ? { ...row, after: other.value } : row;
  });
}

export interface FieldLogEntry {
  kind: EventKind;
  tidbit: string;
  /** The general formula in words; left out when an earlier entry already showed the same line. */
  formula?: string;
}

/** The field log: the kinds the student has met, in a fixed order, each formula written once. */
export function fieldLogEntries(seenEvents: readonly EventKind[], text: Content['runText']): FieldLogEntry[] {
  const shown = new Set<string>();
  return EVENT_KINDS.filter((k) => seenEvents.includes(k)).map((kind) => {
    const entry: FieldLogEntry = { kind, tidbit: text.tidbits[kind] };
    if ((FORMULA_KINDS as readonly string[]).includes(kind)) {
      const formula = text.formulas[kind as (typeof FORMULA_KINDS)[number]];
      if (!shown.has(formula)) {
        shown.add(formula);
        entry.formula = formula;
      }
    }
    return entry;
  });
}

/** Display only: "chassis" is shown as "body" (A8 of the demo plan). `parts.json` keeps its names. */
export function displayPartName(name: string): string {
  return name.replace(/chassis/gi, (m) => (m[0] === 'C' ? 'Body' : 'body'));
}
