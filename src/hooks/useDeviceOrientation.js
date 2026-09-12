import { useState, useEffect } from 'react';

const useDeviceOrientation = () => {
  const [heading, setHeading] = useState(0);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [error, setError] = useState(null);

  const requestPermission = async () => {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permissionState = await DeviceOrientationEvent.requestPermission();
        if (permissionState === 'granted') {
          setIsPermissionGranted(true);
        } else {
          setError('Разрешение на использование датчиков отклонено');
        }
      } catch (error) {
        setError(`Ошибка при запросе разрешений: ${error.message}`);
      }
    } else {
      setIsPermissionGranted(true);
    }
  };

  useEffect(() => {
    let handleOrientation = null;
    let previousHeading = 0;

    if (isPermissionGranted) {
      handleOrientation = (event) => {
        let newHeading;
        
        // Приоритет 1: webkitCompassHeading (iOS, самый точный)
        if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
          newHeading = event.webkitCompassHeading;
        } 
        // Приоритет 2: absolute orientation (Android с компасом)
        else if (event.absolute && event.alpha !== undefined && event.alpha !== null) {
          newHeading = 360 - event.alpha;
        }
        // Приоритет 3: обычная orientation (менее точный)
        else if (event.alpha !== undefined && event.alpha !== null) {
          newHeading = 360 - event.alpha;
        } else {
          return;
        }
        
        // Нормализуем значение
        newHeading = ((newHeading % 360) + 360) % 360;
        
        // Увеличиваем smoothingFactor для большей плавности (0.08 = очень плавно)
        const currentSmoothingFactor = 0.04;
        
        let diff = newHeading - previousHeading;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        
        const smoothedHeading = previousHeading + diff * currentSmoothingFactor;
        previousHeading = ((smoothedHeading % 360) + 360) % 360;
        
        // Округляем до 1 знака после запятой для плавности
        setHeading(Math.round(previousHeading * 10) / 10);
      };

      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      if (handleOrientation) {
        window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, [isPermissionGranted]);

  return { heading, isPermissionGranted, requestPermission, error };
};

export default useDeviceOrientation;
