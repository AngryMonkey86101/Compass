import { Capacitor } from '@capacitor/core';

// Приложение запущено как APK (Capacitor), а не в браузере. В APK обновления приходят через
// магазин, а не через сервис-воркер; установка на главный экран не нужна; файлы и блокировка
// экрана — через нативные плагины, потому что в Android WebView их веб-версии не работают.
export const isNativeApp = Capacitor.isNativePlatform();
