import { useSyncExternalStore } from 'react';
import { subscribeRoute, currentRoute } from '../utils/router';

// Текущий экран из адреса страницы; перерисовка при переходах и кнопке «Назад»
const useRoute = () => useSyncExternalStore(subscribeRoute, currentRoute, () => 'nav');

export default useRoute;
