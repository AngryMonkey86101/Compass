import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Метка для диагностики запуска в index.html: скрипт приложения начал выполняться
window.__compassBoot = 'старт';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
window.__compassBoot = 'отрисовка запущена';
