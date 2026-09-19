import { useState, useEffect, useCallback } from 'react';

const QUEUE_KEY = 'compassOfflineQueue';
const MAX_QUEUE_SIZE = 100;

const useOfflineQueue = () => {
  const [queue, setQueue] = useState(() => {
    try {
      const saved = localStorage.getItem(QUEUE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isFlushing, setIsFlushing] = useState(false);

  // Сохраняем очередь в localStorage при изменении
  useEffect(() => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }, [queue]);

  // Слушаем изменение статуса сети
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flush();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Добавление данных в очередь
  const enqueue = useCallback((data) => {
    const item = {
      id: Date.now() + Math.random(),
      data,
      timestamp: Date.now(),
      type: 'position'
    };

    setQueue(prev => {
      const newQueue = [...prev, item];
      if (newQueue.length > MAX_QUEUE_SIZE) {
        return newQueue.slice(-MAX_QUEUE_SIZE);
      }
      return newQueue;
    });
  }, []);

  // Отправка очереди на сервер (пока имитация)
  const flush = useCallback(async () => {
    if (queue.length === 0 || !isOnline || isFlushing) return;

    setIsFlushing(true);
    try {
      console.log(`[OfflineQueue] Попытка отправки ${queue.length} записей...`);

      // TODO: Здесь будет реальная отправка на сервер (например, Supabase)
      // await api.sendPositions(queue.map(item => item.data));

      // Имитация успешной отправки
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log('[OfflineQueue] Успешно отправлено');
      setQueue([]);
    } catch (error) {
      console.error('[OfflineQueue] Ошибка отправки:', error);
    } finally {
      setIsFlushing(false);
    }
  }, [queue, isOnline, isFlushing]);

  // Периодическая попытка отправки при наличии сети
  useEffect(() => {
    if (!isOnline || queue.length === 0) return;

    const interval = setInterval(() => {
      flush();
    }, 15000); // Попытка каждые 15 секунд

    return () => clearInterval(interval);
  }, [isOnline, queue.length, flush]);

  return {
    queue,
    queueLength: queue.length,
    isOnline,
    isFlushing,
    enqueue,
    flush
  };
};

export default useOfflineQueue;
