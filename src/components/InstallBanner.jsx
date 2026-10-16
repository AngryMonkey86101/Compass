import useInstallPrompt from '../hooks/useInstallPrompt';

// Значок «Поделиться» iOS: квадрат со стрелкой вверх
const ShareIcon = () => (
  <svg className="install__icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 10H5v11h14V10h-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

// Предложение установить приложение на главный экран, чтобы оно открывалось без интерфейса браузера
export default function InstallBanner() {
  const { mode, promptInstall, dismiss } = useInstallPrompt();
  if (!mode) return null;

  return (
    <section className="panel install" aria-labelledby="install-title">
      <h2 id="install-title" className="label">Установка</h2>
      {mode === 'prompt' ? (
        <>
          <p className="install__text">Установите Компас: он будет открываться с главного экрана отдельным окном и работать без сети.</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={promptInstall}>Установить</button>
            <button type="button" className="btn btn--secondary" onClick={dismiss}>Не сейчас</button>
          </div>
        </>
      ) : (
        <>
          <p className="install__text">
            Чтобы открывать Компас без браузера: нажмите «Поделиться» <ShareIcon /> и выберите «На экран „Домой“».
          </p>
          <button type="button" className="btn btn--secondary btn--block" onClick={dismiss}>Понятно</button>
        </>
      )}
    </section>
  );
}
