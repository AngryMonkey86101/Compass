const EARTH_RADIUS_KM = 6371;
const toRadians = (deg) => (deg * Math.PI) / 180;

// Расстояние по дуге большого круга (формула гаверсинусов), в километрах
function calculateDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Человекочитаемая строка: «997 м» или «12.3 км»
function formatDistance(km) {
  const meters = Math.round(km * 1000);
  if (meters < 1000) return `${meters} м`;
  return `${km.toFixed(1)} км`;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
           Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);

  // % 360 нужен и для исключения результата ровно 360 из-за погрешности округления
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

function isValidCoordinates(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

// Разбирает строку «широта, долгота». Принимает десятичную точку или запятую
// («55.75, 37.62» и «55,75; 37,62»). Возвращает { lat, lon } или { error }.
function parseCoordinates(input) {
  const formatHint = 'Формат: «55.7535, 37.6210»';
  const text = String(input ?? '').trim();
  if (!text) return { error: 'Введите координаты. ' + formatHint };

  const numberPattern = /-?\d+(?:[.,]\d+)?/g;
  const matches = text.match(numberPattern) || [];
  const rest = text.replace(numberPattern, '');
  if (matches.length !== 2 || /[^\s,;]/.test(rest)) {
    return { error: 'Не удалось разобрать координаты. ' + formatHint };
  }

  const [lat, lon] = matches.map((m) => parseFloat(m.replace(',', '.')));
  if (lat < -90 || lat > 90) return { error: 'Широта должна быть от -90 до 90' };
  if (lon < -180 || lon > 180) return { error: 'Долгота должна быть от -180 до 180' };
  return { lat, lon };
}

export { calculateDistance, formatDistance, calculateBearing, isValidCoordinates, parseCoordinates };
