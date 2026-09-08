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

  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        }),
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

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

  const bearing = coords && selectedLocation ? calculateBearing(coords.lat, coords.lon, selectedLocation.lat, selectedLocation.lon) : 0;
  const rotation = (Number(bearing) - Number(alpha)) % 360;
  const distance = coords && selectedLocation ? calculateDistance(coords.lat, coords.lon, selectedLocation.lat, selectedLocation.lon) : 'Нет точки';

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

  const handleDeleteLocation = () => {
    if (!selectedLocation) return;
    const updated = savedLocations.filter(loc => loc.name !== selectedLocation.name);
    setSavedLocations(updated);
    localStorage.setItem(compassLocations, JSON.stringify(updated));
    setSelectedLocation(updated.length > 0 ? updated[0] : null);
  };

  // Функция для определения цвета текста точности
  const getAccuracyColor = (acc) => {
    if (!acc) return '#888';
    if (acc <= 15) return '#4CAF50'; // Зеленый (Отлично)
    if (acc <= 50) return '#FF9800'; // Оранжевый (Нормально)
    return '#F44336'; // Красный (Плохо)
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
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

      {/* Блок Телеметрии */}
      <div style={{ margin: '20px auto', padding: '10px', background: '#e3f2fd', borderRadius: '8px', maxWidth: '300px', fontSize: '14px' }}>
        <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Ваша геопозиция:</p>
        {coords ? (
          <>
            <p style={{ margin: '2px 0', fontFamily: 'monospace', fontSize: '15px' }}>
              {coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}
            </p>
            <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: getAccuracyColor(coords.accuracy) }}>
              Точность сигнала: {Math.round(coords.accuracy)} м
            </p>
          </>
        ) : (
          <p style={{ margin: '2px 0', color: '#666' }}>Поиск спутников GPS...</p>
        )}
      </div>

      <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '20px 0' }}>Расстояние до цели: {distance}</p>

      {selectedLocation ? (
        <div style={{ position: 'relative', width: '240px', height: '240px', margin: '0 auto' }}>
          {/* Внешний циферблат */}
          <svg viewBox="0 0 100 100" style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            transform: `rotate(-${alpha}deg)`,
            transition: 'transform 0.1s ease'
          }}>
            <circle cx="50" cy="50" r="48" fill="#fafafa" stroke="#ddd" strokeWidth="2" />
            <circle cx="50" cy="50" r="35" fill="none" stroke="#eee" strokeWidth="1" />
            <text x="50" y="15" textAnchor="middle" fill="#ff4444" fontSize="12" fontWeight="bold">N</text>
            <text x="88" y="54" textAnchor="middle" fill="#888" fontSize="10" fontWeight="bold">E</text>
            <text x="50" y="92" textAnchor="middle" fill="#888" fontSize="10" fontWeight="bold">S</text>
            <text x="12" y="54" textAnchor="middle" fill="#888" fontSize="10" fontWeight="bold">W</text>
            <line x1="50" y1="2" x2="50" y2="6" stroke="#ff4444" strokeWidth="2" />
            <line x1="98" y1="50" x2="94" y2="50" stroke="#aaa" strokeWidth="2" />
            <line x1="50" y1="98" x2="50" y2="94" stroke="#aaa" strokeWidth="2" />
            <line x1="2" y1="50" x2="6" y2="50" stroke="#aaa" strokeWidth="2" />
          </svg>

          {/* Внутренняя стрелка */}
          <svg viewBox="0 0 24 24" style={{
            position: 'absolute', top: '25%', left: '25%', width: '50%', height: '50%',
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 0.1s ease',
            filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.25))'
          }}>
            <path d="M12 2L4 20l8-4 8 4z" fill="#2196F3" />
          </svg>
        </div>
      ) : (
        <p style={{ color: '#888', marginTop: '40px' }}>Добавьте точку для навигации</p>
      )}
    </div>
  );
}
