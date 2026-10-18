import { garageText } from '../../content/garage.ts';
import type { Content, EventKind } from '../../content/index.ts';
import { EVENT_KINDS, FORMULA_KINDS } from '../../content/types.ts';
import type { BuildSelection } from '../buildFromParts.ts';
import type { GarageNumbers } from './garageNumbers.ts';
import { speedText, type SpeedUnit } from './feedback.ts';
import { formatMass } from '../partEffects.ts';

// What the garage shows, as plain data so it can be tested (LEVELS_BUILD_PLAN A5). No React.

export type GarageRowId = 'mass' | 'topSpeed' | 'acceleration' | 'cornerSpeed' | 'water';

/** How a number moved when a part was swapped: ▲ up or ▼ down, with the size of the change. */
export interface GarageChange {
  direction: 'up' | 'down';
  text: string;
}

export interface GarageRow {
  id: GarageRowId;
  label: string;
  value: string;
  change?: GarageChange;
}

const kmhFactor = (unit: SpeedUnit) => (unit === 'kmh' ? 3.6 : 1);

/** The five rows of the garage. Same numbers, same order, for the fitted rover and for a previewed part. */
export function garageRows(n: GarageNumbers, unit: SpeedUnit): GarageRow[] {
  return [
    { id: 'mass', label: 'Mass', value: formatMass(n.massKg) },
    { id: 'topSpeed', label: 'Top speed', value: speedText(n.topSpeedMps, unit) },
    { id: 'acceleration', label: 'Acceleration on asphalt', value: `${n.accelerationMps2.toFixed(2)} m/s²` },
    { id: 'cornerSpeed', label: `Safe speed in a ${n.cornerRadiusM} m corner`, value: speedText(n.cornerSpeedMps, unit) },
    {
      id: 'water',
      label: 'Deep water',
      value: `${n.water.floats ? 'Floats' : 'Sinks'} · ${Math.round(n.water.densityKgPerM3)} kg/m³`,
    },
  ];
}

/** A signed change, or none when the shown values are equal. The minus sign is the real one (−). */
function change(before: number, after: number, decimals: number, unitText: string): GarageChange | undefined {
  const d = Number((after - before).toFixed(decimals));
  if (d === 0) return undefined;
  const size = Math.abs(d).toFixed(decimals);
  return { direction: d > 0 ? 'up' : 'down', text: `${d > 0 ? '+' : '−'}${size} ${unitText}` };
}

/** The rows for `after`, each with its ▲/▼ against `before` (the build before the swap). */
export function changeRows(before: GarageNumbers, after: GarageNumbers, unit: SpeedUnit): GarageRow[] {
  const k = kmhFactor(unit);
  const speedUnit = unit === 'kmh' ? 'km/h' : 'm/s';
  const changes: Record<GarageRowId, GarageChange | undefined> = {
    mass: change(before.massKg, after.massKg, 0, 'kg'),
    topSpeed: change(before.topSpeedMps * k, after.topSpeedMps * k, 2, speedUnit),
    acceleration: change(before.accelerationMps2, after.accelerationMps2, 2, 'm/s²'),
    cornerSpeed: change(before.cornerSpeedMps * k, after.cornerSpeedMps * k, 2, speedUnit),
    water: change(Math.round(before.water.densityKgPerM3), Math.round(after.water.densityKgPerM3), 0, 'kg/m³'),
  };
  return garageRows(after, unit).map((row) => {
    const c = changes[row.id];
    return c ? { ...row, change: c } : row;
  });
}

export interface ChangeBanner {
  /** E.g. `Heavy body fitted · mass 209 → 269 kg`. */
  title: string;
  /** One plain sentence on why the part matters. */
  why: string;
}

const SLOT_KEYS = ['chassisId', 'wheelsId', 'motorId'] as const;

/** The banner for a swap, or null when nothing changed. The masses are the sums of the parts' masses. */
export function changeBanner(content: Content, before: BuildSelection, after: BuildSelection): ChangeBanner | null {
  const part = (id: string) => content.parts.find((p) => p.id === id);
  const mass = (b: BuildSelection) => SLOT_KEYS.reduce((sum, key) => sum + (part(b[key])?.massKg ?? 0), 0);
  for (const key of SLOT_KEYS) {
    if (before[key] === after[key]) continue;
    const fitted = part(after[key]);
    if (!fitted) return null;
    return {
      title: `${displayPartName(fitted.name)} fitted · mass ${mass(before)} → ${mass(after)} kg`,
      why: garageText.why[fitted.id] ?? '',
    };
  }
  return null;
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
