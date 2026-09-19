import React, { useState } from 'react';
import { calculateDistance, calculateBearing } from '../utils/geoUtils';
import useGeolocation from '../hooks/useGeolocation';
import useDeviceOrientation from '../hooks/useDeviceOrientation';
import useLocations from '../hooks/useLocations';
import useKMZParser from '../hooks/useKMZParser';
import useGroupTracking from '../hooks/useGroupTracking';
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
  const { coords, error: geoError, isLoading: isGeoLoading, isOnline } = useGeolocation();
  const { heading: alpha, isPermissionGranted, requestPermission, error: orientError } = useDeviceOrientation();
  const { savedLocations, selectedLocation, addLocation, deleteLocation, selectLocation } = useLocations();

  // Импорт KMZ
  const { parsedPoints, error: kmzError, isLoading: isKmzLoading, parseKMZFile, clearParsedPoints } = useKMZParser();

  // 2. UI-состояния (обязательно нужны для формы и отладки)
  const [newName, setNewName] = useState('');
  const [newCoords, setNewCoords] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const [showParticipants, setShowParticipants] = useState(false);
  const [showLocationsPage, setShowLocationsPage] = useState(false);
  const { participants, selectedParticipants, isInGroup, toggleParticipant, selectAll, deselectAll } = useGroupTracking();
  const [groupCode, setGroupCode] = useState(() => localStorage.getItem('currentGroupCode') || '');
  const [participantName, setParticipantName] = useState(() => localStorage.getItem('participantName') || '');

  // 3. Вычисления на основе данных из хуков
  const bearing = coords && selectedLocation ? calculateBearing(coords.lat, coords.lon, selectedLocation.lat, selectedLocation.lon) : 0;
  const rotation = (Number(bearing) - Number(alpha)) % 360;

  // Валидация координат для расчета дистанции
  const validSelectedLocation = selectedLocation && 
    typeof selectedLocation.lat === 'number' && !isNaN(selectedLocation.lat) &&
    typeof selectedLocation.lon === 'number' && !isNaN(selectedLocation.lon);

  const distance = coords && validSelectedLocation ? calculateDistance(coords.lat, coords.lon, selectedLocation.lat, selectedLocation.lon) : 'Нет точки';

  // Генерация цветов для участников
  const participantColors = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5856D6', '#FF2D55', '#5AC8FA'];

  const groupMembersWithBearing = isInGroup && coords && participants.length > 0
    ? participants
        .filter(p => selectedParticipants.includes(p.device_id) && p.device_id !== (localStorage.getItem('deviceId') || ''))
        .map((p, index) => {
          // Проверяем, что координаты валидны
          if (!p.lat || !p.lon || isNaN(p.lat) || isNaN(p.lon)) {
            return null;
          }

          const bearing = calculateBearing(coords.lat, coords.lon, p.lat, p.lon);
          const distance = calculateDistance(coords.lat, coords.lon, p.lat, p.lon);
          const rotation = (bearing - alpha) % 360;
          const color = participantColors[index % participantColors.length];

          return {
            ...p,
            bearing: isNaN(bearing) ? 0 : bearing,
            distance: isNaN(distance) ? 0 : distance,
            rotation: isNaN(rotation) ? 0 : rotation,
            color
          };
        })
        .filter(p => p !== null) // Убираем участников с невалидными координатами
    : [];

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

  const handleJoinGroup = () => {
    if (!groupCode.trim() || !participantName.trim()) {
      alert('Введите код группы и ваше имя');
      return;
    }
    localStorage.setItem('currentGroupCode', groupCode.trim());
    localStorage.setItem('participantName', participantName.trim());
    // Перезагружаем страницу, чтобы все хуки (useGroupTracking, useOfflineQueue)
    // корректно подхватили новые значения из localStorage
    window.location.reload();
  };

  const handleLeaveGroup = () => {
    localStorage.removeItem('currentGroupCode');
    localStorage.removeItem('participantName');
    setGroupCode('');
    setParticipantName('');
    // Перезагружаем страницу для сброса состояния группы
    window.location.reload();
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
    console.log('Выбран файл:', file);
    if (file) {
      console.log('Начинаем парсинг файла...');
      parseKMZFile(file);
    } else {
      console.log('Файл не выбран');
    }
  };

  const handleAddParsedPoints = () => {
    // Сначала удаляем старые точки с такими же именами
    parsedPoints.forEach(point => {
      // Проверяем, есть ли уже точка с таким именем
      const existingLocation = savedLocations.find(loc => loc.name === point.name);
      if (existingLocation) 
        deleteLocation(point.name);
      
    });
    
    // Затем добавляем новые точки
    parsedPoints.forEach(point => {
      addLocation(point.name, point.lat, point.lon);
    });
    
    clearParsedPoints();
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
          {!isOnline && (
            <div style={{
              position: 'fixed',
              top: '15px',
              right: '15px',
              padding: '6px 12px',
              borderRadius: '15px',
              background: '#FF9500',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
              zIndex: 1000,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}>
              📡 Оффлайн режим
            </div>
          )}

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
                {/* Точки участников группы на внешнем циферблате */}
                {groupMembersWithBearing.map(member => {
                  const radius = 44; // радиус в % от половины размера (чуть внутри внешнего круга)
                  const angleRad = (member.bearing - 90) * Math.PI / 180;
                  const x = 50 + radius * Math.cos(angleRad);
                  const y = 50 + radius * Math.sin(angleRad);
                  return (
                    <div
                      key={member.device_id}
                      style={{
                        position: 'absolute',
                        top: `${y}%`,
                        left: `${x}%`,
                        transform: 'translate(-50%, -50%)',
                        transition: 'top 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                        zIndex: 10
                      }}
                    >
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: member.color || '#007AFF',
                        border: '2px solid white',
                        boxShadow: `0 2px 6px ${member.color || '#007AFF'}80`
                      }} />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p style={{
              color: '#8e8e93',
              marginTop: '40px',
              fontWeight: '500'
            }}>Добавьте точку для навигации</p>
          )}

          {/* Активные участники группы */}
          {isInGroup && selectedParticipants.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: '20px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase' }}>
                Активные участники
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {participants
                  .filter(p => selectedParticipants.includes(p.device_id))
                  .map(p => (
                    <div key={p.device_id} style={{
                      padding: '6px 12px',
                      background: p.color || '#007AFF',
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      {p.participant_name}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Легенда участников группы */}
          {groupMembersWithBearing.length > 0 && (
            <div style={{
              marginTop: '20px',
              marginBottom: '20px',
              padding: '15px',
              background: 'rgba(255,255,255,0.9)',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <p style={{
                margin: '0 0 10px 0',
                fontSize: '14px',
                fontWeight: '600',
                color: '#8e8e93',
                textTransform: 'uppercase',
                textAlign: 'center'
              }}>Участники на компасе</p>
              {groupMembersWithBearing.map(member => (
                <div key={member.device_id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(0,0,0,0.05)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: member.color || '#007AFF'
                    }} />
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>{member.participant_name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#8e8e93' }}>
                      {member.distance > 1000
                        ? `${(member.distance / 1000).toFixed(1)} км`
                        : `${Math.round(member.distance)} м`}
                    </div>
                    <div style={{ fontSize: '11px', color: '#8e8e93' }}>
                      {Math.round(member.bearing)}°
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Управление группой */}
          {isInGroup ? (
            <div style={{ ...cardStyle, textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase' }}>
                Группа: {groupCode}
              </p>
              <button onClick={() => setShowParticipants(true)} style={buttonStyle}>
                 Участники ({selectedParticipants.length}/{participants.length})
              </button>
              <button onClick={handleLeaveGroup} style={{ ...buttonStyle, background: '#FF3B30', marginTop: '10px' }}>
                Покинуть группу
              </button>
            </div>
          ) : (
            <div style={{ ...cardStyle, textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase' }}>
                Присоединиться к группе
              </p>
              <input
                type="text"
                placeholder="Код группы (напр. 7X9K2M)"
                value={groupCode}
                onChange={(e) => setGroupCode(e.target.value)}
                style={{ ...inputStyle, marginBottom: '10px' }}
              />
              <input
                type="text"
                placeholder="Ваше имя"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                style={{ ...inputStyle, marginBottom: '10px' }}
              />
              <button onClick={handleJoinGroup} style={buttonStyle}>
                Войти в группу
              </button>
            </div>
          )}

          {/* Импорт KMZ */}
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <p style={{
              margin: '0 0 10px 0',
              marginBottom: '20px',
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
            <label htmlFor="kmz-file-input" style={buttonStyle}>
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

          {/* Кнопка перехода к выбору точки */}
          <div style={{ ...cardStyle, textAlign: 'center', marginBottom: '20px' }}>
            <button onClick={() => setShowLocationsPage(true)} style={buttonStyle}>
              📍 Выбор точки
            </button>
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
              {!isOnline && (
                <p style={{
                  marginTop: '15px',
                  fontSize: '12px',
                  color: '#FF9500',
                  textAlign: 'center',
                  fontWeight: '500'
                }}>
                  ⚠️ Данные кэшируются локально
                </p>
              )}
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

      {/* Страница выбора точки */}
      {showLocationsPage && (
        <div style={{
          ...containerStyle,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1100,
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              onClick={() => setShowLocationsPage(false)}
              style={{ ...buttonStyle, background: '#8e8e93', marginBottom: '20px', maxWidth: '200px' }}
            >
              ← Назад
            </button>

            <div style={{ ...cardStyle, textAlign: 'center', marginBottom: '20px', width: '100%' }}>
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

            {/* Ручное добавление точки */}
            <div style={{ ...cardStyle, textAlign: 'center', width: '100%' }}>
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
          </div>
        </div>
      )}

      {/* Модальное окно участников */}
      {showParticipants && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
          color: 'white'
        }}>
          <h2 style={{ marginBottom: '20px', fontSize: '22px' }}>Участники группы</h2>

          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '20px'
          }}>
            <button onClick={selectAll} style={{ ...buttonStyle, background: '#34C759', padding: '8px 16px', fontSize: '12px' }}>
              Выбрать всех
            </button>
            <button onClick={deselectAll} style={{ ...buttonStyle, background: '#FF9500', padding: '8px 16px', fontSize: '12px' }}>
              Снять всех
            </button>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '15px',
            maxHeight: '400px',
            overflowY: 'auto',
            width: '100%',
            maxWidth: '400px'
          }}>
            {participants.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#8e8e93' }}>Нет активных участников</p>
            ) : (
              participants.map(p => (
                <label key={p.device_id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedParticipants.includes(p.device_id)}
                    onChange={() => toggleParticipant(p.device_id)}
                    style={{ marginRight: '12px', width: '20px', height: '20px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '16px', fontWeight: '500' }}>{p.participant_name}</div>
                    <div style={{ fontSize: '12px', color: '#8e8e93', marginTop: '4px' }}>
                      {p.device_id === (localStorage.getItem('deviceId') || '') ? 'Вы' : `Обновлено: ${new Date(p.updated_at).toLocaleTimeString()}`}
                    </div>
                  </div>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: p.color || '#007AFF',
                    marginLeft: '10px'
                  }} />
                </label>
              ))
            )}
          </div>

          <button
            onClick={() => setShowParticipants(false)}
            style={{ ...buttonStyle, maxWidth: '200px', background: '#34C759', marginTop: '20px' }}
          >
            Готово
          </button>
        </div>
      )}

      {/* Бейдж версии - показывается всегда */}
      <p style={versionBadgeStyle}>Alpha v1.2.0 Group</p>
    </div>
  );
}
