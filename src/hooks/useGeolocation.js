import useGeolocationWeb from './useGeolocationWeb';
import useGeolocationCapacitor from './useGeolocationCapacitor';

// Определяем, работаем ли мы в нативном приложении Capacitor
const isNativeApp = () => {
  return window.Capacitor && window.Capacitor.isNativePlatform();
};

const useGeolocation = () => {
  // Используем нужный хук в зависимости от среды
  if (isNativeApp()) {
    return useGeolocationCapacitor();
  } else {
    return useGeolocationWeb();
  }
};

export default useGeolocation;
