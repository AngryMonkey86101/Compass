import { useState, useId } from 'react';

const getAccuracyColor = (acc) => {
  if (!acc) return '#6c6c70';
  if (acc <= 15) return '#1f8a3b';
  if (acc <= 50) return '#b35c00';
  return '#d70015';
};

export default function CoordsPanel({ coords, isLoading, onSave }) {
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const nameId = useId();

  if (!coords) {
    return (
      <p className="muted">
        {isLoading ? 'Поиск спутников GPS...' : 'Геолокация недоступна'}
      </p>
    );
  }

  const handleSave = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, coords.lat, coords.lon);
    setName('');
    setIsSaving(false);
  };

  return (
    <>
      <p className="muted">Ваши координаты</p>
      <p className="coords">{coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}</p>
      <p className="accuracy" style={{ color: getAccuracyColor(coords.accuracy) }}>
        Точность: {Math.round(coords.accuracy)} м
      </p>

      {isSaving ? (
        <form className="card" onSubmit={handleSave}>
          <label htmlFor={nameId} className="visually-hidden">Название текущего места</label>
          <input
            id={nameId} className="field" type="text" placeholder="Название текущего места"
            value={name} onChange={(e) => setName(e.target.value)} autoFocus
          />
          <button type="submit" className="btn" disabled={!name.trim()}>Сохранить</button>
          <button type="button" className="btn btn--danger" onClick={() => setIsSaving(false)}>
            Отмена
          </button>
        </form>
      ) : (
        <button type="button" className="btn" style={{ maxWidth: 340 }} onClick={() => setIsSaving(true)}>
          + Сохранить текущее место
        </button>
      )}
    </>
  );
}
