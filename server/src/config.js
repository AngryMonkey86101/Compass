// Настройки сервера из переменных окружения (см. server/.env.example)

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const DEFAULT_ORIGINS = [
  'https://claude-compass.netlify.app',
  // Android-приложение (Capacitor) открывает страницу с этого адреса
  'https://localhost',
  // разработка и локальная проверка сборки
  'http://localhost:5173',
  'http://localhost:4173'
];

// Превью Netlify для pull request: https://deploy-preview-12--claude-compass.netlify.app
const PREVIEW_ORIGIN = /^https:\/\/deploy-preview-\d+--claude-compass\.netlify\.app$/;

function loadConfig(env = process.env) {
  const origins = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_ORIGINS;
  return {
    port: Number(env.PORT) || 8080,
    dbPath: env.DB_PATH || './data/compass.sqlite',
    allowedOrigins: new Set(origins),
    allowPreviewOrigins: env.ALLOW_PREVIEW_ORIGINS !== '0',
    // Адрес клиента берётся из X-Forwarded-For, только если сервер стоит за своим прокси (Caddy):
    // иначе этот заголовок подделывается и обходит ограничение частоты запросов
    trustProxy: env.TRUST_PROXY === '1'
  };
}

// Сроки и лимиты из плана (features-plan.md)
const LIMITS = {
  maxMembers: 15,
  maxPendingRequests: 15,
  positionTtl: 2 * HOUR,
  requestTtl: DAY,
  inviteTtl: DAY,
  groupInactivityTtl: 7 * DAY,
  cleanupInterval: MINUTE,
  maxBodyBytes: 16 * 1024
};

export { loadConfig, LIMITS, PREVIEW_ORIGIN, MINUTE, HOUR, DAY };
