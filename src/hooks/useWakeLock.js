import { useEffect } from 'react';

// Не даёт экрану гаснуть, пока active (Screen Wake Lock API). Система снимает блокировку,
// когда вкладка уходит в фон, — при возврате запрашиваем снова. Без поддержки API — ничего не делает.
const useWakeLock = (active) => {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let sentinel = null;
    let cancelled = false;

    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) lock.release().catch(() => {});
        else sentinel = lock;
      } catch {
        // отказ системы (энергосбережение, нет разрешения) — экран просто погаснет как обычно
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
