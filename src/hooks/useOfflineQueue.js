import { useState, useEffect, useCallback } from 'react';

const QUEUE_KEY = 'offlineQueue';
const MAX_QUEUE_SIZE = 100; // Максимальное количество записей в очереди

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
  const [lastFlushError, setLastFlushError] = useState(null);

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
  }, [queue]);

  // Добавление данных в очередь
  const enqueue = useCallback((data) => {
    const item = {
      id: Date.now() + Math.random(),
      data,
      timestamp: Date.now(),
      type: 'position' // Можно расширить для разных типов данных
    };

    setQueue(prev => {
      // Удаляем старые записи если очередь переполнена
      const newQueue = [...prev, item];
      if (newQueue.length > MAX_QUEUE_SIZE) {
        return newQueue.slice(-MAX_QUEUE_SIZE);
      }
      return newQueue;
    });
  }, []);

  // Отправка очереди на сервер
  const flush = useCallback(async () => {
    if (queue.length === 0 || !isOnline || isFlushing) return;

    setIsFlushing(true);
    setLastFlushError(null);

    try {
      // TODO: Здесь будет реальная отправка на сервер (Supabase/WebSocket)
      // Пока просто имитируем успешную отправку
      console.log(`[OfflineQueue] Отправка ${queue.length} записей...`);

      // Имитация задержки сети
      await new Promise(resolve => setTimeout(resolve, 500));

      // Если бы был сервер, здесь был бы код отправки:
      // await supabase.from('positions').upsert(queue.map(item => item.data));

      console.log('[OfflineQueue] Успешно отправлено');
      setQueue([]); // Очищаем очередь после успешной отправки
    } catch (error) {
      console.error('[OfflineQueue] Ошибка отправки:', error);
      setLastFlushError(error.message);
    } finally {
      setIsFlushing(false);
    }
  }, [queue, isOnline, isFlushing]);

  // Периодическая попытка отправки (каждые 30 секунд)
  useEffect(() => {
    if (!isOnline || queue.length === 0) return;

    const interval = setInterval(() => {
      flush();
    }, 30000);

    return () => clearInterval(interval);
  }, [isOnline, queue.length, flush]);

  // Ручная очистка очереди
  const clearQueue = useCallback(() => {
    setQueue([]);
    localStorage.removeItem(QUEUE_KEY);
  }, []);

  return {
    queue,
    queueLength: queue.length,
    isOnline,
    isFlushing,
    lastFlushError,
    enqueue,
    flush,
    clearQueue
  };
};

export default useOfflineQueue;
