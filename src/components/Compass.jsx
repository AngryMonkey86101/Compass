import React, { useState, useEffect } from 'react';
import locations from '../data/locations.json';
import { calculateDistance, calculateBearing } from '../utils/geoUtils';

const Compass = () => {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [alpha, setAlpha] = useState(0);

  useEffect(() => {
    navigator.geolocation.watchPosition(
      (position) => setUserPosition(position.coords),
      (error) => console.error('Ошибка получения геолокации:', error)
    );

    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('deviceorientationabsolute', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
    };
  }, []);

  const handleOrientation = (event) => {
    if (event.alpha !== null) {
      setAlpha(event.alpha);
      console.log("Alpha:", event.alpha);
    }
  };

  const calculateArrowAngle = () => {
    if (!selectedLocation || !userPosition) return 0;

    const { lat: userLat, lon: userLon } = userPosition;
    const { lat: targetLat, lon: targetLon } = selectedLocation;

    const bearing = calculateBearing(userLat, userLon, targetLat, targetLon);
    return (360 - (bearing + alpha)) % 360;
  };

  const rotationAngle = calculateArrowAngle();

  return (
    <div>
      <select value={selectedLocation?.id} onChange={(e) => setSelectedLocation(locations.find(loc => loc.id === parseInt(e.target.value)))}>
        {locations.map(loc => (
          <option key={loc.id} value={loc.id}>{loc.name}</option>
        ))}
      </select>
      <div className="compass">
        <div>{userPosition ? `Координаты: ${userPosition.latitude}, ${userPosition.longitude}` : 'Координаты: неизвестно'}</div>
        <div className="compass-arrow" style={{ transform: `rotate(${rotationAngle}deg)`, fontSize: 80, display: 'inline-block', transition: 'transform 0.1s ease' }}>
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path d="M12 2L2 22h20L12 2z"/>
          </svg>
        </div>
      </div>
      <p>Угол (alpha): {alpha}</p>
      <input type="range" min="0" max="360" value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} />
      <label htmlFor="alphaSlider">Тест вращения</label>
    </div>
  );
};

export default Compass;
