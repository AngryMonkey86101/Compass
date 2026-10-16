import { useState, useId } from 'react';
import { accuracyTone } from '../utils/labels';

export default function CoordsPanel({ coords, isLoading, error, onSave }) {
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const nameId = useId();

  if (!coords) {
    return (
      <section className="panel" aria-label="Ваши координаты">
        <h2 className="label">Ваши координаты</h2>
        {error
          ? <p className="error" role="alert">{error}</p>
          : <p className="empty">{isLoading ? 'Поиск спутников GPS…' : 'Геолокация недоступна'}</p>}
      </section>
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
    <section className="panel" aria-label="Ваши координаты">
      <h2 className="label">Ваши координаты</h2>
      <span className="coords__value mono">{coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}</span>
      <span className={`label tone-${accuracyTone(coords.accuracy)}`}>
        Точность <span className="mono">±{Math.round(coords.accuracy)} м</span>
      </span>

      {isSaving ? (
        <form className="form" onSubmit={handleSave} aria-label="Сохранить текущее место">
          <label htmlFor={nameId} className="label field-label">Название места</label>
          <input
            id={nameId} className="field" type="text" placeholder="Например, Парковка"
            value={name} onChange={(e) => setName(e.target.value)} autoFocus
          />
          <div className="btn-row">
            <button type="submit" className="btn" disabled={!name.trim()}>Сохранить</button>
            <button type="button" className="btn btn--secondary" onClick={() => setIsSaving(false)}>Отмена</button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn--block" onClick={() => setIsSaving(true)}>
          Сохранить текущее место
        </button>
      )}
    </section>
  );
}
