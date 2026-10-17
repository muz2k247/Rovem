/** The driving screen for one level. A placeholder slot for Track B (LEVELS_BUILD_PLAN B3); it will host the level scene with Track A's HUD and report. */
export function LevelScreen({ levelId, onBack }: { levelId: string; onBack: () => void }) {
  return (
    <main className="placeholder">
      <h1>Level: {levelId}</h1>
      <p>Not built yet (Game v4, Track B).</p>
      <button type="button" onClick={onBack}>
        Back to garage
      </button>
    </main>
  );
}
