import { useState, useId } from 'react';
import { parseCoordinates } from '../utils/geoUtils';

export default function AddLocationForm({ onAdd }) {
  const [name, setName] = useState('');
  const [coords, setCoords] = useState('');
  const [error, setError] = useState('');
  const nameId = useId();
  const coordsId = useId();

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
    <form className="card" onSubmit={handleSubmit} noValidate>
      <p className="card__title">Новая точка</p>
      <label htmlFor={nameId} className="visually-hidden">Название</label>
      <input
        id={nameId} className="field" type="text" placeholder="Название (напр. Дом)"
        value={name} onChange={(e) => setName(e.target.value)}
      />
      <label htmlFor={coordsId} className="visually-hidden">Широта и долгота</label>
      <input
        id={coordsId} className="field" type="text" placeholder="Широта, Долгота"
        inputMode="text" value={coords} onChange={(e) => setCoords(e.target.value)}
      />
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" className="btn">Добавить</button>
    </form>
  );
}
