import { useState, useEffect } from 'react';
import useOfflineQueue from './useOfflineQueue';

const useGeolocation = () => {
  const { enqueue, isOnline } = useOfflineQueue();
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let watchId;

    const successCallback = (position) => {
      const newCoords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now()
      };
      setCoords(newCoords);
      setIsLoading(false);

      // Сохраняем позицию в оффлайн-очередь
      enqueue(newCoords);
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

  return { coords, error, isLoading, isOnline };
};

export default useGeolocation;
