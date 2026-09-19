import { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';

const useGeolocationCapacitor = () => {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let watchId;

    const startWatching = async () => {
      try {
        // 1. Запрашиваем нативные разрешения Android/iOS.
        // На iOS coarseLocation может отсутствовать, поэтому проверяем только location.
        const permission = await Geolocation.requestPermissions();
        if (permission.location !== 'granted') {
          setError('Разрешение на использование геолокации отклонено в настройках устройства');
          setIsLoading(false);
          return;
        }

        // 2. Запускаем отслеживание позиции через Capacitor
        watchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          },
          (position, err) => {
            if (err) {
              setError(`Ошибка получения геопозиции: ${err.message}`);
              setIsLoading(false);
              return;
            }

            setCoords({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
            setIsLoading(false);
          }
        );
      } catch (err) {
        setError(`Ошибка инициализации геолокации: ${err.message}`);
        setIsLoading(false);
      }
    };

    startWatching();

    return () => {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, []);

  return { coords, error, isLoading };
};

export default useGeolocationCapacitor;
