import { accuracyTone } from '../utils/labels';

// Верхняя строка: кнопка меню, название и состояние GPS и датчика — только то, что известно из хуков
export default function StatusBar({ coords, isGeoLoading, geoError, isSensorOn, sensorError, onMenu }) {
  let gps;
  if (coords) {
    gps = { tone: accuracyTone(coords.accuracy), text: `±${Math.round(coords.accuracy)} м`, mono: true };
  } else if (geoError) {
    gps = { tone: 'danger', text: 'нет' };
  } else {
    gps = { tone: 'warn', text: isGeoLoading ? 'поиск' : 'нет' };
  }

  let sensor;
  if (sensorError) sensor = { tone: 'danger', text: 'ошибка' };
  // «вкл» — только выдано разрешение, а не «датчик работает» (на устройстве без магнитометра стрелка стоит),
  // поэтому нейтральный цвет, не зелёный
  else if (isSensorOn) sensor = { tone: 'neutral', text: 'вкл' };
  else sensor = { tone: 'muted', text: 'выкл' };

  return (
    <header className="status-bar">
      <div className="status-bar__brand">
        {onMenu && (
          <button type="button" className="btn btn--icon btn--ghost" aria-label="Главное меню" onClick={onMenu}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </button>
        )}
        <h1 className="status-bar__title">Компас</h1>
      </div>
      <div className="status-bar__items label">
        <span className={`status-item tone-${gps.tone}`}>
          <span className="status-item__dot" aria-hidden="true" />
          GPS <span className={gps.mono ? 'mono' : undefined}>{gps.text}</span>
        </span>
        <span className={`status-item tone-${sensor.tone}`}>
          Датчик {sensor.text}
        </span>
      </div>
    </header>
  );
}
