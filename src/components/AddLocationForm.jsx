import { useState, useId } from 'react';
import { parseCoordinates } from '../utils/geoUtils';

export default function AddLocationForm({ onAdd, onCancel }) {
  const [name, setName] = useState('');
  const [coords, setCoords] = useState('');
  const [error, setError] = useState('');
  const nameId = useId();
  const coordsId = useId();
  const errorId = useId();

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Введите название точки');
      return;
    }
    const parsed = parseCoordinates(coords);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }

    onAdd(trimmed, parsed.lat, parsed.lon);
    setError('');
    setName('');
    setCoords('');
  };

  return (
    <form className="form" onSubmit={handleSubmit} noValidate aria-label="Новая точка">
      <label htmlFor={nameId} className="label field-label">Название</label>
      <input
        id={nameId} className="field" type="text" placeholder="Например, Дом"
        value={name} onChange={(e) => setName(e.target.value)} autoFocus
        aria-describedby={error ? errorId : undefined}
      />
      <label htmlFor={coordsId} className="label field-label">Широта, долгота</label>
      <input
        id={coordsId} className="field field--mono" type="text" placeholder="55.7535, 37.6210"
        inputMode="text" value={coords} onChange={(e) => setCoords(e.target.value)}
        aria-describedby={error ? errorId : undefined}
      />
      {error && <p id={errorId} role="alert" className="error">{error}</p>}
      <div className="btn-row">
        <button type="submit" className="btn">Добавить</button>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}
