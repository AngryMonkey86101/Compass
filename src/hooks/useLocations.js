import { useState, useEffect } from 'react';
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

  const deleteLocation = (id) => {
    const updated = savedLocations.filter((loc) => loc.id !== id);
    setSavedLocations(updated);
    if (selectedId === id) {
      setSelectedId(updated[0]?.id ?? null);
    }
  };

  const selectLocation = (id) => {
    if (savedLocations.some((loc) => loc.id === id)) setSelectedId(id);
  };

  return {
    savedLocations,
    selectedLocation,
    addLocation,
    deleteLocation,
    selectLocation
  };
};

export default useLocations;
