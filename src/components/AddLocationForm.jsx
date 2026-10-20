import { useState, useId } from 'react';
import { parseLocationText } from '../utils/locationText';

// Новая точка: координаты в любом из привычных видов или ссылка из Google Карт / Яндекс Карт.
// Если название не введено, берётся из ссылки (Google /maps/place/Название/…, geo:…?q=…(Название)).
export default function AddLocationForm({ onAdd, onCancel }) {
  const [name, setName] = useState('');
  const [coords, setCoords] = useState('');
  const [error, setError] = useState('');
  const nameId = useId();
  const coordsId = useId();
  const errorId = useId();
  const parsedId = useId();

  const parsed = coords.trim() ? parseLocationText(coords) : null;
  const recognized = parsed && parsed.lat !== undefined ? parsed : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = parseLocationText(coords);
    if (result.error) {
      setError(result.error);
      return;
    }
    const finalName = name.trim() || result.name?.trim() || '';
    if (!finalName) {
      setError('Введите название точки');
      return;
    }

    onAdd(finalName, result.lat, result.lon);
    setError('');
    setName('');
    setCoords('');
  };

  return (
    <form className="form" onSubmit={handleSubmit} noValidate aria-label="Новая точка">
      <label htmlFor={nameId} className="label field-label">Название</label>
      <input
        id={nameId} className="field" type="text"
        placeholder={recognized?.name ?? 'Например, Дом'}
        value={name} onChange={(e) => setName(e.target.value)} autoFocus
        aria-describedby={error ? errorId : undefined}
      />
      <label htmlFor={coordsId} className="label field-label">Координаты или ссылка</label>
      <input
        id={coordsId} className="field field--mono" type="text" placeholder="56.8380, 60.6035"
        inputMode="text" autoComplete="off" autoCapitalize="off" spellCheck={false}
        value={coords} onChange={(e) => { setCoords(e.target.value); setError(''); }}
        aria-describedby={[error ? errorId : '', recognized ? parsedId : ''].filter(Boolean).join(' ') || undefined}
      />
      {recognized && (
        <p id={parsedId} className="form__parsed mono" role="status">
          → {recognized.lat.toFixed(6)}, {recognized.lon.toFixed(6)}
        </p>
      )}
      {error && <p id={errorId} role="alert" className="error">{error}</p>}
      <div className="btn-row">
        <button type="submit" className="btn">Добавить</button>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}
