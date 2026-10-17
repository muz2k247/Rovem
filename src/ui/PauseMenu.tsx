import { pauseMenuItems, type PauseAction, type PauseMode } from '../game/pauseMenu.ts';

/**
 * The pause menu (LEVELS_BUILD_PLAN A3), drawn over the game. Used by the Endless run now and by Track B's level
 * screen later: both pass their mode and handle the action. Esc resumes (the host listens for it).
 */
export function PauseMenu({ mode, onAction }: { mode: PauseMode; onAction: (action: PauseAction) => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Paused">
      <div className="pause-menu">
        <h2>Paused</h2>
        <ul>
          {pauseMenuItems(mode).map((item, i) => (
            <li key={item.action}>
              <button type="button" className={`btn${item.action === 'resume' ? ' cta' : ''}`} onClick={() => onAction(item.action)} autoFocus={i === 0}>
                {item.label}
                {item.note && <small>{item.note}</small>}
              </button>
            </li>
          ))}
        </ul>
        <small className="hint">
          <kbd>Esc</kbd> to resume
        </small>
      </div>
    </div>
  );
}
