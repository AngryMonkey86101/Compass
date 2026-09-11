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

    if (isPermissionGranted) {
      handleOrientation = (event) => {
        let newHeading = event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null
          ? event.webkitCompassHeading
          : (event.alpha !== undefined && event.alpha !== null ? 360 - event.alpha : 0);

        if (newHeading < 0) newHeading += 360;

        setHeading(Math.round(newHeading * 10) / 10);
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
