import React, { useState, useEffect } from 'react';
import { calculateDistance, calculateBearing } from '../utils/geoUtils';

export default function Compass() {
  const [selectedLocation, setSelectedLocation] = useState(locations[0]);
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

  /*
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
  */

  const bearing = coords ? calculateBearing(coords.lat, coords.lon, selectedLocation.lat, selectedLocation.lon) : 0;
  // Безопасное вычисление угла поворота
  const rotation = (Number(bearing) - Number(alpha)) % 360;
  const distance = coords ? calculateDistance(coords.lat, coords.lon, selectedLocation.lat, selectedLocation.lon) : 'Ищем спутники...';

  return (
    <div style={{ textAlign: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Компас</h2>

      <select
        onChange={(e) => {
          const loc = locations.find(l => l.name === e.target.value);
          if (loc) setSelectedLocation(loc);
        }}
        style={{ padding: '8px', fontSize: '16px', marginBottom: '20px' }}
      >
        {locations.map(l => (
          <option key={l.name} value={l.name}>{l.name}</option>
        ))}
      </select>

      <p>Расстояние: {distance}</p>

      <div style={{ margin: '30px 0', padding: '20px', background: '#f5f5f5', borderRadius: '10px' }}>
        <p>Эмуляция поворота (alpha): {alpha}</p>
        <input
          type="range"
          min="0"
          max="360"
          value={alpha}
          onChange={(e) => setAlpha(Number(e.target.value))}
          style={{ width: '80%' }}
        />
        <p style={{ fontSize: '12px', color: '#666' }}>Итоговый поворот стрелки: {rotation}</p>
      </div>

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
