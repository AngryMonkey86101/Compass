import { useState, useEffect, useCallback } from 'react';
import defaultLocationsData from '../data/locations.json';
import { isValidCoordinates } from '../utils/geoUtils';

const STORAGE_KEY = 'compassLocations';

const generateId = () =>
  globalThis.crypto?.randomUUID?.() ?? `loc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// Приводит запись из хранилища к актуальному формату; невалидные записи отбрасываются.
// Старые записи без id (до миграции) получают новый id.
const normalizeLocation = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!name || !isValidCoordinates(lat, lon)) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : generateId();
  return { id, name, lat, lon };
};

const loadLocations = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const seen = new Set();
        return parsed
          .map(normalizeLocation)
          .filter((loc) => loc && !seen.has(loc.id) && seen.add(loc.id));
      }
    }
  } catch {
    // повреждённые данные или недоступный localStorage — используем значения по умолчанию
  }
  return defaultLocationsData;
};

const useLocations = () => {
  const [savedLocations, setSavedLocations] = useState(loadLocations);
  const [selectedId, setSelectedId] = useState(() => savedLocations[0]?.id ?? null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLocations));
    } catch {
      // хранилище недоступно или переполнено — работаем без сохранения
    }
  }, [savedLocations]);

  const selectedLocation = savedLocations.find((loc) => loc.id === selectedId) ?? null;

  // Возвращает true, если точка добавлена
  const addLocation = (name, lat, lon) => {
    const newLoc = normalizeLocation({ id: generateId(), name, lat, lon });
    if (!newLoc) return false;
    setSavedLocations((prev) => [...prev, newLoc]);
    setSelectedId(newLoc.id);
    return true;
  };

  // Пакетный импорт (KMZ/KML) одним обновлением списка. Точка с тем же названием, что уже
  // есть в списке, заменяет её: координаты обновляются на месте, id и позиция в списке
  // сохраняются; лишние одноимённые дубли удаляются. Повторный импорт файла обновляет точки,
  // а не плодит копии. Возвращает { added, replaced }; первая импортированная становится целью.
  const importLocations = (points) => {
    const incoming = points.map((p) => normalizeLocation({ id: generateId(), ...p })).filter(Boolean);
    if (incoming.length === 0) return { added: 0, replaced: 0 };

    const byName = new Map(incoming.map((loc) => [loc.name, loc]));
    const next = [];
    const usedNames = new Set();
    let replaced = 0;

    for (const loc of savedLocations) {
      const update = byName.get(loc.name);
      if (!update) {
        next.push(loc);
      } else if (!usedNames.has(loc.name)) {
        next.push({ ...loc, lat: update.lat, lon: update.lon });
        usedNames.add(loc.name);
        replaced += 1;
      }
      // повторная одноимённая точка в старом списке — удаляется
    }
    const added = incoming.filter((loc) => !usedNames.has(loc.name));
    next.push(...added);

    const first = incoming[0];
    const firstId = usedNames.has(first.name)
      ? next.find((loc) => loc.name === first.name).id
      : first.id;

    setSavedLocations(next);
    setSelectedId(firstId);
    return { added: added.length, replaced };
  };

  const deleteLocation = (id) => {
    const updated = savedLocations.filter((loc) => loc.id !== id);
    setSavedLocations(updated);
    if (selectedId === id) {
      setSelectedId(updated[0]?.id ?? null);
    }
  };

  // Стабильная функция: строки списка точек мемоизированы и не должны перерисовываться из-за неё.
  // id приходит только из отрисованного списка, отдельная проверка существования не нужна.
  const selectLocation = useCallback((id) => setSelectedId(id), []);

  return {
    savedLocations,
    selectedLocation,
    addLocation,
    importLocations,
    deleteLocation,
    selectLocation
  };
};

export default useLocations;
