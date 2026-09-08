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

  const handleSaveCurrentLocation = () => {
    if (!coords) return;
    const name = window.prompt("Введите название для текущего места:", "Новая точка");
    if (!name) return;

    const newLoc = { name: name.trim(), lat: coords.lat, lon: coords.lon };
    const updated = [...savedLocations, newLoc];
    setSavedLocations(updated);
    localStorage.setItem(compassLocations, JSON.stringify(updated));
    setSelectedLocation(newLoc);
  };

  const handleDeleteLocation = () => {
    if (!selectedLocation) return;
    const updated = savedLocations.filter(loc => loc.name !== selectedLocation.name);
    setSavedLocations(updated);
    localStorage.setItem(compassLocations, JSON.stringify(updated));
    setSelectedLocation(updated.length > 0 ? updated[0] : null);
  };

  const getAccuracyColor = (acc) => {
    if (!acc) return '#8e8e93';
    if (acc <= 15) return '#34C759'; 
    if (acc <= 50) return '#FF9500'; 
    return '#FF3B30'; 
  };

  // Общие стили для карточек интерфейса
  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)',
    width: '100%',
    maxWidth: '340px',
    marginBottom: '20px',
    boxSizing: 'border-box'
  };

  const inputStyle = {
    width: '100%', padding: '12px', margin: '8px 0', 
    borderRadius: '10px', border: '1px solid #d1d1d6', 
    background: '#f2f2f7', fontSize: '15px', boxSizing: 'border-box',
    outline: 'none', fontFamily: 'inherit'
  };

  const buttonStyle = {
    width: '100%', marginTop: '10px', padding: '12px', background: '#34C759', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '16px'
  };

  const selectStyle = {
    width: '100%', padding: '12px', margin: '8px 0', 
    borderRadius: '10px', border: '1px solid #d1d1d6', 
    background: '#fff', fontSize: '15px', boxSizing: 'border-box',
    outline: 'none', fontFamily: 'inherit'
  };

  return (
    <div style={{
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)', 
      padding: '30px 15px', 
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', 
      color: '#1c1c1e',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxSizing: 'border-box'
    }}>
      
      {/* Выбор точки */}
      <div style={{ ...cardStyle, textAlign: 'center' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600, color: '#8e8e93', textTransform: 'uppercase' }}>Выбор точки</p>
        <select
          value={selectedLocation ? selectedLocation.name : ''}
          onChange={(e) => {
            const loc = savedLocations.find(l => l.name === e.target.value);
            if (loc) setSelectedLocation(loc);
          }}
          style={{ ...selectStyle, width: '100%' }}
        >
          {savedLocations.map(l => (
            <option key={l.name} value={l.name}>{l.name}</option>
          ))}
        </select>

        {/* Кнопка удаления */}
        <button
          onClick={handleDeleteLocation}
          disabled={!selectedLocation}
          style={{ ...buttonStyle, background: '#FF3B30' }}
        >
          Удалить выбранную точку
        </button>
      </div>

      {/* Ручное добавление точки */}
      <div style={{ ...cardStyle, textAlign: 'center' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600, color: '#8e8e93', textTransform: 'uppercase' }}>Новая точка</p>
        <input
          type="text" placeholder="Название (напр. Дом)" value={newName}
          onChange={(e) => setNewName(e.target.value)} style={inputStyle}
        />
        <input
          type="text" placeholder="Широта, Долгота" value={newCoords}
          onChange={(e) => setNewCoords(e.target.value)} style={inputStyle}
        />
        <button
          onClick={handleAddLocation}
          style={buttonStyle}
        >
          Добавить
        </button>
      </div>

      {/* Блок Компаса */}
      {selectedLocation ? (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 25px 0', color: '#1c1c1e', background: 'rgba(255,255,255,0.7)', padding: '10px 20px', borderRadius: '20px' }}>
            Дистанция: {distance}
          </p>
          
          <div style={{ position: 'relative', width: '260px', height: '260px', margin: '0 auto', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.1))' }}>
            {/* Внешний циферблат */}
            <svg viewBox="0 0 100 100" style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              transform: `rotate(-${alpha}deg)`,
              transition: 'transform 0.1s ease'
            }}>
              <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#e5e5ea" strokeWidth="2" />
              <circle cx="50" cy="50" r="35" fill="none" stroke="#f2f2f7" strokeWidth="1" />
              
              <text x="50" y="16" textAnchor="middle" fill="#FF3B30" fontSize="12" fontWeight="bold">N</text>
              <text x="88" y="54" textAnchor="middle" fill="#8e8e93" fontSize="10" fontWeight="bold">E</text>
              <text x="50" y="91" textAnchor="middle" fill="#8e8e93" fontSize="10" fontWeight="bold">S</text>
              <text x="12" y="54" textAnchor="middle" fill="#8e8e93" fontSize="10" fontWeight="bold">W</text>
              
              <line x1="50" y1="2" x2="50" y2="7" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="98" y1="50" x2="93" y2="50" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" />
              <line x1="50" y1="98" x2="50" y2="93" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" />
              <line x1="2" y1="50" x2="7" y2="50" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" />
            </svg>

            {/* Внутренняя стрелка */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}>
              <svg viewBox="0 0 24 24" style={{
                width: '150px', height: '150px',
                filter: 'drop-shadow(0px 6px 8px rgba(0,122,255,0.3))'
              }}>
                <path d="M12 2L3 20l9-5 9 5z" fill="#007AFF" />
              </svg>
            </div>
          </div>

        </div>
      ) : (
        <p style={{ color: '#8e8e93', marginTop: '40px', fontWeight: '500' }}>Добавьте точку для навигации</p>
      )}

      {/* Телеметрия */}
      {coords ? (
        <>
          <p style={{ margin: '15px 0', color: '#8e8e93', textAlign: 'center', fontWeight: '500' }}>Ваши координаты</p>
          <p style={{ margin: '5px 0', fontFamily: 'SFMono-Regular, Consolas, monospace', fontSize: '16px', color: '#1c1c1e' }}>
            {coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}
          </p>
          <p style={{ margin: '5px 0 15px 0', fontWeight: 600, color: getAccuracyColor(coords.accuracy), fontSize: '14px' }}>
            Точность: {Math.round(coords.accuracy)} м
          </p>
          <button
            onClick={handleSaveCurrentLocation}
            style={buttonStyle}
          >
            + Сохранить текущее место
          </button>
        </>
      ) : (
        <p style={{ margin: '15px 0', color: '#8e8e93', textAlign: 'center', fontWeight: '500' }}>Поиск спутников GPS...</p>
      )}

    </div>
  );
}
