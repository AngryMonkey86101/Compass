import { useEffect, useState } from 'react';
import Screen from './Screen';
import { goBack } from '../utils/router';
import { APP_URL } from '../config';
import qrUrl from '../assets/app-qr.svg';

const COPY_RESET_MS = 2000;

// QR-код со ссылкой на приложение: показать другу, чтобы он открыл Компас со своего телефона.
// Код — готовая картинка из scripts/generate-qr.mjs, экран работает без сети.
export default function QrScreen() {
  const [copyState, setCopyState] = useState('idle');
  const canShare = typeof navigator.share === 'function';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(APP_URL);
      setCopyState('done');
    } catch {
      setCopyState('error');
    }
  };

  // Надпись «Скопировано» возвращается к «Скопировать» через 2 с; при уходе с экрана таймер снимается
  useEffect(() => {
    if (copyState === 'idle') return undefined;
    const timer = setTimeout(() => setCopyState('idle'), COPY_RESET_MS);
    return () => clearTimeout(timer);
  }, [copyState]);

  const handleShare = () => {
    navigator.share({ title: 'Компас', url: APP_URL }).catch(() => {
      // меню закрыто пользователем или недоступно — ничего не делаем
    });
  };

  return (
    <Screen title="QR-код" backLabel="Назад в меню" onBack={() => goBack('menu')}>
      <section className="panel qr">
        <h2 className="label">Ссылка на приложение</h2>
        <img className="qr__code" src={qrUrl} alt={`QR-код со ссылкой ${APP_URL}`} width="296" height="296" />
        <p className="qr__url mono">{APP_URL.replace(/^https:\/\//, '').replace(/\/$/, '')}</p>
        <p className="screen__text tone-muted">Наведите камеру телефона на код, чтобы открыть Компас.</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={handleCopy}>
            {copyState === 'done' ? 'Скопировано' : 'Скопировать'}
          </button>
          {canShare && (
            <button type="button" className="btn btn--secondary" onClick={handleShare}>Поделиться</button>
          )}
        </div>
        {copyState === 'error' && (
          <p className="error" role="alert">Не удалось скопировать — выделите ссылку вручную</p>
        )}
      </section>
    </Screen>
  );
}
