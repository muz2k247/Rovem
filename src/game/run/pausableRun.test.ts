import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { constants, rover } from '../../../tests/helpers/physics.ts';
import { createPausableRun } from './pausableRun.ts';
import { createRunSession } from './runSession.ts';

const steering = (i: number): -1 | 0 | 1 => (Math.floor(i / 90) % 3 === 0 ? 1 : Math.floor(i / 90) % 3 === 1 ? -1 : 0);
const make = () => createRunSession({ content, rover: rover(), constants, seed: 777, input: steering });

describe('pause', () => {
  it('runs no steps while paused, and the run is the same as one that never paused', () => {
    const plain = make();
    const plainRun = createPausableRun(plain);
    for (let f = 0; f < 300; f++) plainRun.advance(1 / 60);

    const paused = make();
    const pausedRun = createPausableRun(paused);
    for (let f = 0; f < 120; f++) pausedRun.advance(1 / 60);
    pausedRun.pause();
    const before = paused.state;
    for (let f = 0; f < 500; f++) expect(pausedRun.advance(0.1)).toBe(0); // a long pause, big frames
    expect(paused.state).toBe(before);
    pausedRun.resume();
    for (let f = 0; f < 180; f++) pausedRun.advance(1 / 60);

    expect(paused.state).toEqual(plain.state);
    expect(paused.score).toBe(plain.score);
    expect(paused.events).toEqual(plain.events);
    expect(paused.steerSent).toEqual(plain.steerSent);
  });

  it('keeps the time left over inside a frame across a pause', () => {
    const a = make();
    const b = make();
    const ra = createPausableRun(a);
    const rb = createPausableRun(b);
    ra.advance(0.0125);
    ra.advance(0.0125);
    rb.advance(0.0125);
    rb.pause();
    rb.advance(0.05);
    rb.resume();
    rb.advance(0.0125);
    expect(b.state).toEqual(a.state);
  });

  it('caps one frame at 0.1 s', () => {
    const s = make();
    const ran = createPausableRun(s).advance(5);
    expect(ran).toBe(Math.round(0.1 / constants.timeStepS));
  });
});
