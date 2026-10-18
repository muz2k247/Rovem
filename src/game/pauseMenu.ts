// The Pause menu (LEVELS_BUILD_PLAN A3): Esc in a level or the run → Resume / Back to checkpoint / Restart /
// Garage / Settings / Level select / Home. Endless has no checkpoints, so it has no "Back to checkpoint".

export type PauseAction = 'resume' | 'checkpoint' | 'restart' | 'garage' | 'settings' | 'levels' | 'home';
export type PauseMode = 'level' | 'endless';

export interface PauseItem {
  action: PauseAction;
  label: string;
  /** A short note under the label, where the choice has a cost the student should know. */
  note?: string;
}

export function pauseMenuItems(mode: PauseMode): PauseItem[] {
  const items: PauseItem[] = [{ action: 'resume', label: 'Resume' }];
  if (mode === 'level') items.push({ action: 'checkpoint', label: 'Back to checkpoint', note: 'the clock keeps running' });
  items.push(
    { action: 'restart', label: mode === 'level' ? 'Restart level' : 'New run' },
    { action: 'garage', label: 'Garage', note: mode === 'level' ? 'restarts the level' : 'ends this run' },
    { action: 'settings', label: 'Settings' },
    { action: 'levels', label: 'Level select', note: mode === 'level' ? 'leaves this level' : 'ends this run' },
    { action: 'home', label: 'Home', note: mode === 'level' ? 'leaves this level' : 'ends this run' },
  );
  return items;
}
