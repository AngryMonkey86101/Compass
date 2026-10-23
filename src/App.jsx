import Compass from './components/Compass';
import ErrorBoundary from './components/ErrorBoundary';
import UpdatePrompt from './components/UpdatePrompt';
import MainMenu from './components/MainMenu';
import ManualScreen from './components/ManualScreen';
import QrScreen from './components/QrScreen';
import SupportScreen from './components/SupportScreen';
import PrivacyScreen from './components/PrivacyScreen';
import GroupsScreen from './components/GroupsScreen';
import GroupScreen from './components/GroupScreen';
import JoinScreen from './components/JoinScreen';
import useRoute from './hooks/useRoute';
import { isNativeApp } from './utils/platform';
import { GROUPS_ENABLED } from './config';

const SCREENS = {
  menu: MainMenu,
  manual: ManualScreen,
  qr: QrScreen,
  support: SupportScreen,
  privacy: PrivacyScreen,
  // Группы — только когда задан адрес сервера (VITE_GROUPS_API_URL)
  ...(GROUPS_ENABLED ? { groups: GroupsScreen, group: GroupScreen, join: JoinScreen } : {})
};

// Экран выбирается по адресу (#/menu, #/manual…). Компас смонтирован всегда — на других
// экранах он скрыт, но GPS и датчик продолжают работать. Баннер обновления — вне обработчика
// сбоев: если новая версия исправляет сбой, кнопка «Обновить» должна оставаться доступной.
// Кнопка «Перезагрузить» на экране сбоя ожидающую версию не включает: при registerType 'prompt'
// сервис-воркер ждёт явного обновления. В APK сервис-воркер не регистрируется вовсе:
// новые версии приходят через магазин, а устаревший кэш мешал бы обновлению.
function App() {
  const route = useRoute();
  const Other = SCREENS[route];

  return (
    <>
      <ErrorBoundary>
        <Compass isFocus={route === 'focus'} hidden={Boolean(Other)} />
        {Other && <Other />}
      </ErrorBoundary>
      {!isNativeApp && <UpdatePrompt />}
    </>
  );
}

export default App;
