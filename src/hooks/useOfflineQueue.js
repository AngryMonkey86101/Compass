import { useState, useEffect, useCallback } from 'react';
import { supabase, getDeviceId } from '../lib/supabase';

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
    setLastFlushError(null);
    try {
      console.log(`[OfflineQueue] Попытка отправки ${queue.length} записей...`);

      const deviceId = getDeviceId();
      const groupCode = localStorage.getItem('currentGroupCode') || 'default';
      const participantName = localStorage.getItem('participantName') || 'Аноним';

      // Берем только ПОСЛЕДНЮЮ позицию из очереди (самую актуальную)
      const lastItem = queue[queue.length - 1];
      const latestPosition = {
        group_code: groupCode,
        device_id: deviceId,
        participant_name: participantName,
        lat: lastItem.data.lat,
        lon: lastItem.data.lon,
        heading: lastItem.data.heading || null,
        accuracy: lastItem.data.accuracy || null,
        color: '#007AFF'
      };

      // Используем upsert с правильным onConflict
      const { error } = await supabase
        .from('positions')
        .upsert(latestPosition, {
          onConflict: 'device_id,group_code',
          ignoreDuplicates: false
        });

      if (error) throw error;

      console.log('[OfflineQueue] Успешно отправлено в Supabase');
      setQueue([]);
    } catch (error) {
      console.error('[OfflineQueue] Ошибка отправки:', error);
      throw error;
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
    lastFlushError,
    enqueue,
    flush
  };
};

export default useOfflineQueue;
