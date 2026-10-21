import { useState, useEffect, useRef, useCallback } from 'react';

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

// Поворот экрана относительно естественной ориентации устройства (0, 90, 180, 270)
const getScreenAngle = () => {
  if (typeof screen !== 'undefined' && isNumber(screen.orientation?.angle)) {
    return screen.orientation.angle;
  }
  return isNumber(window.orientation) ? window.orientation : 0;
};

const normalize = (angle) => ((angle % 360) + 360) % 360;

// Направление не хранится в React-состоянии: датчик присылает до ~60 значений
// в секунду, и перерисовка на каждое давала рывки. Вместо этого подписчики
// (циферблат) получают сырое значение и сами плавно анимируют его.
// Разрешение нужно только на iOS (DeviceOrientationEvent.requestPermission). На Android и в APK
// датчик доступен сразу — компас включается без кнопки «Включить компас» при каждом запуске.
const needsPermission = () =>
  typeof DeviceOrientationEvent === 'undefined' || typeof DeviceOrientationEvent.requestPermission === 'function';

const useDeviceOrientation = () => {
  const [isPermissionGranted, setIsPermissionGranted] = useState(() => !needsPermission());
  const [error, setError] = useState(null);
  const errorRef = useRef(null);
  const listenersRef = useRef(new Set());
  const lastHeadingRef = useRef(null);

  const updateError = useCallback((message) => {
    if (errorRef.current === message) return;
    errorRef.current = message;
    setError(message);
  }, []);

  // callback(heading) вызывается на каждое значение датчика; возвращает отписку
  const subscribe = useCallback((callback) => {
    const listeners = listenersRef.current;
    listeners.add(callback);
    if (lastHeadingRef.current !== null) callback(lastHeadingRef.current);
    return () => listeners.delete(callback);
  }, []);

  // Можно вызывать повторно после отказа или ошибки
  const requestPermission = async () => {
    updateError(null);

    if (typeof DeviceOrientationEvent === 'undefined') {
      updateError('Датчики ориентации не поддерживаются на этом устройстве');
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
        updateError('Разрешение на использование датчиков отклонено');
      }
    } catch (err) {
      updateError(`Ошибка при запросе разрешений: ${err.message}`);
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
          updateError('Датчик не определяет направление на север');
          return;
        }
        deviceHeading = 360 - event.alpha;
      } else {
        return; // событие без данных об ориентации
      }

      updateError(null);
      const heading = normalize(deviceHeading + getScreenAngle());
      lastHeadingRef.current = heading;
      listenersRef.current.forEach((callback) => callback(heading));
    };

    window.addEventListener(eventName, handleOrientation, true);
    return () => window.removeEventListener(eventName, handleOrientation, true);
  }, [isPermissionGranted, updateError]);

  return { subscribe, isPermissionGranted, requestPermission, error };
};

export default useDeviceOrientation;
