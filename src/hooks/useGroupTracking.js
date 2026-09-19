import { useState, useEffect } from 'react';
import { supabase, getDeviceId } from '../lib/supabase';

const useGroupTracking = () => {
  const [participants, setParticipants] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [isInGroup, setIsInGroup] = useState(() => !!localStorage.getItem('currentGroupCode'));
  const [error, setError] = useState(null);

  const groupCode = localStorage.getItem('currentGroupCode') || 'default';
  const deviceId = getDeviceId();

  // Подписка на изменения в таблице positions
  useEffect(() => {
    if (!isInGroup) return;

    // Загружаем текущих участников
    const loadParticipants = async () => {
      try {
        const { data, error } = await supabase
          .from('positions')
          .select('*')
          .eq('group_code', groupCode);

        if (error) throw error;

        // Группируем по device_id, берем последнюю запись для каждого
        const uniqueParticipants = data.reduce((acc, curr) => {
          const existing = acc.find(p => p.device_id === curr.device_id);
          if (!existing) {
            acc.push(curr);
          } else if (new Date(curr.updated_at) > new Date(existing.updated_at)) {
            const index = acc.findIndex(p => p.device_id === curr.device_id);
            acc[index] = curr;
          }
          return acc;
        }, []);

        setParticipants(uniqueParticipants);
      } catch (err) {
        setError(`Ошибка загрузки участников: ${err.message}`);
      }
    };

    loadParticipants();

    // Подписываемся на Realtime изменения
    const channel = supabase
      .channel(`group-${groupCode}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'positions', filter: `group_code=eq.${groupCode}` },
        () => {
          loadParticipants(); // Перезагружаем при любом изменении
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupCode, isInGroup]);

  // Переключение выбора участника
  const toggleParticipant = (deviceId) => {
    setSelectedParticipants(prev =>
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  // Выбрать всех
  const selectAll = () => {
    setSelectedParticipants(participants.map(p => p.device_id));
  };

  // Снять всех
  const deselectAll = () => {
    setSelectedParticipants([]);
  };

  return {
    participants,
    selectedParticipants,
    isInGroup,
    error,
    toggleParticipant,
    selectAll,
    deselectAll
  };
};

export default useGroupTracking;
