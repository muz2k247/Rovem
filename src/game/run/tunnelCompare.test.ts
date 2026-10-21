import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import type { Content, GravityKind } from '../../content/index.ts';
import { testChunk, type ChunkSpec } from '../../../tests/helpers/chunks.ts';
import { constants, rover, roverOf } from '../../../tests/helpers/physics.ts';
import type { PhysicsState } from '../../physics/step.ts';
import { createRunCourse } from './course.ts';
import { createRunSession } from './runSession.ts';

// The comparison must equal what a real run down the other lane gives (DECISIONS 2026-10-16).

const SECTION_M = 100;
const world: Content = {
  ...content,
  runChunks: { fieldChunks: [testChunk({ id: 'empty-a', lengthM: SECTION_M }), testChunk({ id: 'empty-b', lengthM: SECTION_M })], tunnel: content.runChunks.tunnel },
};
const SEED = 3;

const course = createRunCourse(world, SEED);
course.ensureAhead(500);
const tunnel = course.chunks.find((c) => c.kind === 'tunnel')!;
const laneZ = (kind: GravityKind) => {
  const z = tunnel.gravityZones.find((zone) => zone.kind === kind)!;
  return (z.zM[0] + z.zM[1]) / 2;
};
const otherOf = (kind: GravityKind): GravityKind => (kind === 'low' ? 'high' : 'low');

/** A run that starts just before the tunnel in the given lane. Returns the session once it has left the lane (or ended). */
function runLane(kind: GravityKind, start: Partial<PhysicsState>, from?: PhysicsState, build = rover()) {
  const s = createRunSession({
    content: world, rover: build, constants, seed: SEED, input: () => 0,
    initialState: from ?? { positionXM: tunnel.startXM + 1, positionZM: laneZ(kind), speedMps: 10, throttleLevel: 1, ...start },
  });
  let entry: PhysicsState | undefined;
  for (let i = 0; i < 20000 && !s.ended && s.stats.gravityZones.length === 0; i++) {
    s.stepOnce();
    if (!entry && s.events.some((e) => e.kind === 'gravity')) entry = s.state;
  }
  return { s, entry };
}

describe.each<[GravityKind, number]>([['low', 10], ['high', 10], ['low', 16], ['high', 16]])(
  'tunnel comparison: used %s lane at %d m/s',
  (kind, speed) => {
    it('the other lane equals a real run down that lane from the same entry state', () => {
      const a = runLane(kind, { speedMps: speed });
      const zone = a.s.stats.gravityZones[0]!;
      expect(zone.kind).toBe(kind);
      expect(zone.other?.kind).toBe(otherOf(kind));
      // The real run: the same entry state, moved to the other lane, straight.
      const b = runLane(otherOf(kind), {}, { ...a.entry!, positionZM: laneZ(otherOf(kind)), headingRad: 0 });
      const real = b.s.stats.gravityZones[0]!;
      expect(real.kind).toBe(otherOf(kind));
      expect(zone.other!.outcome).toBe(real.outcome);
      expect(zone.other!.speedOutMps).toBe(real.speedOutMps);
    });
  },
);

describe('tunnel comparison: stuck', () => {
  // Spiked wheels and the Large motor from top speed are two of the builds that stick in the high-gravity tunnel mud (DECISIONS 2026-10-14).
  const sticky = roverOf({ chassisId: 'chassis-standard', wheelsId: 'wheels-spiked', motorId: 'motor-large' });
  const lane = (kind: GravityKind, from?: PhysicsState) => runLane(kind, { speedMps: sticky.topSpeedMps }, from, sticky);

  it('driving the low lane, the high lane is reported stuck, and a real run down it gets stuck', () => {
    const a = lane('low');
    const zone = a.s.stats.gravityZones[0]!;
    expect(zone.outcome).toBe('out');
    expect(zone.other).toMatchObject({ kind: 'high', outcome: 'stuck', speedOutMps: 0 });
    const b = lane('high', { ...a.entry!, positionZM: laneZ('high'), headingRad: 0 });
    expect(b.s.ended?.cause).toBe('stuck');
  });

  it('a run stuck in the high lane records it, and the low lane is shown as the way out', () => {
    const a = lane('high');
    expect(a.s.ended?.cause).toBe('stuck');
    const zone = a.s.stats.gravityZones[0]!;
    expect(zone).toMatchObject({ kind: 'high', outcome: 'stuck', speedOutMps: 0 });
    const b = lane('low', { ...a.entry!, positionZM: laneZ('low'), headingRad: 0 });
    expect(zone.other).toMatchObject({ kind: 'low', outcome: 'out' });
    expect(zone.other!.speedOutMps).toBe(b.s.stats.gravityZones[0]!.speedOutMps);
  });
});

describe('a gravity zone with no second lane', () => {
  it('has no comparison', () => {
    const spec: ChunkSpec = { lengthM: SECTION_M, gravityZones: [{ kind: 'high', xM: [20, 60], zM: [-15, 15] }] };
    const w: Content = { ...content, runChunks: { fieldChunks: [testChunk({ ...spec, id: 'lone-a' }), testChunk({ ...spec, id: 'lone-b' })], tunnel: testChunk({ id: 't', lengthM: 50 }) } };
    const s = createRunSession({ content: w, rover: rover(), constants, seed: 1, input: () => 0 });
    for (let i = 0; i < 120 * 20 && s.stats.gravityZones.length === 0; i++) s.stepOnce();
    expect(s.stats.gravityZones[0]!.other).toBeUndefined();
  });
});

describe('tunnel comparison: the other lane always holds the throttle (the student now drives)', () => {
  // The student may coast or brake through their own lane. The comparison does not copy that: it drives the other lane
  // with the throttle held and no brake, from the same entry state, so it stays a fixed, repeatable what-if.
  // "A real run" here is a session with the throttle held (the default of createRunSession).
  it('the other lane equals a real throttle-held run, even if the student coasted through their own lane', () => {
    const coasting = createRunSession({
      content: world, rover: rover(), constants, seed: SEED, input: () => 0,
      drive: () => ({ throttleHeld: false, brakeHeld: false }),
      initialState: { positionXM: tunnel.startXM + 1, positionZM: laneZ('low'), speedMps: 16, throttleLevel: 0 },
    });
    let entry: PhysicsState | undefined;
    for (let i = 0; i < 20000 && !coasting.ended && coasting.stats.gravityZones.length === 0; i++) {
      coasting.stepOnce();
      if (!entry && coasting.events.some((e) => e.kind === 'gravity')) entry = coasting.state;
    }
    const zone = coasting.stats.gravityZones[0]!;
    expect(zone.other?.kind).toBe('high');
    const real = runLane('high', {}, { ...entry!, positionZM: laneZ('high'), headingRad: 0 });
    expect(zone.other!.outcome).toBe(real.s.stats.gravityZones[0]!.outcome);
    expect(zone.other!.speedOutMps).toBe(real.s.stats.gravityZones[0]!.speedOutMps);
  });
});
