import { useEffect, useMemo, useState } from 'react';
import { magneticDeclination } from '../utils/declination';

const STORAGE_KEY = 'compassDeclination';

const readCached = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const value = saved === null ? NaN : Number(saved);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

// Магнитное склонение там, где вы находитесь (градусы, плюс — восточное). Оно меняется
// медленно — на сотые доли градуса за 10 км, поэтому координаты округляются до 0,1°
// и пересчёт идёт редко. До первой позиции GPS берётся последнее известное значение:
// иначе после фикса шкала повернулась бы на величину склонения (в Екатеринбурге — 15°).
export default function useDeclination(coords) {
  const [cached] = useState(readCached);
  const lat = coords ? Math.round(coords.lat * 10) / 10 : null;
  const lon = coords ? Math.round(coords.lon * 10) / 10 : null;
  const current = useMemo(() => (lat === null ? null : magneticDeclination(lat, lon)), [lat, lon]);

  useEffect(() => {
    if (current === null) return;
    try {
      localStorage.setItem(STORAGE_KEY, current.toFixed(2));
    } catch {
      // без localStorage поправка просто начнёт действовать после первой позиции
    }
  }, [current]);

  return current ?? cached;
}
