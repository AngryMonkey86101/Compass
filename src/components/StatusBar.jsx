import { accuracyTone } from '../utils/labels';

// Верхняя строка: название и состояние GPS и датчика — только то, что известно из хуков
export default function StatusBar({ coords, isGeoLoading, geoError, isSensorOn, sensorError }) {
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
  else if (isSensorOn) sensor = { tone: 'ok', text: 'вкл' };
  else sensor = { tone: 'muted', text: 'выкл' };

  return (
    <header className="status-bar">
      <h1 className="status-bar__title">Компас</h1>
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
