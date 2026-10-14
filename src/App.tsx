import { useEffect, useState } from 'react';
import type { Area, Fact } from './drills/facts';
import { emptyProgress, loadProgress, type Progress, recordAnswer, saveProgress } from './srs/progress';
import { DrillScreen } from './ui/DrillScreen';
import { setVibrate } from './ui/feedback';
import { Home } from './ui/Home';
import { setVolume } from './ui/sound';
import { Stats } from './ui/Stats';

type Screen = { name: 'home' } | { name: 'drill'; area: Area | 'mix' } | { name: 'stats' };

export function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  useEffect(() => {
    saveProgress(progress);
    setVibrate(progress.settings.vibrate);
    setVolume(progress.settings.volume);
  }, [progress]);

  useEffect(() => {
    // Ask the browser not to evict practice history when space runs low.
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  // Android's back gesture should leave a drill, not the app.
  useEffect(() => {
    if (screen.name === 'home') return;
    history.pushState({ screen: screen.name }, '');
    const onPop = () => setScreen({ name: 'home' });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [screen.name]);

  const goHome = () => {
    if (history.state?.screen) history.back();
    else setScreen({ name: 'home' });
  };

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
          onExit={goHome}
          onVolume={(volume) => setProgress((p) => ({ ...p, settings: { ...p.settings, volume } }))}
        />
      );
    case 'stats':
      return (
        <Stats
          progress={progress}
          onBack={goHome}
          onVibrate={(vibrate) => setProgress((p) => ({ ...p, settings: { ...p.settings, vibrate } }))}
          onReset={() => setProgress((p) => ({ ...emptyProgress(), settings: p.settings }))}
        />
      );
    default:
      return (
        <Home
          progress={progress}
          onStart={(area) => setScreen({ name: 'drill', area })}
          onStats={() => setScreen({ name: 'stats' })}
          onKeys={(keys) => setProgress((p) => ({ ...p, settings: { ...p.settings, keys } }))}
        />
      );
  }
}
