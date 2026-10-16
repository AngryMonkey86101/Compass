import { useState, useEffect, useRef } from 'react';

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

// Поворот экрана относительно естественной ориентации устройства (0, 90, 180, 270)
const getScreenAngle = () => {
  if (typeof screen !== 'undefined' && isNumber(screen.orientation?.angle)) {
    return screen.orientation.angle;
  }
  return isNumber(window.orientation) ? window.orientation : 0;
};

const normalize = (angle) => ((angle % 360) + 360) % 360;

const useDeviceOrientation = () => {
  const [heading, setHeading] = useState(0);
  // Накопленный угол без сброса на 360°: нужен, чтобы CSS-переход шёл по кратчайшей дуге
  const [unwrappedHeading, setUnwrappedHeading] = useState(0);
  const unwrappedRef = useRef(null);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [error, setError] = useState(null);

  // Можно вызывать повторно после отказа или ошибки
  const requestPermission = async () => {
    setError(null);

    if (typeof DeviceOrientationEvent === 'undefined') {
      setError('Датчики ориентации не поддерживаются на этом устройстве');
      return;
    }

    if (typeof DeviceOrientationEvent.requestPermission !== 'function') {
      setIsPermissionGranted(true);
      return;
    }

    try {
      const permissionState = await DeviceOrientationEvent.requestPermission();
      if (permissionState === 'granted') {
        setIsPermissionGranted(true);
      } else {
        setError('Разрешение на использование датчиков отклонено');
      }
    } catch (err) {
      setError(`Ошибка при запросе разрешений: ${err.message}`);
    }
  };

  useEffect(() => {
    if (!isPermissionGranted) return undefined;

    // Android (Chrome) отдаёт направление на север в deviceorientationabsolute;
    // обычное deviceorientation там относительное и не годится для компаса.
    // Подписываемся только на одно событие, чтобы они не перебивали друг друга.
    const eventName = 'ondeviceorientationabsolute' in window
      ? 'deviceorientationabsolute'
      : 'deviceorientation';

    const handleOrientation = (event) => {
      let deviceHeading;

      if (isNumber(event.webkitCompassHeading)) {
        deviceHeading = event.webkitCompassHeading; // iOS
      } else if (isNumber(event.alpha)) {
        if (eventName === 'deviceorientation' && event.absolute === false) {
          setError('Датчик не определяет направление на север');
          return;
        }
        deviceHeading = 360 - event.alpha;
      } else {
        return; // событие без данных об ориентации
      }

      setError(null);
      const newHeading = Math.round(normalize(deviceHeading + getScreenAngle()) * 10) / 10;
      setHeading(newHeading);

      if (unwrappedRef.current === null) {
        unwrappedRef.current = newHeading;
      } else {
        const delta = ((newHeading - unwrappedRef.current) % 360 + 540) % 360 - 180;
        unwrappedRef.current += delta;
      }
      setUnwrappedHeading(unwrappedRef.current);
    };

    window.addEventListener(eventName, handleOrientation, true);
    return () => window.removeEventListener(eventName, handleOrientation, true);
  }, [isPermissionGranted]);

  return { heading, unwrappedHeading, isPermissionGranted, requestPermission, error };
};

export default useDeviceOrientation;
