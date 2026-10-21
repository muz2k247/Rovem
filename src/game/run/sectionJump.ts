import type { RunCourse } from './course.ts';

// The developer keys of Endless (`?dev=1`, [ and ]; SHOWCASE_PLAN §13): jump to the next or previous place to look at it.
// Never saved, never in the shipped controls.

/** The rover is put this far past the entry post, so the banner is just behind it and the place is ahead. */
export const SECTION_JUMP_PAST_POST_M = 8;

/** Where to put the rover: just past the entry post of the next (or previous) place; 0 is the start. */
export function sectionJumpX(course: RunCourse, xM: number, direction: 1 | -1): number {
  course.ensureAhead(xM + 1200);
  const stops = [0, ...course.chunks.filter((c) => c.entryPostXM !== undefined).map((c) => c.entryPostXM! + SECTION_JUMP_PAST_POST_M)];
  if (direction === 1) return stops.find((s) => s > xM + 0.5) ?? xM;
  return [...stops].reverse().find((s) => s < xM - 0.5) ?? 0;
}
