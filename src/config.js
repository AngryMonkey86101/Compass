// Адрес опубликованного приложения: на него ведёт QR-код и кнопка «Поделиться».
// Задан явно, чтобы на превью Netlify и при локальном запуске код вёл на основной сайт.
export const APP_URL = 'https://claude-compass.netlify.app/';

// Адрес сервера групп (см. server/README.md). Задаётся при сборке переменной окружения
// VITE_GROUPS_API_URL, например https://compass-api.example.ru — домен пока не выбран.
// Пока адрес пустой, раздел «Группы» в приложении скрыт.
export const GROUPS_API_URL = (import.meta.env.VITE_GROUPS_API_URL ?? '').replace(/\/+$/, '');
export const GROUPS_ENABLED = GROUPS_API_URL !== '';
