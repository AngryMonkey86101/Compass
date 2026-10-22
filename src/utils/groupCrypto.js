// Сквозное шифрование групп на встроенном Web Crypto (без сторонних библиотек).
//
// - Ключ группы — AES-GCM 256. Создаётся на телефоне владельца и передаётся только
//   в приглашении (часть ссылки после «#», на сервер не уходит).
// - Каждый шифротекст привязан к контексту через дополнительные данные (AAD): группа,
//   участник, версия ключа. Сервер не может выдать позицию одного участника за позицию
//   другого или подсунуть ник из другой группы — расшифровка просто не пройдёт.
// - У каждого устройства своя пара ключей ECDH P-256. Когда владелец исключает участника,
//   новый ключ группы «заворачивается» для каждого оставшегося общим секретом ECDH.
//   Ключ для заворачивания получается прямо из ECDH (deriveKey → AES-GCM), без HKDF:
//   так работает и в старых Safari, где поддержка HKDF не гарантирована.
// Используются только возможности, доступные в Safari 13 и Android WebView.

const subtle = () => globalThis.crypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const IV_BYTES = 12;

function toB64(bytes) {
  let binary = '';
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < array.length; i += 1) binary += String.fromCharCode(array[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64(text) {
  const base64 = String(text).replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

// Случайный идентификатор (128 бит, 22 символа base64url): группа, участник, приглашение
const randomId = () => toB64(randomBytes(16));

// Контексты для AAD: шифротекст расшифруется только там, где был создан
const aad = {
  name: (groupId, version) => `name|${groupId}|v${version}`,
  nick: (groupId, memberId, version) => `nick|${groupId}|${memberId}|v${version}`,
  position: (groupId, memberId, version) => `pos|${groupId}|${memberId}|v${version}`,
  wrap: (groupId, memberId, version) => `wrap|${groupId}|${memberId}|v${version}`
};

async function generateGroupKey() {
  const key = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  return toB64(await subtle().exportKey('raw', key));
}

const importAesKey = (keyB64) =>
  subtle().importKey('raw', fromB64(keyB64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

async function encryptBytes(key, bytes, context) {
  const iv = randomBytes(IV_BYTES);
  const sealed = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(context) }, key, bytes);
  const out = new Uint8Array(IV_BYTES + sealed.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(sealed), IV_BYTES);
  return toB64(out);
}

async function decryptBytes(key, b64, context) {
  const data = fromB64(b64);
  const plain = await subtle().decrypt(
    { name: 'AES-GCM', iv: data.slice(0, IV_BYTES), additionalData: encoder.encode(context) },
    key,
    data.slice(IV_BYTES)
  );
  return new Uint8Array(plain);
}

// Объект → JSON → AES-GCM (новый случайный IV каждый раз) → base64url «IV‖шифротекст»
async function encryptJSON(keyB64, value, context) {
  return encryptBytes(await importAesKey(keyB64), encoder.encode(JSON.stringify(value)), context);
}

// null, если ключ не тот, данные повреждены или контекст (AAD) не совпадает
async function decryptJSON(keyB64, b64, context) {
  try {
    return JSON.parse(decoder.decode(await decryptBytes(await importAesKey(keyB64), b64, context)));
  } catch {
    return null;
  }
}

// Пара ключей устройства: открытый — в формате raw (65 байт), закрытый — JWK для localStorage
async function generateDeviceKeys() {
  const pair = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  return {
    pub: toB64(await subtle().exportKey('raw', pair.publicKey)),
    privJwk: await subtle().exportKey('jwk', pair.privateKey)
  };
}

async function sharedAesKey(privJwk, peerPubB64) {
  const [priv, pub] = await Promise.all([
    subtle().importKey('jwk', privJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']),
    subtle().importKey('raw', fromB64(peerPubB64), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  ]);
  return subtle().deriveKey({ name: 'ECDH', public: pub }, priv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// Новый ключ группы для участника: шифруется общим секретом владельца и участника
async function wrapGroupKey(ownerPrivJwk, memberPubB64, groupKeyB64, context) {
  return encryptBytes(await sharedAesKey(ownerPrivJwk, memberPubB64), fromB64(groupKeyB64), context);
}

// null, если ключ завёрнут не для этого устройства или не этим владельцем
async function unwrapGroupKey(myPrivJwk, ownerPubB64, wrappedB64, context) {
  try {
    return toB64(await decryptBytes(await sharedAesKey(myPrivJwk, ownerPubB64), wrappedB64, context));
  } catch {
    return null;
  }
}

export {
  toB64, fromB64, randomId, aad,
  generateGroupKey, encryptJSON, decryptJSON,
  generateDeviceKeys, wrapGroupKey, unwrapGroupKey
};
