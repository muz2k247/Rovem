import type { Settings } from '../save/settings.ts';
import { SettingsPanel } from './SettingsPanel.tsx';

/** Settings (LEVELS_BUILD_PLAN A3). Reached from Home; the pause menu opens the same panel as an overlay. */
export function SettingsScreen({
  settings,
  onChange,
  onReplayTutorial,
  onResetProgress,
  onBack,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
  onReplayTutorial: () => void;
  onResetProgress: () => void;
  onBack: () => void;
}) {
  return (
    <main className="screen settings">
      <header className="screen-header">
        <button type="button" className="btn small" onClick={onBack}>
          ← Home
        </button>
        <h1>Settings</h1>
      </header>
      <SettingsPanel settings={settings} onChange={onChange} onReplayTutorial={onReplayTutorial} onResetProgress={onResetProgress} />
    </main>
  );
}
