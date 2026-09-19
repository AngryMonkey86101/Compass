import useGeolocationWeb from './useGeolocationWeb';
import useGeolocationCapacitor from './useGeolocationCapacitor';

// Определяем, работаем ли мы в нативном приложении Capacitor.
// Значение вычисляется один раз при загрузке модуля, чтобы не нарушать
// Rules of Hooks (условный вызов хуков запрещён).
const isNativeApp = () => {
  return typeof window !== 'undefined' &&
    window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform();
};

const IS_NATIVE = isNativeApp();

const useGeolocation = () => {
  // Вызываем оба хука безусловно (правила хуков React),
  // но возвращаем результат только нужного для текущей платформы.
  const webResult = useGeolocationWeb();
  const nativeResult = useGeolocationCapacitor();

  return IS_NATIVE ? nativeResult : webResult;
};

export default useGeolocation;
