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
// экранах он скрыт, но GPS и датчик продолжают работать.
function App() {
  const route = useRoute();
  const Other = SCREENS[route];

  return (
    <ErrorBoundary>
      <Compass isFocus={route === 'focus'} hidden={Boolean(Other)} />
      {Other && <Other />}
      <UpdatePrompt />
    </ErrorBoundary>
  );
}

export default App;
