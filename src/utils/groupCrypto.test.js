import { describe, it, expect } from 'vitest';
import {
  toB64, fromB64, randomId, aad, generateGroupKey, encryptJSON, decryptJSON,
  generateDeviceKeys, wrapGroupKey, unwrapGroupKey
} from './groupCrypto';

describe('base64url и идентификаторы', () => {
  it('туда и обратно, без «+», «/» и «=»', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const text = toB64(bytes);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Array.from(fromB64(text))).toEqual(Array.from(bytes));
  });

  it('случайный идентификатор — 22 символа, не повторяется', () => {
    const ids = new Set(Array.from({ length: 100 }, randomId));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
});

describe('шифрование данных группы', () => {
  it('расшифровка своим ключом и контекстом; позиция занимает ~150 байт', async () => {
    const key = await generateGroupKey();
    const position = { a: 56.838012, o: 60.603512, c: 12, t: 1761134400 };
    const sealed = await encryptJSON(key, position, aad.position('g', 'm', 1));
    expect(sealed.length).toBeLessThan(200);
    expect(await decryptJSON(key, sealed, aad.position('g', 'm', 1))).toEqual(position);
  });

  it('каждый раз новый IV: одинаковые данные дают разный шифротекст', async () => {
    const key = await generateGroupKey();
    const a = await encryptJSON(key, { n: 'Поход' }, aad.name('g', 1));
    const b = await encryptJSON(key, { n: 'Поход' }, aad.name('g', 1));
    expect(a).not.toBe(b);
  });

  it('чужой ключ, чужой участник, чужая версия или повреждение — null', async () => {
    const key = await generateGroupKey();
    const other = await generateGroupKey();
    const sealed = await encryptJSON(key, { a: 1 }, aad.position('g', 'alice', 1));
    expect(await decryptJSON(other, sealed, aad.position('g', 'alice', 1))).toBeNull();
    // сервер выдаёт позицию Алисы за позицию Боба — контекст не совпадает
    expect(await decryptJSON(key, sealed, aad.position('g', 'bob', 1))).toBeNull();
    expect(await decryptJSON(key, sealed, aad.position('g', 'alice', 2))).toBeNull();
    expect(await decryptJSON(key, sealed.slice(0, -4) + 'AAAA', aad.position('g', 'alice', 1))).toBeNull();
  });
});

describe('смена ключа: заворачивание для участников', () => {
  it('участник разворачивает ключ, завёрнутый для него владельцем; чужое устройство — нет', async () => {
    const owner = await generateDeviceKeys();
    const alice = await generateDeviceKeys();
    const mallory = await generateDeviceKeys();
    expect(fromB64(owner.pub)).toHaveLength(65);

    const newKey = await generateGroupKey();
    const wrapped = await wrapGroupKey(owner.privJwk, alice.pub, newKey, aad.wrap('g', 'alice', 2));
    expect(await unwrapGroupKey(alice.privJwk, owner.pub, wrapped, aad.wrap('g', 'alice', 2))).toBe(newKey);
    expect(await unwrapGroupKey(mallory.privJwk, owner.pub, wrapped, aad.wrap('g', 'alice', 2))).toBeNull();
    expect(await unwrapGroupKey(alice.privJwk, owner.pub, wrapped, aad.wrap('g', 'alice', 3))).toBeNull();
  });
});
