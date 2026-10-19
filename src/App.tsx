import { useEffect, useState } from 'react';
import type { Area, Fact } from './drills/facts';
import { deleteExercise, findExercise, newExercise, type Routine, saveExercise } from './routine/routine';
import { emptyProgress, loadProgress, type Progress, recordAnswer, saveProgress } from './srs/progress';
import { DrillScreen } from './ui/DrillScreen';
import { ExerciseEditor } from './ui/ExerciseEditor';
import { setVibrate } from './ui/feedback';
import { Home } from './ui/Home';
import { PlayAlong } from './ui/PlayAlong';
import { RoutineScreen } from './ui/Routine';
import { Session } from './ui/Session';
import { setVolume } from './ui/sound';
import { Stats } from './ui/Stats';

type Screen =
  | { name: 'home' }
  | { name: 'drill'; area: Area | 'mix' }
  | { name: 'play' }
  | { name: 'stats' }
  | { name: 'routine' }
  | { name: 'session' }
  /** id null: a new exercise. */
  | { name: 'edit'; id: string | null };

export function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  // Screens stack up (home → routine → edit), each with a history entry so Android's back
  // gesture goes back one screen rather than leaving the app.
  const [stack, setStack] = useState<Screen[]>([{ name: 'home' }]);
  const screen = stack.at(-1)!;

  useEffect(() => {
    saveProgress(progress);
    setVibrate(progress.settings.vibrate);
    setVolume(progress.settings.volume);
  }, [progress]);

  useEffect(() => {
    // Ask the browser not to evict practice history when space runs low.
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onPop = () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const open = (s: Screen) => {
    history.pushState({ screen: s.name }, '');
    setStack((st) => [...st, s]);
  };
  const back = () => history.back();

  const setRoutine = (update: (r: Routine) => Routine) => setProgress((p) => ({ ...p, routine: update(p.routine) }));
  const setPlay = (play: Progress['settings']['play']) => setProgress((p) => ({ ...p, settings: { ...p.settings, play } }));

  const setVolumeSetting = (volume: number) => setProgress((p) => ({ ...p, settings: { ...p.settings, volume } }));

  const record = (fact: Fact, correct: boolean, ms: number) =>
    setProgress((p) => recordAnswer(p, fact.id, correct, ms, fact.targetMs));

  switch (screen.name) {
    case 'drill':
      return (
        <DrillScreen
          key={screen.area}
          area={screen.area}
          progress={progress}
          onRecord={record}
          onExit={back}
          onVolume={setVolumeSetting}
        />
      );
    case 'play':
      return (
        <PlayAlong
          keys={progress.settings.keys}
          play={progress.settings.play}
          volume={progress.settings.volume}
          onPlay={setPlay}
          onVolume={setVolumeSetting}
          onExit={back}
        />
      );
    case 'routine':
      return (
        <RoutineScreen
          routine={progress.routine}
          onRoutine={setRoutine}
          onStart={() => open({ name: 'session' })}
          onEdit={(id) => open({ name: 'edit', id })}
          onBack={back}
        />
      );
    case 'session':
      return (
        <Session
          routine={progress.routine}
          keys={progress.settings.keys}
          play={progress.settings.play}
          volume={progress.settings.volume}
          onRoutine={setRoutine}
          onPlay={setPlay}
          onVolume={setVolumeSetting}
          onExit={back}
        />
      );
    case 'edit': {
      const existing = findExercise(progress.routine, screen.id);
      return (
        <ExerciseEditor
          key={screen.id ?? 'new'}
          exercise={existing ?? newExercise()}
          isNew={!existing}
          onSave={(e) => {
            setRoutine((r) => saveExercise(r, e));
            back();
          }}
          onDelete={(id) => {
            setRoutine((r) => deleteExercise(r, id));
            back();
          }}
          onCancel={back}
        />
      );
    }
    case 'stats':
      return (
        <Stats
          progress={progress}
          onBack={back}
          onVibrate={(vibrate) => setProgress((p) => ({ ...p, settings: { ...p.settings, vibrate } }))}
          onReset={() => setProgress((p) => ({ ...emptyProgress(), settings: p.settings, routine: p.routine }))}
        />
      );
    default:
      return (
        <Home
          progress={progress}
          onStart={(area) => open({ name: 'drill', area })}
          onPlay={() => open({ name: 'play' })}
          onRoutine={() => open({ name: 'routine' })}
          onStats={() => open({ name: 'stats' })}
          onKeys={(keys) => setProgress((p) => ({ ...p, settings: { ...p.settings, keys } }))}
        />
      );
  }
}
