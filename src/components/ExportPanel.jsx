import { EXPORT_FORMATS } from '../utils/exportPoints';

const HINTS = {
  kml: 'Google Earth, My Maps, Яндекс',
  gpx: 'навигаторы',
  csv: 'Excel, таблицы',
  geojson: 'ГИС-программы'
};

// Выбор формата экспорта: каждый файл можно снова загрузить в Компас через «Импорт»
export default function ExportPanel({ count, onExport, onClose }) {
  return (
    <div className="import" role="region" aria-label="Экспорт точек">
      <p className="label">Экспорт · <span className="mono">{count}</span></p>
      <div className="export__formats">
        {Object.entries(EXPORT_FORMATS).map(([key, { label }]) => (
          <button key={key} type="button" className="btn btn--secondary export__format" onClick={() => onExport(key)}>
            <span>{label}</span>
            <span className="export__hint">{HINTS[key]}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--secondary btn--block" onClick={onClose}>Закрыть</button>
    </div>
  );
}
