import { useState, useEffect } from 'react';

const useDeviceOrientation = () => {
  const [heading, setHeading] = useState(0);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [error, setError] = useState(null);

  // Переменные для фильтра координат
  let previousHeading = 0;
  const smoothingFactor = 0.15; // Чем меньше, тем плавнее (0.1-0.3)

  const requestPermission = async () => {
    console.log('[Compass] Запрос разрешений...');
    console.log('[Compass] DeviceOrientationEvent:', typeof DeviceOrientationEvent);
    console.log('[Compass] requestPermission:', typeof DeviceOrientationEvent?.requestPermission);

    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permissionState = await DeviceOrientationEvent.requestPermission();
        console.log('[Compass] Результат запроса:', permissionState);
        if (permissionState === 'granted') {
          setIsPermissionGranted(true);
        } else {
          setError('Разрешение на использование датчиков отклонено');
        }
      } catch (error) {
        console.error('[Compass] Ошибка запроса:', error);
        setError(`Ошибка при запросе разрешений: ${error.message}`);
      }
    } else {
      console.log('[Compass] Запрос разрешений не требуется (Android/старый браузер)');
      setIsPermissionGranted(true);
    }
  };

  useEffect(() => {
    let handleOrientation = null;
    let lastDebugTime = 0;
    
    if (isPermissionGranted) {
      handleOrientation = (event) => {
        let newHeading = null;
        let source = 'none';
        
        // Приоритет 1: webkitCompassHeading (iOS — самый точный)
        if (typeof event.webkitCompassHeading === 'number' && !isNaN(event.webkitCompassHeading)) {
          newHeading = event.webkitCompassHeading;
          source = 'webkitCompassHeading';
        }
        // Приоритет 2: absolute orientation (Android с магнитометром)
        else if (event.absolute === true && typeof event.alpha === 'number' && !isNaN(event.alpha)) {
          newHeading = (360 - event.alpha) % 360;
          source = 'absolute+alpha';
        }
        // Приоритет 3: обычная orientation (fallback, менее точный)
        else if (typeof event.alpha === 'number' && !isNaN(event.alpha)) {
          newHeading = (360 - event.alpha) % 360;
          source = 'alpha-only';
        }
        
        // Нормализуем значение в диапазон [0, 360)
        if (newHeading !== null) {
          newHeading = ((newHeading % 360) + 360) % 360;
          
          // Low-pass filter для плавности
          const diff = newHeading - previousHeading;
          let normalizedDiff = diff;
          if (diff > 180) normalizedDiff -= 360;
          if (diff < -180) normalizedDiff += 360;
          
          const smoothedHeading = previousHeading + normalizedDiff * smoothingFactor;
          previousHeading = ((smoothedHeading % 360) + 360) % 360;
          
          setHeading(Math.round(previousHeading * 10) / 10);
          
          // Логирование источника данных (раз в 2 секунды, чтобы не спамить)
          const now = Date.now();
          if (now - lastDebugTime > 2000) {
            console.log(`[Compass] Источник: ${source}, heading: ${Math.round(previousHeading)}°, alpha: ${event.alpha}, absolute: ${event.absolute}, webkit: ${event.webkitCompassHeading}`);
            lastDebugTime = now;
          }
        }
      };
      
      // Подписываемся на оба события (для совместимости)
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
      
      console.log('[Compass] Слушатели событий установлены');
    }
    
    return () => {
      if (handleOrientation) {
        window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
        window.removeEventListener('deviceorientation', handleOrientation, true);
        console.log('[Compass] Слушатели событий удалены');
      }
    };
  }, [isPermissionGranted]);

  return { heading, isPermissionGranted, requestPermission, error };
};

export default useDeviceOrientation;
