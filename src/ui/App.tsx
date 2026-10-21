import { useState } from 'react';
import { content } from '../content/index.ts';
import { levelCards } from '../content/levelCards.ts';
import { STARTING_BUILD, type BuildSelection } from '../game/buildFromParts.ts';
import type { StarCount } from '../game/contracts.ts';
import { builtLevelIds, levelParS } from '../game/level/levels.ts';
import { levelText } from '../game/level/text.ts';
import { shipParts } from '../game/ship.ts';
import { buildWithPart } from '../game/run/reportModel.ts';
import { continueTarget, developerUnlockFromSearch, isEndlessUnlocked, levelSummaries, nextLevelId } from '../game/levelUnlock.ts';
import { loadDemoProgress, resetDemoProgress, saveDemoProgress, type DemoProgress } from '../save/demoProgress.ts';
import { emptyLevelProgress, loadLevelProgress, recordLevelResult, saveLevelProgress, type LevelProgress } from '../save/levelProgress.ts';
import { loadSettings, saveSettings, type Settings } from '../save/settings.ts';
import { BuildScreen } from './BuildScreen.tsx';
import { DriveScreen } from './DriveScreen.tsx';
import { GarageScreen } from './GarageScreen.tsx';
import { HomeScreen } from './HomeScreen.tsx';
import { LevelIntroScreen } from './LevelIntroScreen.tsx';
import { LevelScreen } from './LevelScreen.tsx';
import { LevelsScreen } from './LevelsScreen.tsx';
import { RunScreen } from './RunScreen.tsx';
import { SettingsScreen } from './SettingsScreen.tsx';
import { screenFromHash, type HashScreen } from './screens.ts';

/** Where the garage was opened from, so its Back button returns there. */
type GarageFrom = { kind: 'home' } | { kind: 'intro'; levelId: string } | { kind: 'level'; levelId: string } | { kind: 'endless' };

type Screen =
  | { name: 'home' }
  | { name: 'levels' }
  | { name: 'levelIntro'; levelId: string }
  | { name: 'settings' }
  | { name: 'garage'; from: GarageFrom }
  | { name: 'run'; seed: number; runId: number }
  | { name: 'level'; levelId: string } // Track B's driving screen
  | { name: 'devBuild' }
  | { name: 'devDrive' };

/** A new course seed. Chosen here, in the UI, never inside the physics (DEMO_BUILD_PLAN A3). */
const newSeed = () => Math.floor(Math.random() * 0x7fffffff);

// Only levels with a file can be played; a card without one says "Coming soon" (LEVELS_BUILD_PLAN A2).
const builtIds: ReadonlySet<string> = new Set(builtLevelIds());
const levelIds = levelCards.levels.map((l) => l.id).filter((id) => builtIds.has(id));
const firstLevelId = levelIds[0]!;

/** The screen for a name from the hash (or the placeholder's buttons); null or home gives Home. */
function screenNamed(name: HashScreen | null): Screen {
  switch (name) {
    case 'levels':
      return { name: 'levels' };
    case 'levelIntro':
      return { name: 'levelIntro', levelId: firstLevelId };
    case 'settings':
      return { name: 'settings' };
    default:
      return { name: 'home' };
  }
}

const firstScreen = (): Screen => screenNamed(screenFromHash(window.location.hash));

// The game opens on Home (LEVELS_BUILD_PLAN A3). The old Build screen and test drive stay reachable from the
// developer link in the garage, because the M5a fps and reverse checks still need them.
export function App() {
  const [progress, setProgress] = useState<DemoProgress>(() => loadDemoProgress());
  const [levelProgress, setLevelProgress] = useState<LevelProgress>(() => loadLevelProgress());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  // The developer link (`?unlock=all`) opens every level. It is read once from the address and never saved.
  const [developerUnlock] = useState(() => developerUnlockFromSearch(window.location.search));
  const [screen, setScreen] = useState<Screen>(firstScreen);
  const [devBuild, setDevBuild] = useState<BuildSelection>(STARTING_BUILD);
  const [runCount, setRunCount] = useState(0);

  const update = (next: DemoProgress) => {
    setProgress(next);
    saveDemoProgress(next);
  };
  const changeSettings = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
  };
  const replayTutorial = () => update({ ...progress, briefingSeen: false });
  const resetProgress = () => {
    update(resetDemoProgress(progress));
    const empty = emptyLevelProgress();
    setLevelProgress(empty);
    saveLevelProgress(empty);
  };
  const startRun = (seed: number) => {
    setRunCount((n) => n + 1);
    setScreen({ name: 'run', seed, runId: runCount + 1 });
  };
  const endlessUnlocked = isEndlessUnlocked(levelIds, levelProgress, developerUnlock);
  const toHome = () => setScreen({ name: 'home' });
  const toLevels = () => setScreen({ name: 'levels' });
  const toGarage = (from: GarageFrom) => setScreen({ name: 'garage', from });
  // The best stars and time of a finished level are saved the moment the rover reaches the beacon.
  const finishLevel = (levelId: string, result: { stars: StarCount; timeS: number }) => {
    const next = recordLevelResult(levelProgress, levelId, result);
    setLevelProgress(next);
    saveLevelProgress(next);
  };
  const settingsProps = {
    settings,
    onChange: changeSettings,
    onReplayTutorial: replayTutorial,
    onResetProgress: resetProgress,
  };

  switch (screen.name) {
    case 'home': {
      const next = continueTarget(levelIds, levelProgress);
      return (
        <HomeScreen
          continueCard={levelCards.levels.find((l) => l.id === next) ?? null}
          endlessUnlocked={endlessUnlocked}
          onContinue={() => next && setScreen({ name: 'levelIntro', levelId: next })}
          onLevels={toLevels}
          onEndless={() => startRun(newSeed())}
          onGarage={() => toGarage({ kind: 'home' })}
          onSettings={() => setScreen({ name: 'settings' })}
        />
      );
    }
    case 'levels':
      return (
        <LevelsScreen
          levels={levelSummaries(levelCards.levels, levelProgress, developerUnlock, builtIds)}
          nextId={continueTarget(levelIds, levelProgress)}
          endless={{ ...levelCards.endless, locked: !endlessUnlocked, bestDistanceM: progress.bestDistanceM }}
          dustStorm={levelCards.dustStorm}
          ship={shipParts(levelText.ship.parts, levelProgress)}
          onOpenLevel={(levelId) => setScreen({ name: 'levelIntro', levelId })}
          onEndless={() => startRun(newSeed())}
          onBack={toHome}
        />
      );
    case 'levelIntro': {
      // An unknown id (only possible from a hand-typed address) falls back to the first level.
      const index = Math.max(0, levelCards.levels.findIndex((l) => l.id === screen.levelId));
      const card = levelCards.levels[index]!;
      return (
        <LevelIntroScreen
          card={card}
          number={index + 1}
          parS={levelParS(card.id)}
          onBack={toLevels}
          onChangeRover={() => toGarage({ kind: 'intro', levelId: card.id })}
          onStart={() => setScreen({ name: 'level', levelId: card.id })}
        />
      );
    }
    case 'settings':
      return <SettingsScreen {...settingsProps} onBack={toHome} />;
    case 'garage': {
      const from = screen.from;
      return (
        <GarageScreen
          progress={progress}
          onProgressChange={update}
          backLabel={from.kind === 'intro' ? 'Back to level' : from.kind === 'level' ? 'Back to the level (restarts)' : 'Home'}
          onBack={() => (from.kind === 'intro' ? setScreen({ name: 'levelIntro', levelId: from.levelId }) : from.kind === 'level' ? setScreen({ name: 'level', levelId: from.levelId }) : toHome())}
          onStart={from.kind === 'endless' ? () => startRun(newSeed()) : from.kind === 'level' ? () => setScreen({ name: 'level', levelId: from.levelId }) : undefined}
          startLabel={from.kind === 'level' ? 'Restart level with this rover' : undefined}
          onReplay={from.kind === 'endless' && progress.lastSeed !== null ? () => startRun(progress.lastSeed!) : undefined}
          onDeveloper={developerUnlock ? () => setScreen({ name: 'devBuild' }) : undefined}
        />
      );
    }
    case 'level': {
      const levelId = screen.levelId;
      const next = nextLevelId(levelIds, levelId);
      return (
        <LevelScreen
          levelId={levelId}
          build={progress.build}
          settings={settings}
          onSettingsChange={changeSettings}
          onReplayTutorial={replayTutorial}
          onResetProgress={resetProgress}
          speedUnit={progress.speedUnit}
          nextLevelId={next}
          onFinished={(r) => finishLevel(r.levelId, r)}
          onNext={() => next && setScreen({ name: 'levelIntro', levelId: next })}
          onLevels={toLevels}
          onHome={toHome}
          onGarage={(partId) => {
            if (partId) update({ ...progress, build: buildWithPart(content, progress.build, partId) });
            toGarage({ kind: 'level', levelId }); // the new build restarts the level
          }}
        />
      );
    }
    case 'run':
      return (
        <RunScreen
          key={screen.runId}
          seed={screen.seed}
          progress={progress}
          onProgressChange={setProgress}
          settings={settings}
          onSettingsChange={changeSettings}
          onReplayTutorial={replayTutorial}
          onResetProgress={resetProgress}
          onAgain={() => startRun(newSeed())}
          onReplay={() => startRun(screen.seed)}
          onGarage={() => toGarage({ kind: 'endless' })}
          onLevels={toLevels}
          onHome={toHome}
          onTryThis={(action) => {
            if (action.kind === 'retry') return startRun(newSeed());
            update({ ...progress, build: buildWithPart(content, progress.build, action.partId) });
            toGarage({ kind: 'endless' });
          }}
        />
      );
    case 'devBuild':
      return (
        <BuildScreen
          selection={devBuild}
          onSelectionChange={setDevBuild}
          onTestDrive={() => setScreen({ name: 'devDrive' })}
          onExit={toHome}
        />
      );
    case 'devDrive':
      return <DriveScreen build={devBuild} onBack={() => setScreen({ name: 'devBuild' })} />;
  }
}
