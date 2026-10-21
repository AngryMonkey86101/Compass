import { useState, useEffect } from 'react';
import { isNativeApp } from '../utils/platform';

const DISMISS_KEY = 'compassInstallHintDismissed';

// Приложение уже установлено: открыто с главного экрана (отдельным окном), это APK
// или обёртка TWA (её страницу открывает приложение Android — referrer android-app://…)
const isStandaloneNow = () =>
  isNativeApp ||
  document.referrer.startsWith('android-app://') ||
  (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
  window.navigator.standalone === true;

// iPhone, iPod и iPad; iPadOS в режиме «как на компьютере» представляется Mac с сенсорным экраном
const detectIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

// Предложение установить приложение:
// - Android/Chrome: системный диалог через событие beforeinstallprompt;
// - iOS: такого события нет — показываем подсказку «Поделиться → На экран „Домой“».
// mode: 'prompt' | 'ios' | null (null — уже установлено, скрыто пользователем или установка недоступна)
const useInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneNow);
  const [isDismissed, setIsDismissed] = useState(readDismissed);
  const [isIOS] = useState(detectIOS);

  useEffect(() => {
    const handleBeforeInstall = (event) => {
      event.preventDefault(); // не показывать мини-панель Chrome — предложим установку своей кнопкой
      setDeferredPrompt(event);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null;
    const handleDisplayMode = () => setIsInstalled(isStandaloneNow());

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    media?.addEventListener?.('change', handleDisplayMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
      media?.removeEventListener?.('change', handleDisplayMode);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      // событие одноразовое: после диалога его нельзя показать снова
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // хранилище недоступно — подсказка скрыта до перезагрузки
    }
  };

  let mode = null;
  if (!isInstalled && !isDismissed) {
    if (deferredPrompt) mode = 'prompt';
    else if (isIOS) mode = 'ios';
  }

  return { mode, promptInstall, dismiss };
};

export default useInstallPrompt;
