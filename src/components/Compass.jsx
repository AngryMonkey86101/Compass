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

    window.addEventListener('deviceorientationabsolute', handleOrientation);
    return () => window.removeEventListener('deviceorientationabsolute', handleOrientation);
  }, []);

  const handleOrientation = (event) => {
    if (event.alpha !== null) {
      setAlpha(event.alpha);
    }
  };

  const calculateArrowAngle = () => {
    if (!selectedLocation || !userPosition) return 0;

    const { lat: userLat, lon: userLon } = userPosition;
    const { lat: targetLat, lon: targetLon } = selectedLocation;

    const bearing = calculateBearing(userLat, userLon, targetLat, targetLon);
    return (360 - (bearing + alpha)) % 360;
  };

  return (
    <div>
      <select value={selectedLocation?.id} onChange={(e) => setSelectedLocation(locations.find(loc => loc.id === parseInt(e.target.value)))}>
        {locations.map(loc => (
          <option key={loc.id} value={loc.id}>{loc.name}</option>
        ))}
      </select>
      <div className="compass">
        <div>{userPosition ? `Координаты: ${userPosition.latitude}, ${userPosition.longitude}` : 'Координаты: неизвестно'}</div>
        {userPosition && alpha !== null ? (
          <div className="compass-arrow" style={{ transform: `rotate(${calculateArrowAngle()}deg)` }}></div>
        ) : (
          <div className="compass-arrow" style={{ transform: 'rotate(0deg)' }}></div>
        )}
      </div>
    </div>
  );
};

export default Compass;
