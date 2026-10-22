import { useEffect, useState } from 'react';

// Текущее время с обновлением раз в intervalMs: подписи «обновлено 3 мин назад»
// должны стареть и без новых данных с сервера
const useNow = (intervalMs = 15000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
};

export default useNow;
