// Лента событий в правом нижнем углу: последнее сообщение ярче, предыдущие тусклее
export default function EventFeed({ events }) {
  return (
    <div className="feed" role="status" aria-live="polite">
      {events.map((event) => (
        <span key={event.id} className={`feed__item feed__item--${event.tone}`}>{event.text}</span>
      ))}
    </div>
  );
}
