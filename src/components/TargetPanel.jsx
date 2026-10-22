const NOTE_TONE = { fresh: 'tone-ok', recent: 'tone-warn', stale: 'tone-muted', expired: 'tone-danger' };

// Выбранная цель: буква-маркер (у участника группы — инициалы), название, дистанция крупно
// и азимут. note — для участника: группа и как давно обновлялась позиция
export default function TargetPanel({ location, label, distance, bearing, note, noteTone }) {
  if (!location) {
    return (
      <section className="panel" aria-label="Цель">
        <h2 className="label">Цель</h2>
        <p className="empty">Добавьте точку для навигации</p>
      </section>
    );
  }

  const [value, unit] = distance ? distance.split(' ') : ['—', ''];

  return (
    <section className="panel panel--active" aria-label="Цель">
      <h2 className="label">Цель</h2>
      <div className="target__name">
        <span className="marker marker--target" aria-hidden="true">{label}</span>
        <span>{location.name}</span>
      </div>
      {note && <p className={`target__note ${NOTE_TONE[noteTone] ?? 'tone-muted'}`}>{note}</p>}
      <div className="target__metrics">
        <span className="target__distance mono">
          {value}{unit && <span className="target__unit"> {unit}</span>}
        </span>
        <span className="target__bearing mono">
          АЗ {bearing === null ? '—' : `${String(Math.round(bearing) % 360).padStart(3, '0')}°`}
        </span>
      </div>
    </section>
  );
}
