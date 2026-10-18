import { useState, useEffect } from 'react';

const isSupported = () => typeof navigator !== 'undefined' && 'geolocation' in navigator;

const getErrorMessage = (error) => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Разрешение на использование геолокации отклонено';
    case error.POSITION_UNAVAILABLE:
      return 'Информация о местоположении недоступна';
    case error.TIMEOUT:
      return 'Время ожидания истекло';
    default:
      return 'Произошла неизвестная ошибка';
  }
};

const useGeolocation = () => {
  const supported = isSupported();
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(supported ? null : 'Геолокация недоступна в вашем браузере');
  const [isLoading, setIsLoading] = useState(supported);

  useEffect(() => {
    if (!supported) return undefined;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setError(null);
        setIsLoading(false);
      },
      (err) => {
        setError(getErrorMessage(err));
        setIsLoading(false);
      },
      // maximumAge: 0 вместе с коротким timeout часто даёт таймауты в помещении;
      // допускаем позицию возрастом до 5 с и ждём фикс до 30 с
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [supported]);

  return { coords, error, isLoading };
};

export default useGeolocation;
