import { useRegisterSW } from 'virtual:pwa-register/react';

// Новая версия не применяется сама, чтобы не перезагрузить страницу посреди навигации
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div className="update-banner" role="status">
      Доступна новая версия
      <button type="button" className="btn" onClick={() => updateServiceWorker(true)}>Обновить</button>
    </div>
  );
}
