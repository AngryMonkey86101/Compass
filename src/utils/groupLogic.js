import { calculateDistance } from './geoUtils';

// Чистая логика групп без сети и хранилища: приглашения, решение об отправке позиции,
// возраст и свежесть данных. Отделена, чтобы проверяться тестами.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Позиция на сервере и в кэше телефона живёт 2 часа (features-plan.md)
const POSITION_TTL_MS = 2 * HOUR;

// Отправка своей позиции: при ходьбе раз в 30 с, при стоянии раз в 3 мин,
// и сразу — если сместился больше чем на 50 м
const SEND_MOVING_MS = 30 * 1000;
const SEND_STILL_MS = 3 * MINUTE;
const MOVING_METERS = 15;
const JUMP_METERS = 50;

const ID = /^[A-Za-z0-9_-]{22}$/;
const KEY = /^[A-Za-z0-9_-]{43}$/;

// Ссылка-приглашение: всё нужное — в части после «#», которую браузер не отправляет на сервер.
// Формат: <адрес>/#/join/<группа>.<приглашение>.<версия ключа>.<ключ>
function buildInviteLink(origin, { groupId, inviteId, keyVersion, key }) {
  return `${origin.replace(/\/+$/, '')}/#/join/${groupId}.${inviteId}.${keyVersion}.${key}`;
}

// Приглашение из ссылки или из вставленного текста (ссылку часто пересылают с подписью)
function parseInvite(text) {
  const match = /#\/join\/([A-Za-z0-9_.-]+)/.exec(String(text ?? '')) ?? /^([A-Za-z0-9_-]{22}\.[A-Za-z0-9_.-]+)$/.exec(String(text ?? '').trim());
  if (!match) return null;
  const [groupId, inviteId, version, key] = match[1].split('.');
  const keyVersion = Number(version);
  if (!ID.test(groupId ?? '') || !ID.test(inviteId ?? '') || !KEY.test(key ?? '') || !Number.isInteger(keyVersion) || keyVersion < 1) {
    return null;
  }
  return { groupId, inviteId, keyVersion, key };
}

// Пора ли отправить свою позицию. lastSent — { lat, lon, time } последней успешной отправки
function shouldSendPosition(lastSent, fix, now) {
  if (!fix) return false;
  if (!lastSent) return true;
  const meters = calculateDistance(lastSent.lat, lastSent.lon, fix.lat, fix.lon) * 1000;
  if (meters >= JUMP_METERS) return true;
  const interval = meters >= MOVING_METERS ? SEND_MOVING_MS : SEND_STILL_MS;
  return now - lastSent.time >= interval;
}

// Возраст позиции по часам сервера: offset = (время сервера − время телефона) при последнем
// ответе. Так сбитые часы телефона не превращают «2 мин назад» в «через час».
function positionAge(receivedAt, offset, now) {
  return Math.max(0, now + offset - receivedAt);
}

// fresh — до 2 мин, recent — до 15 мин, stale — до 2 ч, expired — позиции больше нет
function freshness(ageMs) {
  if (ageMs < 2 * MINUTE) return 'fresh';
  if (ageMs < 15 * MINUTE) return 'recent';
  if (ageMs < POSITION_TTL_MS) return 'stale';
  return 'expired';
}

function formatAge(ageMs) {
  const minutes = Math.floor(ageMs / MINUTE);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин назад` : `${hours} ч назад`;
}

// Инициалы для метки участника: «Вася Пупкин» → «ВП», «Вася» → «ВА»
function initials(nick) {
  const words = String(nick ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length > 1 ? words[0][0] + words[1][0] : Array.from(words[0]).slice(0, 2).join('');
  return letters.toUpperCase();
}

export {
  POSITION_TTL_MS, buildInviteLink, parseInvite, shouldSendPosition,
  positionAge, freshness, formatAge, initials
};
