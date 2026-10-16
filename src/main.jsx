import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Шрифты локально (офлайн-PWA): только нужные начертания, латиница и кириллица
import '@fontsource/fira-sans-condensed/latin-500.css';
import '@fontsource/fira-sans-condensed/cyrillic-500.css';
import '@fontsource/fira-sans-condensed/latin-600.css';
import '@fontsource/fira-sans-condensed/cyrillic-600.css';
import '@fontsource/fira-sans-condensed/latin-700.css';
import '@fontsource/fira-sans-condensed/cyrillic-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/cyrillic-400.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import '@fontsource/jetbrains-mono/cyrillic-600.css';
import './index.css';

// Метка для диагностики запуска в index.html: скрипт приложения начал выполняться
window.__compassBoot = 'старт';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
window.__compassBoot = 'отрисовка запущена';
