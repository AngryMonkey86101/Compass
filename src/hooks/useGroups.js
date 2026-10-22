import { useSyncExternalStore } from 'react';
import { subscribe, getSnapshot } from '../utils/groupsStore';

// Состояние групп (см. utils/groupsStore.js): группы, участники, заявки, цель-участник
const useGroups = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

export default useGroups;
