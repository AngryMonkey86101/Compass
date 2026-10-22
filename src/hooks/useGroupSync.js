import { useEffect } from 'react';
import { GROUPS_ENABLED } from '../config';
import { reportFix, sendPositions, syncAll } from '../utils/groupsStore';

const POLL_MS = 15000;

// Обмен с сервером групп, пока приложение открыто и видно: раз в 15 с — состояние групп
// и решения по заявкам, при каждом новом фиксе GPS — своя позиция (если пора, см.
// shouldSendPosition). Свёрнутое приложение ничего не передаёт: фоновая передача —
// следующий этап и требует отдельного разрешения.
const useGroupSync = (coords) => {
  useEffect(() => {
    if (!GROUPS_ENABLED) return;
    reportFix(coords);
    if (document.visibilityState === 'visible') sendPositions();
  }, [coords]);

  useEffect(() => {
    if (!GROUPS_ENABLED) return undefined;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      syncAll().then(sendPositions);
    };
    tick();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
};

export default useGroupSync;
