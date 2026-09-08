import React, { useState, useEffect } from 'react';
import { calculateDistance, calculateBearing } from '../utils/geoUtils';

const defaultLocations = [
  { name: "Северный полюс", lat: 90.0, lon: 0.0 },
  { name: "Москва (Красная площадь)", lat: 55.7535, lon: 37.6210 },
  { name: "Париж (Эйфелева башня)", lat: 48.8584, lon: 2.2945 },
  { name: "Токио (Сибуя)", lat: 35.6595, lon: 139.7005 },
  { name: "Нью-Йорк (Таймс-сквер)", lat: 40.7580, lon: -73.9855 }
];

const compassLocations = 'compassLocations';

export default function Compass() {
  // Инициализация из localStorage
  const [savedLocations, setSavedLocations] = useState(() => {
    const saved = localStorage.getItem(compassLocations);
    if (saved) try { return JSON.parse(saved); } catch (e) { return defaultLocations; }
    return defaultLocations;
  });

  const [selectedLocation, setSelectedLocation] = useState(savedLocations.length > 0 ? savedLocations[0] : null);
  const [coords, setCoords] = useState(null);
  const [alpha, setAlpha] = useState(0);

  // Поля для новой точки
  const [newName, setNewName] = useState('');
  const [newCoords, setNewCoords] = useState('');

  // Геолокация
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Сенсоры компаса
  useEffect(() => {
    const handleOrientation = (e) => {
      if (e.alpha !== null) setAlpha(e.alpha);
    };
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  // Безопасные вычисления
  const bearing = coords && selectedLocation ? calculateBearing(coords.lat, coords.lon, selectedLocation.lat, selectedLocation.lon) : 0;
  const rotation = (Number(bearing) - Number(alpha)) % 360;
  const distance = coords && selectedLocation ? calculateDistance(coords.lat, coords.lon, selectedLocation.lat, selectedLocation.lon) : 'Нет точки';

  // Добавление точки
  const handleAddLocation = () => {
    if (!newName || !newCoords) return;
    const parts = newCoords.split(',');
    if (parts.length !== 2) return;
    const lat = parseFloat(parts[0].trim());
    const lon = parseFloat(parts[1].trim());
    if (isNaN(lat) || isNaN(lon)) return;

    const newLoc = { name: newName, lat, lon };
    const updated = [...savedLocations, newLoc];
    setSavedLocations(updated);
    localStorage.setItem(compassLocations, JSON.stringify(updated));
    setSelectedLocation(newLoc);
    setNewName('');
    setNewCoords('');
  };

  // Удаление точки
  const handleDeleteLocation = () => {
    if (!selectedLocation) return;
    const updated = savedLocations.filter(loc => loc.name !== selectedLocation.name);
    setSavedLocations(updated);
    localStorage.setItem(compassLocations, JSON.stringify(updated));
    setSelectedLocation(updated.length > 0 ? updated[0] : null);
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px', fontFamily: 'sans-serif', background: 'linear-gradient(135deg, #0b1b2b, #123b47, #1f6a6f, #7ec9c3)' }}>
      <h2>Компас</h2>

      {/* Выбор и удаление */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select
          value={selectedLocation ? selectedLocation.name : ''}
          onChange={(e) => {
            const loc = savedLocations.find(l => l.name === e.target.value);
            if (loc) setSelectedLocation(loc);
          }}
          style={{ padding: '8px', fontSize: '16px', maxWidth: '200px' }}
        >
          {savedLocations.map(l => (
            <option key={l.name} value={l.name}>{l.name}</option>
          ))}
        </select>
        <button
          onClick={handleDeleteLocation}
          disabled={!selectedLocation}
          style={{ padding: '8px 12px', background: '#ff4444', color: 'white', border: 'none', borderRadius: '4px', cursor: selectedLocation ? 'pointer' : 'default' }}
        >
          Удалить
        </button>
      </div>

      {/* Добавление новой точки */}
      <div style={{ margin: '10px auto', padding: '15px', background: '#f5f5f5', borderRadius: '8px', maxWidth: '300px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Добавить точку</h4>
        <input
          type="text"
          placeholder="Название (напр. Дом)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ display: 'block', margin: '5px auto', padding: '8px', width: '90%', boxSizing: 'border-box' }}
        />
        <input
          type="text"
          placeholder="Широта, Долгота"
          value={newCoords}
          onChange={(e) => setNewCoords(e.target.value)}
          style={{ display: 'block', margin: '5px auto', padding: '8px', width: '90%', boxSizing: 'border-box' }}
        />
        <button
          onClick={handleAddLocation}
          style={{ marginTop: '10px', padding: '8px 16px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Добавить
        </button>
      </div>

      <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Расстояние: {distance}</p>

      {/* Скрываем компас, если нет выбранной точки */}
      {selectedLocation ? (
        <svg viewBox="0 0 24 24" width="150" height="150" style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.1s ease', margin: '20px auto', display: 'block' }}>
          <path d="M12 2L4 22h16L12 2z" fill="#FFFF00" />
        </svg>
      ) : (
        <p style={{ color: '#888', marginTop: '40px' }}>Добавьте точку для навигации</p>
      )}

      {/* Оборачиваем defs в svg */}
      <svg xmlns="http://www.w3.org/2000/svg" style={{ display: 'none' }}>
        <defs>
          <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color: #FFFF00; stop-opacity: 1" />
            <stop offset="100%" style="stop-color: #FFD700; stop-opacity: 1" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
