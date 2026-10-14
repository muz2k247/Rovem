import { useState } from 'react';
import { STARTING_BUILD, type BuildSelection } from '../game/buildFromParts.ts';
import { loadDemoProgress, saveDemoProgress, type DemoProgress } from '../save/demoProgress.ts';
import { BuildScreen } from './BuildScreen.tsx';
import { DriveScreen } from './DriveScreen.tsx';
import { GarageScreen } from './GarageScreen.tsx';
import { RunScreen } from './RunScreen.tsx';

type Screen = { name: 'garage' } | { name: 'run'; seed: number; runId: number } | { name: 'devBuild' } | { name: 'devDrive' };

/** A new course seed. Chosen here, in the UI, never inside the physics (DEMO_BUILD_PLAN A3). */
const newSeed = () => Math.floor(Math.random() * 0x7fffffff);

// The demo opens on the garage (DEMO_BUILD_PLAN A8). The old Build screen and test drive stay reachable from the
// developer link, because the M5a fps and reverse checks still need them.
export function App() {
  const [progress, setProgress] = useState<DemoProgress>(() => loadDemoProgress());
  const [screen, setScreen] = useState<Screen>({ name: 'garage' });
  const [devBuild, setDevBuild] = useState<BuildSelection>(STARTING_BUILD);
  const [runCount, setRunCount] = useState(0);

  const update = (next: DemoProgress) => {
    setProgress(next);
    saveDemoProgress(next);
  };
  const startRun = (seed: number) => {
    setRunCount((n) => n + 1);
    setScreen({ name: 'run', seed, runId: runCount + 1 });
  };

  switch (screen.name) {
    case 'run':
      return (
        <RunScreen
          key={screen.runId}
          seed={screen.seed}
          progress={progress}
          onProgressChange={setProgress}
          onAgain={() => startRun(newSeed())}
          onReplay={() => startRun(screen.seed)}
          onGarage={() => setScreen({ name: 'garage' })}
        />
      );
    case 'devBuild':
      return (
        <BuildScreen
          selection={devBuild}
          onSelectionChange={setDevBuild}
          onTestDrive={() => setScreen({ name: 'devDrive' })}
          onExit={() => setScreen({ name: 'garage' })}
        />
      );
    case 'devDrive':
      return <DriveScreen build={devBuild} onBack={() => setScreen({ name: 'devBuild' })} />;
    default:
      return (
        <GarageScreen
          progress={progress}
          onProgressChange={update}
          onStart={() => startRun(newSeed())}
          onReplay={() => progress.lastSeed !== null && startRun(progress.lastSeed)}
          onDeveloper={() => setScreen({ name: 'devBuild' })}
        />
      );
  }
}
