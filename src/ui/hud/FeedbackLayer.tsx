import type { RefObject } from 'react';
import type { FeedbackShown } from '../../game/feedbackQueue.ts';

/**
 * What the student reads while driving (SHOWCASE_PLAN §10): a pop-up beside the rover, or a caption card low in the middle;
 * never both. The pop-up's position is set by the game loop on the element behind `popupRef`, every frame, so React does not
 * re-render to follow the rover.
 */
export function FeedbackLayer({ shown, popupRef }: { shown: FeedbackShown; popupRef: RefObject<HTMLDivElement | null> }) {
  return (
    <>
      <div ref={popupRef} className={shown?.kind === 'popup' ? `popup shown popup-${shown.popup.tone}` : 'popup'} role="status" aria-live="polite">
        {shown?.kind === 'popup' ? shown.popup.text : ''}
      </div>
      {shown?.kind === 'card' && (
        <div className="card" role="status" aria-live="polite">
          <strong>{shown.card.title}</strong>
          <span>{shown.card.line}</span>
        </div>
      )}
    </>
  );
}
