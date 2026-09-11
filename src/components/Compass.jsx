import React, { useState } from 'react';
import { calculateDistance, calculateBearing } from '../utils/geoUtils';
import useGeolocation from '../hooks/useGeolocation';
import useDeviceOrientation from '../hooks/useDeviceOrientation';
import useLocations from '../hooks/useLocations';
import useKMZParser from '../hooks/useKMZParser';
import {
  getAccuracyColor,
  cardStyle,
  inputStyle,
  buttonStyle,
  selectStyle,
  containerStyle,
  versionBadgeStyle,
  titleStyle
} from '../styles/compassStyles';

export default function Compass() {
  // 1. Подключаем кастомные хуки
  const { coords, error: geoError, isLoading: isGeoLoading } = useGeolocation();
  const { heading: alpha, isPermissionGranted, requestPermission, error: orientError } = useDeviceOrientation();
  const { savedLocations, selectedLocation, addLocation, deleteLocation, selectLocation } = useLocations();

  // Импорт KMZ
  const { parsedPoints, error: kmzError, isLoading: isKmzLoading, parseKMZFile } = useKMZParser();

  // 2. UI-состояния (обязательно нужны для формы и отладки)
  const [newName, setNewName] = useState('');
  const [newCoords, setNewCoords] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  // 3. Вычисления на основе данных из хуков
  const bearing = coords && selectedLocation ? calculateBearing(coords.lat, coords.lon, selectedLocation.lat, selectedLocation.lon) : 0;
  const rotation = (Number(bearing) - Number(alpha)) % 360;
  const distance = coords && selectedLocation ? calculateDistance(coords.lat, coords.lon, selectedLocation.lat, selectedLocation.lon).toFixed(2) + ' км' : 'Нет точки';

  // Обработчики событий
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

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file)
      parseKMZFile(file);
  };

  const handleAddParsedPoints = () => {
    parsedPoints.forEach(point => {
      addLocation(point.name, point.lat, point.lon);
    });
  };

  // 6. JSX разметка
  return (
    <div style={containerStyle}>
      {!isPermissionGranted ? (
        // Экран запуска - только кнопка
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh'
        }}>
          <h1 style={titleStyle}>Компас</h1>
          <button
            onClick={enableSensors}
            style={{ ...buttonStyle, fontSize: '18px', padding: '16px 32px', maxWidth: '280px' }}
          >
            Включить компас
          </button>
          {orientError && (
            <p style={{
              color: '#FF3B30',
              marginTop: '20px',
              textAlign: 'center',
              fontSize: '14px'
            }}>{orientError}</p>
          )}
        </div>
      ) : (
        // Основной интерфейс
        <>
          {/* Ошибки */}
          {orientError && <p style={{
            color: '#FF3B30',
            textAlign: 'center',
            marginBottom: '10px'
          }}>{orientError}</p>}
          {geoError && <p style={{
            color: '#FF3B30',
            textAlign: 'center',
            marginBottom: '10px'
          }}>{geoError}</p>}

          {/* Выбор точки */}
          <div style={{ ...cardStyle, textAlign: 'center', marginBottom: '20px' }}>
            <p style={{
              margin: '0 0 10px 0',
              fontSize: '14px',
              fontWeight: '600',
              color: '#8e8e93',
              textTransform: 'uppercase'
            }}>Выбор точки</p>
            <select
              value={selectedLocation ? selectedLocation.name : ''}
              onChange={(e) => selectLocation(e.target.value)}
              style={selectStyle}
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

          {/* Блок Компаса */}
          {selectedLocation ? (
            <div style={{
              marginTop: '10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <p style={{
                fontSize: '20px',
                fontWeight: '700',
                margin: '0 0 25px 0',
                color: '#1c1c1e',
                background: 'rgba(255,255,255,0.7)',
                padding: '10px 20px',
                borderRadius: '20px'
              }}>Дистанция: {distance}</p>
              <div style={{
                position: 'relative',
                width: '260px',
                height: '260px',
                margin: '0 auto',
                filter: `drop-shadow(0 10px 20px rgba(0,0,0,0.1))`
              }}>
                <svg viewBox="0 0 100 100" style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  transform: `rotate(-${alpha}deg)`,
                  transition: 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
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
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%', 
                  transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                  transition: 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
                }}>
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
            <p style={{
              color: '#8e8e93',
              marginTop: '40px',
              fontWeight: '500'
            }}>Добавьте точку для навигации</p>
          )}

          {/* Ручное добавление точки */}
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <p style={{
              margin: '0 0 10px 0',
              fontSize: '14px',
              fontWeight: '600',
              color: '#8e8e93',
              textTransform: 'uppercase'
            }}>Новая точка</p>
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

          {/* Импорт KMZ */}
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <p style={{
              margin: '0 0 10px 0',
              fontSize: '14px',
              fontWeight: '600',
              color: '#8e8e93',
              textTransform: 'uppercase'
            }}>Импорт карты</p>
            <input
              type="file"
              accept=".kmz"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="kmz-file-input"
            />
            <label htmlFor="kmz-file-input" style={{ ...buttonStyle, display: 'inline-block', cursor: 'pointer' }}>
              {isKmzLoading ? 'Загрузка...' : 'Выбрать .kmz файл'}
            </label>
            {kmzError && (
              <p style={{
                color: '#FF3B30',
                marginTop: '10px',
                fontSize: '14px'
              }}>{kmzError}</p>
            )}
            {parsedPoints.length > 0 && (
              <>
                <p style={{
                  marginTop: '15px',
                  fontSize: '14px',
                  color: '#1c1c1e'
                }}>Найдено точек: {parsedPoints.length}</p>
                <button onClick={handleAddParsedPoints} style={{ ...buttonStyle, marginTop: '10px' }}>
                  Добавить все точки
                </button>
              </>
            )}
          </div>

          {/* Телеметрия */}
          {coords ? (
            <>
              <p style={{
                margin: '15px 0',
                color: '#8e8e93',
                textAlign: 'center',
                fontWeight: '500'
              }}>Ваши координаты</p>
              <p style={{
                margin: '5px 0',
                fontFamily: 'SFMono-Regular, Consolas, monospace',
                fontSize: '16px',
                color: '#1c1c1e'
              }}>{coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}</p>
              <p style={{
                margin: '5px 0 15px 0',
                fontWeight: '600',
                color: getAccuracyColor(coords.accuracy),
                fontSize: '14px'
              }}>Точность: {Math.round(coords.accuracy)} м</p>
              <button onClick={handleSaveCurrentLocation} style={buttonStyle}>
                + Сохранить текущее место
              </button>
            </>
          ) : (
            <p style={{
              margin: '15px 0',
              color: '#8e8e93',
              textAlign: 'center',
              fontWeight: '500'
            }}>{isGeoLoading ? 'Поиск спутников GPS...' : 'Геолокация недоступна'}</p>
          )}
          
          {debugInfo && <p style={{
            fontSize: '12px',
            color: '#8e8e93',
            marginTop: '10px'
          }}>{debugInfo}</p>}
        </>
      )}

      {/* Бейдж версии - показывается всегда */}
      <p style={versionBadgeStyle}>Alpha v1.0.0</p>
    </div>
  );
}
