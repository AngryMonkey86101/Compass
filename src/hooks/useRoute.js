import { useSyncExternalStore } from 'react';
import { subscribeRoute, currentRoute, currentRouteParam } from '../utils/router';

// Текущий экран из адреса страницы; перерисовка при переходах и кнопке «Назад»
const useRoute = () => useSyncExternalStore(subscribeRoute, currentRoute, () => 'nav');

// Параметр экрана из адреса: id группы в #/group/<id>, приглашение в #/join/<…>
export const useRouteParam = () => useSyncExternalStore(subscribeRoute, currentRouteParam, () => '');

export default useRoute;
