// Генерирует src/assets/app-qr.svg — QR-код со ссылкой на приложение (адрес из src/config.js).
// Запуск: npm run qr. Результат хранится в репозитории: в приложении библиотека QR не нужна,
// экран с кодом работает без сети.
import { writeFileSync } from 'node:fs';
import QRCode from 'qrcode';
import { APP_URL } from '../src/config.js';

const svg = await QRCode.toString(APP_URL, {
  type: 'svg',
  errorCorrectionLevel: 'M',
  margin: 4,
  color: { dark: '#0d1820', light: '#ffffff' }
});
const target = new URL('../src/assets/app-qr.svg', import.meta.url);
writeFileSync(target, svg);
console.log(`QR-код для ${APP_URL} сохранён в src/assets/app-qr.svg`);
