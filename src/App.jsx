import Compass from './components/Compass';
import ErrorBoundary from './components/ErrorBoundary';
import UpdatePrompt from './components/UpdatePrompt';
import MainMenu from './components/MainMenu';
import ManualScreen from './components/ManualScreen';
import QrScreen from './components/QrScreen';
import SupportScreen from './components/SupportScreen';
import useRoute from './hooks/useRoute';

const SCREENS = {
  menu: MainMenu,
  manual: ManualScreen,
  qr: QrScreen,
  support: SupportScreen
};

// Экран выбирается по адресу (#/menu, #/manual…). Компас смонтирован всегда — на других
// экранах он скрыт, но GPS и датчик продолжают работать. Баннер обновления — вне обработчика
// сбоев: если новая версия исправляет сбой, кнопка «Обновить» должна оставаться доступной.
// Кнопка «Перезагрузить» на экране сбоя ожидающую версию не включает: при registerType 'prompt'
// сервис-воркер ждёт явного обновления.
function App() {
  const route = useRoute();
  const Other = SCREENS[route];

  return (
    <>
      <ErrorBoundary>
        <Compass isFocus={route === 'focus'} hidden={Boolean(Other)} />
        {Other && <Other />}
      </ErrorBoundary>
      <UpdatePrompt />
    </>
  );
}

export default App;
