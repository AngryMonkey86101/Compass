const PREVIEW_COUNT = 5;

const formatSize = (bytes) => (bytes < 1024 ? `${bytes} Б` : `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} КБ`);

const pluralPoints = (n) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'точка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'точки';
  return 'точек';
};

// Предпросмотр импорта: что найдено в файле, что пропущено и почему, подтверждение добавления
export default function ImportPanel({ status, fileName, fileSize, format, points, skipped, skipNotes, error, onConfirm, onCancel }) {
  if (status === 'idle') return null;

  return (
    <div className="import" role="region" aria-label="Импорт точек">
      <p className="label">
        Импорт{format ? ` ${format}` : ''} · <span className="import__file">{fileName}</span>
        {' '}<span className="import__size mono">{formatSize(fileSize)}</span>
      </p>

      {status === 'loading' && <p className="empty" role="status">Чтение файла…</p>}

      {status === 'error' && (
        <>
          <p className="error" role="alert">{error}</p>
          <button type="button" className="btn btn--secondary btn--block" onClick={onCancel}>Закрыть</button>
        </>
      )}

      {status === 'ready' && (
        <>
          <p className="import__summary">
            Найдено <span className="mono">{points.length}</span> {pluralPoints(points.length)}
            {skipped > 0 && <span className="tone-muted"> · пропущено <span className="mono">{skipped}</span></span>}
          </p>
          {skipNotes.length > 0 && (
            <ul className="import__preview tone-muted" aria-label="Пропущено">
              {skipNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          )}
          <ul className="import__preview">
            {points.slice(0, PREVIEW_COUNT).map((point) => (
              <li key={point.name}>{point.name}</li>
            ))}
            {points.length > PREVIEW_COUNT && (
              <li className="tone-muted">и ещё {points.length - PREVIEW_COUNT}</li>
            )}
          </ul>
          <p className="import__hint tone-muted">Точки с теми же названиями, что уже есть в списке, будут заменены.</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={onConfirm}>Добавить {points.length}</button>
            <button type="button" className="btn btn--secondary" onClick={onCancel}>Отмена</button>
          </div>
        </>
      )}
    </div>
  );
}
