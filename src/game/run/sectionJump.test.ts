import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createRunCourse } from './course.ts';
import { sectionJumpX, SECTION_JUMP_PAST_POST_M } from './sectionJump.ts';

// The developer keys of Endless (`?dev=1`, [ and ]): jump to a place, just past its entry post, to look at it.

const course = createRunCourse(content, 5);
course.ensureAhead(1500);
const sections = () => course.chunks.filter((c) => c.kind !== 'warmUp');

describe('jumping between places', () => {
  it('next goes to just past the next entry post, and the first press from the start goes to the first place', () => {
    const first = sections()[0]!;
    expect(sectionJumpX(course, 0, 1)).toBe(first.entryPostXM! + SECTION_JUMP_PAST_POST_M);
    const second = course.chunks[2]!;
    expect(sectionJumpX(course, first.entryPostXM! + SECTION_JUMP_PAST_POST_M, 1)).toBe(second.entryPostXM! + SECTION_JUMP_PAST_POST_M);
  });

  it('previous goes back one place, and from the first place back to the start', () => {
    course.ensureAhead(1000);
    const [a, b] = sections();
    const atB = b!.entryPostXM! + SECTION_JUMP_PAST_POST_M;
    expect(sectionJumpX(course, atB, -1)).toBe(a!.entryPostXM! + SECTION_JUMP_PAST_POST_M);
    expect(sectionJumpX(course, a!.entryPostXM! + SECTION_JUMP_PAST_POST_M, -1)).toBe(0);
    expect(sectionJumpX(course, 0, -1)).toBe(0); // nothing before the start
  });

  it('keeps going: the course is made as far ahead as the jump needs', () => {
    const fresh = createRunCourse(content, 9);
    let x = 0;
    for (let i = 0; i < 30; i++) {
      const next = sectionJumpX(fresh, x, 1);
      expect(next).toBeGreaterThan(x);
      x = next;
    }
    expect(x).toBeGreaterThan(29 * 150); // thirty places on, past the entry post of the thirtieth
  });
});
