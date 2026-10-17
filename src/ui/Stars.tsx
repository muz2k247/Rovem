import type { StarCount } from '../game/contracts.ts';

/** Three stars, filled up to `count` (gold, LEVELS_BUILD_PLAN A3). The count is also in the label, so colour is never the only cue. */
export function Stars({ count }: { count: StarCount }) {
  return (
    <span className="stars" role="img" aria-label={`${count} of 3 stars`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= count ? 'star on' : 'star'} aria-hidden="true">
          {n <= count ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}
