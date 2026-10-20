import { useEffect, useRef } from 'react';

// Каркас вспомогательного экрана (меню, мануал, QR-код): заголовок с кнопкой назад.
// При открытии экран прокручивается к началу, фокус переходит на заголовок — экранный диктор
// объявит новый экран, а клавиатура начнёт с его начала.
export default function Screen({ title, backLabel, onBack, children, className = '' }) {
  const titleRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <main className={`app screen ${className}`}>
      <header className="status-bar screen__header">
        <div className="status-bar__brand">
          {onBack && (
            <button type="button" className="btn btn--icon btn--ghost" aria-label={backLabel} onClick={onBack}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </button>
          )}
          <h1 ref={titleRef} className="status-bar__title" tabIndex={-1}>{title}</h1>
        </div>
      </header>
      <div className="screen__body">{children}</div>
      <p className="version">Alpha-Claude v{import.meta.env.VITE_APP_VERSION}</p>
    </main>
  );
}
