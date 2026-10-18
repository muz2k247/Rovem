import type { LevelDiagram as DiagramId } from '../content/levelCards.ts';

// A small sketch of what a level is about, for the intro (LEVELS_BUILD_PLAN A3). Drawn in code; no outside image.
// The rover is the orange dot; the track is cyan.

const SKETCHES: Record<DiagramId, string> = {
  straight: 'M8 30 H112 M100 20 V40 H112 V20 Z',
  fork: 'M8 30 H40 C60 30 62 12 84 12 H112 M40 30 C60 30 62 48 84 48 H112',
  pads: 'M8 30 H112 M34 22 L42 30 L34 38 M50 22 L58 30 L50 38 M86 20 V40',
  ring: 'M60 8 C96 8 96 52 60 52 C24 52 24 8 60 8 Z',
  lanes: 'M8 20 H112 M8 40 H112 M8 30 H112',
  crater: 'M8 22 H34 L48 46 H72 L86 22 H112',
  river: 'M8 30 H112 M44 12 C52 20 36 26 44 34 C52 42 36 48 44 54 M72 12 C80 20 64 26 72 34 C80 42 64 48 72 54',
  pylons: 'M8 30 H112 M30 14 V22 M30 38 V46 M80 14 V22 M80 38 V46',
};

export function LevelDiagram({ id }: { id: DiagramId }) {
  return (
    <svg className="level-diagram" viewBox="0 0 120 60" width="120" height="60" role="img" aria-label={`Sketch of the ${id} course`}>
      <path d={SKETCHES[id]} fill="none" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={id === 'ring' ? 60 : 12} cy={id === 'ring' ? 52 : 30} r="4" fill="var(--orange)" />
    </svg>
  );
}
