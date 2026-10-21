import { useEffect } from 'react';

// Не даёт экрану гаснуть, пока active (Screen Wake Lock API). Система снимает блокировку,
// когда вкладка уходит в фон, — при возврате запрашиваем снова. Без поддержки API — ничего не делает.
const useWakeLock = (active) => {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let sentinel = null;
    let pending = false;
    let cancelled = false;

    // Одна блокировка за раз: если вкладку свернули и развернули, пока первый запрос не
    // завершился, второй запрос не отправляется (иначе одна из блокировок пережила бы выход)
    const request = async () => {
      if (pending || (sentinel && !sentinel.released)) return;
      pending = true;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) lock.release().catch(() => {});
        else sentinel = lock;
      } catch {
        // отказ системы (энергосбережение, нет разрешения) — экран просто погаснет как обычно
      } finally {
        pending = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
};

export default useWakeLock;
