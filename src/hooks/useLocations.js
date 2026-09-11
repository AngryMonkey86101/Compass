import { useState, useEffect } from 'react';

const compassLocations = 'compassLocations';
const defaultLocations = [
  { name: "Северный полюс", lat: 90.0, lon: 0.0 },
  { name: "Москва (Красная площадь)", lat: 55.7535, lon: 37.6210 },
  { name: "Париж (Эйфелева башня)", lat: 48.8584, lon: 2.2945 },
  { name: "Токио (Сибуя)", lat: 35.6595, lon: 139.7005 },
  { name: "Нью-Йорк (Таймс-сквер)", lat: 40.7580, lon: -73.9855 }
];

const useLocations = () => {
  const [savedLocations, setSavedLocations] = useState(() => {
    const saved = localStorage.getItem(compassLocations);
    if (saved) try { return JSON.parse(saved); } catch (e) { return defaultLocations; }
    return defaultLocations;
  });

  const [selectedLocation, setSelectedLocation] = useState(savedLocations.length > 0 ? savedLocations[0] : null);

  useEffect(() => {
    localStorage.setItem(compassLocations, JSON.stringify(savedLocations));
  }, [savedLocations]);

  const addLocation = (name, lat, lon) => {
    const newLoc = { name, lat, lon };
    setSavedLocations([...savedLocations, newLoc]);
    setSelectedLocation(newLoc);
  };

  const deleteLocation = (name) => {
    const updated = savedLocations.filter(loc => loc.name !== name);
    setSavedLocations(updated);
    if (selectedLocation && selectedLocation.name === name) {
      setSelectedLocation(updated.length > 0 ? updated[0] : null);
    }
  };

  const selectLocation = (name) => {
    const loc = savedLocations.find(l => l.name === name);
    if (loc) setSelectedLocation(loc);
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
