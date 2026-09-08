import React, { useState, useEffect } from 'react';
import { calculateDistance, calculateBearing } from '../utils/geoUtils';

const compassLocations = 'compassLocations';

export default function Compass() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [coords, setCoords] = useState(null);
  const [alpha, setAlpha] = useState(0);

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

  // Временно отключаем сенсоры, чтобы браузер не сбрасывал угол на ноль
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

  const [savedLocations, setSavedLocations] = useState(() => {
    const saved = localStorage.getItem(compassLocations);
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Северный полюс', lat: 90.0, lon: 0.0 },
      { id: 2, name: 'Москва (Красная площадь)', lat: 55.7535, lon: 37.6210 },
      { id: 3, name: 'Париж (Эйфелева башня)', lat: 48.8584, lon: 2.2945 },
      { id: 4, name: 'Токио (Сибуя)', lat: 35.6595, lon: 139.7005 },
      { id: 5, name: 'Нью-Йорк (Таймс-сквер)', lat: 40.7580, lon: -73.9855 }
    ];
  });

  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationCoords, setNewLocationCoords] = useState('');

  useEffect(() => {
    if (savedLocations.length > 0) {
      setSelectedLocation(savedLocations[0]);
    }
  }, [savedLocations]);

  const handleAddLocation = () => {
    const [latStr, lonStr] = newLocationCoords.split(',').map(coord => coord.trim());
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    if (!isNaN(lat) && !isNaN(lon)) {
      const newLocation = {
        id: savedLocations.length + 1,
        name: newLocationName,
        lat,
        lon
      };

      setSavedLocations([...savedLocations, newLocation]);
      localStorage.setItem(compassLocations, JSON.stringify([...savedLocations, newLocation]));
      setSelectedLocation(newLocation);
    }
  };

  const bearing = coords ? calculateBearing(coords.lat, coords.lon, selectedLocation.lat, selectedLocation.lon) : 0;
  // Безопасное вычисление угла поворота
  const rotation = (Number(bearing) - Number(alpha)) % 360;
  const distance = coords ? calculateDistance(coords.lat, coords.lon, selectedLocation.lat, selectedLocation.lon) : 'Ищем спутники...';

  return (
    <div style={{ textAlign: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Компас</h2>

      <input
        type="text"
        placeholder="Название точки"
        value={newLocationName}
        onChange={(e) => setNewLocationName(e.target.value)}
        style={{ padding: '8px', fontSize: '16px', marginBottom: '10px' }}
      />

      <input
        type="text"
        placeholder="Координаты (56.911076, 60.796712)"
        value={newLocationCoords}
        onChange={(e) => setNewLocationCoords(e.target.value)}
        style={{ padding: '8px', fontSize: '16px', marginBottom: '10px' }}
      />

      <button onClick={handleAddLocation} style={{ padding: '8px 16px', fontSize: '16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
        Добавить точку
      </button>

      <select
        onChange={(e) => {
          const loc = savedLocations.find(l => l.name === e.target.value);
          if (loc) setSelectedLocation(loc);
        }}
        style={{ padding: '8px', fontSize: '16px', marginBottom: '20px' }}
      >
        {savedLocations.map(l => (
          <option key={l.id} value={l.name}>{l.name}</option>
        ))}
      </select>

      <p>Расстояние: {distance}</p>

      <svg
        viewBox="0 0 24 24"
        width="150"
        height="150"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: 'transform 0.1s ease',
          margin: '20px auto',
          display: 'block'
        }}
      >
        <path d="M12 2L4 22h16L12 2z" fill="#ff4444" />
      </svg>
    </div>
  );
}
