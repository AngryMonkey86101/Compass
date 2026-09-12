import { useState, useEffect } from 'react';

const useGeolocation = () => {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Переменные для фильтра координат
  const coordHistory = [];
  const maxHistorySize = 5;

  const handleSuccess = (position) => {
    const newCoord = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracy: position.coords.accuracy
    };
    
    // Добавляем в историю
    coordHistory.push(newCoord);
    if (coordHistory.length > maxHistorySize) {
      coordHistory.shift();
    }
    
    // Если точность слишком плохая (> 100м), игнорируем
    if (newCoord.accuracy > 100) {
      console.log('[GPS] Игнорируем координаты с низкой точностью:', newCoord.accuracy, 'м');
      return;
    }
    
    // Вычисляем среднее значение из последних координат
    const avgLat = coordHistory.reduce((sum, c) => sum + c.lat, 0) / coordHistory.length;
    const avgLon = coordHistory.reduce((sum, c) => sum + c.lon, 0) / coordHistory.length;
    const avgAccuracy = coordHistory.reduce((sum, c) => sum + c.accuracy, 0) / coordHistory.length;
    
    setCoords({
      lat: avgLat,
      lon: avgLon,
      accuracy: avgAccuracy
    });
    setIsLoading(false);
  };

  useEffect(() => {
    let watchId;

    const successCallback = (position) => {
      handleSuccess(position);
    };

    const errorCallback = (error) => {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          setError('Разрешение на использование геолокации отклонено');
          break;
        case error.POSITION_UNAVAILABLE:
          setError('Информация о местоположении недоступна');
          break;
        case error.TIMEOUT:
          setError('Время ожидания истекло');
          break;
        case error.UNKNOWN_ERROR:
          setError('Неизвестная ошибка');
          break;
        default:
          setError('Произошла неизвестная ошибка');
      }
      setIsLoading(false);
    };

    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        successCallback,
        errorCallback,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Добавлен третий аргумент с опциями
      );
    } else {
      setError('Геолокация недоступна в вашем браузере');
      setIsLoading(false);
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  return { coords, error, isLoading };
};

export default useGeolocation;
