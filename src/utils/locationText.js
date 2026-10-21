import { isValidCoordinates, parseCoordinates } from './geoUtils';

// Разбор координат из того, что пользователь копирует из карт: десятичные градусы,
// градусы-минуты-секунды и ссылки Google Карт, Яндекс Карт, Яндекс Навигатора, geo:.
// Порядок координат зависит от источника и легко перепутать незаметно (56.8/60.6 валидны
// в обоих порядках), поэтому он задан явно для каждого формата ссылки.

const FORMAT_HINT = 'Формат: «56.8380, 60.6035», «56°50′17″N 60°36′13″E» или ссылка на Google Карты / Яндекс Карты';
const SHORT_LINK_ERROR = 'Короткую ссылку (maps.app.goo.gl, yandex.ru/maps/-/…) браузер раскрыть не может. ' +
  'Откройте её, нажмите на точку и скопируйте координаты';
const NO_COORDS_IN_LINK = 'В ссылке нет координат. Откройте точку в картах и скопируйте её координаты';
const TOO_LONG_ERROR = 'Слишком длинный текст. Вставьте только координаты или ссылку';

// Ограничения длины: координаты и ссылки карт короче, а разбор очень длинного текста
// (например, ячейки CSV из чужого файла) не должен подвешивать приложение
const MAX_TEXT_LENGTH = 2000;
const MAX_DMS_LENGTH = 300;

const URL_PATTERN = /(?:https?:\/\/|yandexnavi:\/\/)[^\s<>"«»]+/i;
// geo: — до конца строки: метка в скобках может содержать пробелы («(Ганина Яма)»)
const GEO_PATTERN = /geo:[^\n]+/i;

// Хвостовая пунктуация после ссылки в тексте; «)» — только если скобка не парная.
// Скобки считаются один раз, затем хвост срезается за один проход.
const trimUrl = (url) => {
  const text = url.trim();
  let unbalanced = (text.split(')').length - 1) - (text.split('(').length - 1);
  let end = text.length;
  while (end > 0) {
    const ch = text[end - 1];
    if (ch === '.' || ch === ',' || ch === ';') {
      end -= 1;
    } else if (ch === ')' && unbalanced > 0) {
      end -= 1;
      unbalanced -= 1;
    } else {
      break;
    }
  }
  return text.slice(0, end);
};
const NUMBER = String.raw`[-+]?\d+(?:\.\d+)?`;
const PAIR_PATTERN = new RegExp(`^\\s*(${NUMBER})\\s*,\\s*(${NUMBER})`);

const point = (lat, lon, name) => {
  if (!isValidCoordinates(lat, lon)) return null;
  return name ? { lat, lon, name } : { lat, lon };
};

// «a,b» в начале строки (после ссылок значения вида «60.6,56.8,pm2rdm» или «56.8,60.6,15z»)
const numberPair = (value) => {
  const match = PAIR_PATTERN.exec(String(value ?? '').replace(/\+/g, ' '));
  return match ? [parseFloat(match[1]), parseFloat(match[2])] : null;
};

const latLon = (value) => {
  const pair = numberPair(value);
  return pair ? point(pair[0], pair[1]) : null;
};

const lonLat = (value) => {
  const pair = numberPair(value);
  return pair ? point(pair[1], pair[0]) : null;
};

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
};

const isYandexHost = (host) => /(^|\.)yandex\.[a-z.]+$/.test(host) || host === 'ya.ru';
const isGoogleHost = (host) => /(^|\.)google\.[a-z.]+$/.test(host);
const isShortLink = (url) =>
  url.host === 'maps.app.goo.gl' ||
  (url.host === 'goo.gl' && url.pathname.startsWith('/maps')) ||
  (isYandexHost(url.host) && /^\/(maps|navi)\/-\//.test(url.pathname));

// Яндекс: ll, pt и whatshere[point] — «долгота,широта»; rtext — «широта,долгота~…», берём конец маршрута.
// Приоритет: отмеченная точка (whatshere, pt) важнее конца маршрута, а он важнее центра карты (ll).
function fromYandex(params) {
  const whatshere = params.get('whatshere[point]');
  if (whatshere) return lonLat(whatshere);
  const pt = params.get('pt');
  if (pt) return lonLat(pt.split('~')[0]);
  const rtext = params.get('rtext');
  if (rtext) {
    const target = rtext.split('~').filter(Boolean).pop();
    const found = target && latLon(target);
    if (found) return found;
  }
  const ll = params.get('ll');
  return ll ? lonLat(ll) : null;
}

// Яндекс Навигатор: yandexnavi://show_point_on_map?lat=…&lon=…, build_route_on_map?lat_to=…&lon_to=…
function fromYandexNavi(params) {
  const lat = params.get('lat') ?? params.get('lat_to');
  const lon = params.get('lon') ?? params.get('lon_to');
  if (lat === null || lon === null) return null;
  return point(parseFloat(lat), parseFloat(lon));
}

// Google: все варианты — «широта,долгота». !3d…!4d… — координаты самого места,
// /@… — только центр экрана, поэтому он последний.
function fromGoogle(url) {
  const href = safeDecode(url.href);
  const segments = url.pathname.split('/').filter(Boolean).map(safeDecode);
  const placeIndex = segments.indexOf('place');
  // место, отмеченное щелчком по карте, называется своими координатами («56°50'16.8"N 60°…») — это не имя
  const placeName = placeIndex >= 0 && segments[placeIndex + 1] && !latLon(segments[placeIndex + 1]) &&
    !segments[placeIndex + 1].startsWith('@') && !segments[placeIndex + 1].includes('°')
    ? segments[placeIndex + 1].trim()
    : undefined;
  const named = (found) => (found && placeName ? { ...found, name: placeName } : found);

  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(href);
  if (pin) return named(point(parseFloat(pin[1]), parseFloat(pin[2])));

  for (const key of ['q', 'query', 'destination', 'daddr', 'll', 'center', 'sll']) {
    const value = url.searchParams.get(key);
    const found = value && latLon(value.replace(/^loc:/i, ''));
    if (found) return named(found);
  }

  // Маршрут /maps/dir/откуда/куда/@…: цель — последняя точка маршрута. Если она задана названием,
  // координат цели в ссылке нет: ни начало маршрута, ни центр экрана (@) ими не являются
  const dirIndex = segments.indexOf('dir');
  if (dirIndex >= 0) {
    const stops = segments.slice(dirIndex + 1).filter((s) => !s.startsWith('@') && !s.startsWith('data='));
    const target = stops.length ? parseCoordinates(stops[stops.length - 1]) : null;
    return target && target.lat !== undefined ? point(target.lat, target.lon) : null;
  }

  // /maps/search/56.8,+60.6, /maps/place/56.8,60.6 — последний сегмент с координатами
  const fromSegment = segments
    .filter((s) => !s.startsWith('@'))
    .map((s) => parseCoordinates(s))
    .filter((c) => c.lat !== undefined)
    .pop();
  if (fromSegment) return named(point(fromSegment.lat, fromSegment.lon));

  const at = segments.find((s) => s.startsWith('@'));
  return at ? named(latLon(at.slice(1))) : null;
}

// geo:56.8,60.6 или geo:0,0?q=56.8,60.6(Название) — так делятся точкой приложения Android
function fromGeoUri(text) {
  const body = text.slice(4);
  const [path, query = ''] = body.split('?');
  const q = new URLSearchParams(query).get('q');
  if (q) {
    const found = latLon(q);
    const label = /\(([^)]+)\)\s*$/.exec(q);
    if (found) return label ? { ...found, name: label[1].trim() } : found;
  }
  const found = latLon(path);
  return found && !(found.lat === 0 && found.lon === 0) ? found : null;
}

// Координаты из ссылки: { lat, lon, name? }, { error } для коротких ссылок или null
function parseMapUrl(text) {
  const raw = String(text ?? '').trim();
  if (raw.length > MAX_TEXT_LENGTH) return null;
  if (/^geo:/i.test(raw)) return fromGeoUri(raw);

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol === 'yandexnavi:') return fromYandexNavi(url.searchParams);
  const host = url.hostname.toLowerCase();
  if (isShortLink({ host, pathname: url.pathname })) return { error: SHORT_LINK_ERROR };
  if (isYandexHost(host)) return fromYandex(url.searchParams);
  if (isGoogleHost(host)) return fromGoogle(url);

  // OpenStreetMap: ?mlat=…&mlon=… или #map=zoom/lat/lon
  const mlat = url.searchParams.get('mlat');
  const mlon = url.searchParams.get('mlon');
  if (mlat !== null && mlon !== null) return point(parseFloat(mlat), parseFloat(mlon));
  const hashMap = /map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/.exec(url.hash);
  return hashMap ? point(parseFloat(hashMap[1]), parseFloat(hashMap[2])) : null;
}

// Градусы, минуты, секунды: 56°50'16.8"N 60°36'12.6"E, N 56°50.28' E 60°36.21', 56°50′17″ с.ш. 60°36′13″ в.д.,
// -33°52'10" 151°12'30". Буква полушария засчитывается, только если она не часть слова:
// в «Moscow 55°45′N» буква w относится к слову, а не к долготе. Символ перед буквой проверяется
// по индексу совпадения, а не ретроспективной проверкой (?<=…): её не понимает Safari до 16.4,
// и вся сборка перестала бы запускаться на старых iPhone.
const LETTER = /[A-Za-zА-Яа-яЁё]/;
const DMS_PART = /([NSEW])?\s*([-−]?)(\d+(?:\.\d+)?)\s*°(?:\s*(\d+(?:\.\d+)?)\s*')?(?:\s*(\d+(?:\.\d+)?)\s*")?(?:\s*([NSEW])(?![A-Za-zА-Яа-яЁё]))?/gi;

function parseDms(text) {
  if (String(text ?? '').length > MAX_DMS_LENGTH) return null;
  const normalized = String(text ?? '')
    .replace(/[′’‘`´]/g, "'")
    .replace(/[″”“]|''/g, '"')
    .replace(/с\.?\s*ш\.?/gi, 'N').replace(/ю\.?\s*ш\.?/gi, 'S')
    .replace(/в\.?\s*д\.?/gi, 'E').replace(/з\.?\s*д\.?/gi, 'W')
    .replace(/(\d),(\d)/g, '$1.$2');

  const parts = [];
  for (const match of normalized.matchAll(DMS_PART)) {
    const [, rawBefore = '', minus, deg, min = '0', sec = '0', after = ''] = match;
    // буква перед градусами — полушарие, только если перед ней не буква (иначе это конец слова)
    const before = rawBefore && match.index > 0 && LETTER.test(normalized[match.index - 1]) ? '' : rawBefore;
    const minutes = parseFloat(min);
    const seconds = parseFloat(sec);
    if (minutes >= 60 || seconds >= 60) return null;
    const value = parseFloat(deg) + minutes / 60 + seconds / 3600;
    parts.push({ value: minus ? -value : value, before: before.toUpperCase(), after: after.toUpperCase() });
  }
  if (parts.length !== 2) return null;
  // «N 40°45' W 73°59'»: буква W захватывается хвостом первой части, хотя относится ко второй
  if (parts[0].before && parts[0].after && !parts[1].before) {
    parts[1].before = parts[0].after;
    parts[0].after = '';
  }
  for (const p of parts) p.hemisphere = p.before || p.after;

  // Долгота может идти первой (E 60°… N 56°…): переставляем, если вторая часть — широта или без буквы
  let [first, second] = parts;
  const isLon = (p) => p.hemisphere === 'E' || p.hemisphere === 'W';
  if (isLon(first) && !isLon(second)) [first, second] = [second, first];
  // S и W делают значение отрицательным; явный минус без буквы тоже сохраняется
  const signed = (p) => (p.hemisphere === 'S' || p.hemisphere === 'W' ? -Math.abs(p.value) : p.value);
  return point(signed(first), signed(second));
}

// Главный разбор поля ввода: ссылка (в том числе внутри текста «Название — https://…»),
// десятичные градусы или градусы-минуты-секунды. Возвращает { lat, lon, name? } или { error }.
function parseLocationText(input) {
  const text = String(input ?? '').trim();
  if (!text) return { error: 'Введите координаты или вставьте ссылку. ' + FORMAT_HINT };
  if (text.length > MAX_TEXT_LENGTH) return { error: TOO_LONG_ERROR };

  const urlMatch = URL_PATTERN.exec(text) ?? GEO_PATTERN.exec(text);
  if (urlMatch) {
    const found = parseMapUrl(trimUrl(urlMatch[0]));
    if (found) return found;
    return { error: NO_COORDS_IN_LINK };
  }

  const plain = parseCoordinates(text);
  if (plain.lat !== undefined) return plain;
  if (/Широта|Долгота/.test(plain.error)) return plain;

  const dms = text.includes('°') ? parseDms(text) : null;
  if (dms) return dms;
  return { error: 'Не удалось разобрать координаты. ' + FORMAT_HINT };
}

export { parseMapUrl, parseDms, parseLocationText };
