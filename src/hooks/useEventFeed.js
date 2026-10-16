import { useState, useRef, useEffect, useCallback } from 'react';

const MAX_EVENTS = 3;
const EVENT_TTL_MS = 4000;

// Лента коротких сообщений («Точка добавлена»): живёт EVENT_TTL_MS, не больше MAX_EVENTS сразу.
// push вызывается из обработчиков действий пользователя, не из эффектов.
const useEventFeed = () => {
  const [events, setEvents] = useState([]);
  const timersRef = useRef(new Set());
  const nextIdRef = useRef(1);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);

  const push = useCallback((text, tone = 'default') => {
    const id = nextIdRef.current++;
    setEvents((prev) => [...prev, { id, text, tone }].slice(-MAX_EVENTS));
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      setEvents((prev) => prev.filter((event) => event.id !== id));
    }, EVENT_TTL_MS);
    timersRef.current.add(timer);
  }, []);

  return { events, push };
};

export default useEventFeed;
