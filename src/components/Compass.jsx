import React, { useState } from 'react';
import { calculateDistance, calculateBearing } from '../utils/geoUtils';
import useGeolocation from '../hooks/useGeolocation';
import useDeviceOrientation from '../hooks/useDeviceOrientation';
import useLocations from '../hooks/useLocations';

export default function Compass() {
  // 1. Подключаем кастомные хуки
  const { coords, error: geoError, isLoading: isGeoLoading } = useGeolocation();
const { heading: alpha, isPermissionGranted, requestPermission, error: orientError } = useDeviceOrientation();
const { savedLocations, selectedLocation, addLocation, deleteLocation, selectLocation } = useLocations();


  // 2. UI-состояния (остаются в компоненте)
  const [newName, setNewName] = useState('');
  const [newCoords, setNewCoords] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  // 3. Вычисления на основе данных из хуков
  const bearing = coords && selectedLocation ? calculateBearing(coords.lat, coords.lon, selectedLocation.lat, selectedLocation.lon) : 0;
  const rotation = (Number(bearing) - Number(alpha)) % 360;
  const distance = coords && selectedLocation ? calculateDistance(coords.lat, coords.lon, selectedLocation.lat, selectedLocation.lon) : 'Нет точки';

  // 4. Обработчики событий
  const handleAddLocation = () => {
    if (!newName || !newCoords) return;
    const parts = newCoords.split(',');
    if (parts.length !== 2) return;
    const lat = parseFloat(parts[0].trim());
    const lon = parseFloat(parts[1].trim());
    if (isNaN(lat) || isNaN(lon)) return;

    addLocation(newName, lat, lon);
    setNewName('');
    setNewCoords('');
  };

  const handleSaveCurrentLocation = () => {
    if (!coords) return;
    const name = window.prompt("Введите название для текущего места:", "Новая точка");
    if (!name || !name.trim()) return;
    addLocation(name.trim(), coords.lat, coords.lon);
  };

  const handleDeleteLocation = () => {
    if (!selectedLocation) return;
    deleteLocation(selectedLocation.name);
  };

  const enableSensors = async () => {
    try {
      await requestPermission();
    } catch (err) {
      setDebugInfo(`Ошибка при запросе разрешений: ${err.message}`);
    }
  };

  // 5. Стили и утилиты (объявлены до return)
  const getAccuracyColor = (acc) => {
    if (!acc) return '#8e8e93';
    if (acc <= 15) return '#34C759';
    if (acc <= 50) return '#FF9500';
    return '#FF3B30';
  };

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
    width: '100%', marginTop: '10px', padding: '12px', background: '#34C759', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '16px'
  };

  const selectStyle = {
    width: '100%', padding: '12px', margin: '8px 0',
    borderRadius: '10px', border: '1px solid #d1d1d6',
    background: '#fff', fontSize: '15px', boxSizing: 'border-box',
    outline: 'none', fontFamily: 'inherit'
  };

  // 6. JSX разметка
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
      
      {!isPermissionGranted && (
        <button
          onClick={enableSensors}
          style={{ ...buttonStyle, marginTop: '20px', fontSize: '18px' }}
        >
          Включить компас
        </button>
      )}

      {orientError && <p style={{ color: 'red', textAlign: 'center' }}>{orientError}</p>}
      {geoError && <p style={{ color: 'red', textAlign: 'center' }}>{geoError}</p>}

      <div style={{ ...cardStyle, textAlign: 'center', marginBottom: '20px' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase' }}>Выбор точки</p>
        <select
          value={selectedLocation ? selectedLocation.name : ''}
          onChange={(e) => selectLocation(e.target.value)}
          style={{ ...selectStyle, width: '100%' }}
        >
          {savedLocations.map(l => (
            <option key={l.name} value={l.name}>{l.name}</option>
          ))}
        </select>

        <button
          onClick={handleDeleteLocation}
          disabled={!selectedLocation}
          style={{ ...buttonStyle, background: '#FF3B30', marginTop: '10px' }}
        >
          Удалить выбранную точку
        </button>
      </div>

      {selectedLocation ? (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 25px 0', color: '#1c1c1e', background: 'rgba(255,255,255,0.7)', padding: '10px 20px', borderRadius: '20px' }}>
            Дистанция: {distance}
          </p>
          
          <div style={{ position: 'relative', width: '260px', height: '260px', margin: '0 auto', filter: `drop-shadow(0 10px 20px rgba(0,0,0,0.1))` }}>
            {/* Внешний циферблат */}
            <svg viewBox="0 0 100 100" style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              transform: `rotate(-${alpha}deg)`,
              transition: 'transform 0.1s ease'
            }}>
              <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#e5e5ea" strokeWidth="2" />
              <circle cx="50" cy="50" r="35" fill="none" stroke="#f2f2f7" strokeWidth="1" />
              
              <text x="50" y="16" textAnchor="middle" fill="#FF3B30" fontSize="12" fontWeight="bold">С</text>
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

      <div style={{ ...cardStyle, textAlign: 'center' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase' }}>Новая точка</p>
        <input
          type="text" placeholder="Название (напр. Дом)" value={newName}
          onChange={(e) => setNewName(e.target.value)} style={inputStyle}
        />
        <input
          type="text" placeholder="Широта, Долгота" value={newCoords}
          onChange={(e) => setNewCoords(e.target.value)} style={inputStyle}
        />
        <button onClick={handleAddLocation} style={buttonStyle}>
          Добавить
        </button>
      </div>

      {coords ? (
        
          <p style={{ margin: '15px 0', color: '#8e8e93', textAlign: 'center', fontWeight: '500' }}>Ваши координаты</p>
          <p style={{ margin: '5px 0', fontFamily: 'SFMono-Regular, Consolas, monospace', fontSize: '16px', color: '#1c1c1e' }}></p>
            {coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}
          
          <p style={{ margin: '5px 0 15px 0', fontWeight: '600', color: getAccuracyColor(coords.accuracy), fontSize: '14px' }}>
            Точность: {Math.round(coords.accuracy)}
          </p>
          <button onClick={handleSaveCurrentLocation} style={buttonStyle}>
            + Сохранить текущее место
          </button>
        /
      ) : (
        <p style={{ margin: '15px 0', color: '#8e8e93', textAlign: 'center', fontWeight: '500' }}>
          {isGeoLoading ? 'Поиск спутников GPS...' : 'Геолокация недоступна'}
        </p>
      )}
      
      {debugInfo && <p style={{ fontSize: '12px', color: '#8e8e93', marginTop: '10px' }}>{debugInfo}</p>}
    </div>
  );
}
