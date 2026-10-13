import { useState } from 'react';
import { STARTING_BUILD, type BuildSelection } from '../game/buildFromParts.ts';
import { BuildScreen } from './BuildScreen.tsx';
import { DriveScreen } from './DriveScreen.tsx';

// Until the landing and mission select screens arrive (M7), the app opens on the Mission 1 Build screen.
// The test drive is a temporary way into the driving scene; M5 and M6 replace it with the real attempt flow.
export function App() {
  const [build, setBuild] = useState<BuildSelection>(STARTING_BUILD);
  const [driving, setDriving] = useState(false);

  return driving ? (
    <DriveScreen build={build} onBack={() => setDriving(false)} />
  ) : (
    <BuildScreen
      selection={build}
      onSelectionChange={setBuild}
      onTestDrive={() => setDriving(true)}
    />
  );
}
