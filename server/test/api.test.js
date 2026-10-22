import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { openDatabase } from '../src/db.js';
import { loadConfig, LIMITS, HOUR, DAY } from '../src/config.js';
import { createApp, cleanup } from '../src/app.js';

// Проверка API через настоящий HTTP. Время подменено: сроки хранения проверяются без ожидания.
// Сервер не расшифровывает данные, поэтому «шифротексты» здесь — случайные base64url-строки.

let clock = Date.UTC(2026, 9, 22, 12, 0, 0);
const now = () => clock;
let db;
let server;
let base;

const id = () => randomBytes(16).toString('base64url');
const blob = (bytes = 48) => randomBytes(bytes).toString('base64url');

async function api(method, path, { token, body, headers = {}, origin } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(origin ? { Origin: origin } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

// Группа владельца и приглашение
async function createGroup() {
  const groupId = id();
  const ownerId = id();
  const created = await api('POST', '/api/v1/groups', {
    body: { groupId, memberId: ownerId, nameEnc: blob(), nickEnc: blob(), pub: blob(65) }
  });
  assert.equal(created.status, 201);
  return { groupId, ownerId, ownerToken: created.body.token };
}

async function joinApproved(group) {
  const invite = await api('POST', `/api/v1/groups/${group.groupId}/invites`, { token: group.ownerToken });
  const memberId = id();
  const join = await api('POST', '/api/v1/join', {
    body: { groupId: group.groupId, inviteId: invite.body.inviteId, keyVersion: invite.body.keyVersion, memberId, nickEnc: blob(), pub: blob(65) }
  });
  assert.equal(join.status, 202);
  const approve = await api('POST', `/api/v1/groups/${group.groupId}/requests/${memberId}/approve`, { token: group.ownerToken });
  assert.equal(approve.status, 204);
  const result = await api('GET', `/api/v1/join/${memberId}`, { headers: { 'X-Join-Secret': join.body.secret } });
  assert.equal(result.body.status, 'approved');
  return { memberId, token: result.body.token };
}

before(async () => {
  db = openDatabase(':memory:');
  server = createServer(createApp({ db, config: loadConfig({}), now }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
});

test('создание группы, приглашение, заявка, одобрение, позиции', async () => {
  const group = await createGroup();
  const invite = await api('POST', `/api/v1/groups/${group.groupId}/invites`, { token: group.ownerToken });
  assert.equal(invite.status, 201);

  const memberId = id();
  const join = await api('POST', '/api/v1/join', {
    body: { groupId: group.groupId, inviteId: invite.body.inviteId, keyVersion: 1, memberId, nickEnc: blob(), pub: blob(65) }
  });
  assert.equal(join.status, 202);

  // пока владелец не решил — «ожидает»; неверный секрет — как будто заявки нет
  const pending = await api('GET', `/api/v1/join/${memberId}`, { headers: { 'X-Join-Secret': join.body.secret } });
  assert.deepEqual(pending.body, { status: 'pending' });
  assert.equal((await api('GET', `/api/v1/join/${memberId}`, { headers: { 'X-Join-Secret': 'wrong' } })).status, 404);

  const ownerView = await api('GET', `/api/v1/groups/${group.groupId}`, { token: group.ownerToken });
  assert.equal(ownerView.body.requests.length, 1);
  assert.equal(ownerView.body.invites.length, 1);

  await api('POST', `/api/v1/groups/${group.groupId}/requests/${memberId}/approve`, { token: group.ownerToken });
  const approved = await api('GET', `/api/v1/join/${memberId}`, { headers: { 'X-Join-Secret': join.body.secret } });
  assert.equal(approved.body.status, 'approved');
  // токен выдаётся один раз
  assert.equal((await api('GET', `/api/v1/join/${memberId}`, { headers: { 'X-Join-Secret': join.body.secret } })).status, 404);

  const data = blob(90);
  const put = await api('PUT', `/api/v1/groups/${group.groupId}/position`, { token: approved.body.token, body: { data, keyVersion: 1 } });
  assert.equal(put.status, 200);
  const state = await api('GET', `/api/v1/groups/${group.groupId}`, { token: group.ownerToken });
  assert.equal(state.body.members.length, 2);
  assert.deepEqual(state.body.positions, [{ memberId, data, keyVersion: 1, receivedAt: clock }]);
  assert.equal(state.body.now, clock);

  // участник не видит заявки и приглашения и не может управлять группой
  const memberView = await api('GET', `/api/v1/groups/${group.groupId}`, { token: approved.body.token });
  assert.deepEqual(memberView.body.requests, []);
  assert.deepEqual(memberView.body.invites, []);
  assert.equal((await api('POST', `/api/v1/groups/${group.groupId}/invites`, { token: approved.body.token })).status, 403);

  // «перестать передавать» удаляет позицию сразу
  await api('DELETE', `/api/v1/groups/${group.groupId}/position`, { token: approved.body.token });
  assert.deepEqual((await api('GET', `/api/v1/groups/${group.groupId}`, { token: group.ownerToken })).body.positions, []);
});

test('чужой или неверный токен, чужая группа, плохие данные', async () => {
  const a = await createGroup();
  const b = await createGroup();
  assert.equal((await api('GET', `/api/v1/groups/${a.groupId}`)).status, 401);
  assert.equal((await api('GET', `/api/v1/groups/${a.groupId}`, { token: 'x'.repeat(43) })).status, 401);
  assert.equal((await api('GET', `/api/v1/groups/${a.groupId}`, { token: b.ownerToken })).status, 404);
  assert.equal((await api('PUT', `/api/v1/groups/${a.groupId}/position`, { token: a.ownerToken, body: { data: 'не base64!', keyVersion: 1 } })).status, 400);
  assert.equal((await api('POST', '/api/v1/groups', { body: { groupId: 'short' } })).status, 400);
  const huge = await api('PUT', `/api/v1/groups/${a.groupId}/position`, { token: a.ownerToken, body: { data: 'A'.repeat(20000), keyVersion: 1 } });
  assert.equal(huge.status, 413);
  // повтор идентификатора группы
  assert.equal((await api('POST', '/api/v1/groups', {
    body: { groupId: a.groupId, memberId: id(), nameEnc: blob(), nickEnc: blob(), pub: blob(65) }
  })).status, 409);
});

test('лимит 15 участников', async () => {
  const group = await createGroup();
  for (let i = 0; i < LIMITS.maxMembers - 1; i += 1) await joinApproved(group);
  const invite = await api('POST', `/api/v1/groups/${group.groupId}/invites`, { token: group.ownerToken });
  const extra = await api('POST', '/api/v1/join', {
    body: { groupId: group.groupId, inviteId: invite.body.inviteId, keyVersion: 1, memberId: id(), nickEnc: blob(), pub: blob(65) }
  });
  assert.equal(extra.status, 409);
  assert.equal(extra.body.error, 'group_full');
});

test('исключение со сменой ключа: старый токен — 401, старая версия ключа — 409', async () => {
  const group = await createGroup();
  const alice = await joinApproved(group);
  const bob = await joinApproved(group);
  await api('PUT', `/api/v1/groups/${group.groupId}/position`, { token: alice.token, body: { data: blob(), keyVersion: 1 } });

  // состав не совпадает (нет Боба) — отказ без изменений
  const incomplete = await api('POST', `/api/v1/groups/${group.groupId}/rotate`, {
    token: group.ownerToken,
    body: { removeMemberId: bob.memberId, keyVersion: 2, nameEnc: blob(), members: { [group.ownerId]: { nickEnc: blob() } } }
  });
  assert.equal(incomplete.status, 409);

  const wrapped = blob(60);
  const rotate = await api('POST', `/api/v1/groups/${group.groupId}/rotate`, {
    token: group.ownerToken,
    body: {
      removeMemberId: bob.memberId,
      keyVersion: 2,
      nameEnc: blob(),
      members: { [group.ownerId]: { nickEnc: blob() }, [alice.memberId]: { nickEnc: blob(), wrappedKey: wrapped } }
    }
  });
  assert.equal(rotate.status, 204);

  assert.equal((await api('GET', `/api/v1/groups/${group.groupId}`, { token: bob.token })).status, 401);
  const aliceView = await api('GET', `/api/v1/groups/${group.groupId}`, { token: alice.token });
  assert.equal(aliceView.body.group.keyVersion, 2);
  assert.deepEqual([aliceView.body.me.wrappedKey, aliceView.body.me.wrappedVersion], [wrapped, 2]);
  assert.deepEqual(aliceView.body.positions, []);
  assert.equal(aliceView.body.members.length, 2);

  const stale = await api('PUT', `/api/v1/groups/${group.groupId}/position`, { token: alice.token, body: { data: blob(), keyVersion: 1 } });
  assert.equal(stale.status, 409);
  assert.equal((await api('PUT', `/api/v1/groups/${group.groupId}/position`, { token: alice.token, body: { data: blob(), keyVersion: 2 } })).status, 200);

  // старые приглашения после смены ключа недействительны
  assert.deepEqual((await api('GET', `/api/v1/groups/${group.groupId}`, { token: group.ownerToken })).body.invites, []);
});

test('выход участника, отклонение заявки, удаление группы', async () => {
  const group = await createGroup();
  const alice = await joinApproved(group);
  assert.equal((await api('DELETE', `/api/v1/groups/${group.groupId}/members/me`, { token: group.ownerToken })).status, 400);
  assert.equal((await api('DELETE', `/api/v1/groups/${group.groupId}/members/me`, { token: alice.token })).status, 204);
  assert.equal((await api('GET', `/api/v1/groups/${group.groupId}`, { token: alice.token })).status, 401);

  const invite = await api('POST', `/api/v1/groups/${group.groupId}/invites`, { token: group.ownerToken });
  const memberId = id();
  const join = await api('POST', '/api/v1/join', {
    body: { groupId: group.groupId, inviteId: invite.body.inviteId, keyVersion: 1, memberId, nickEnc: blob(), pub: blob(65) }
  });
  await api('DELETE', `/api/v1/groups/${group.groupId}/requests/${memberId}`, { token: group.ownerToken });
  assert.equal((await api('GET', `/api/v1/join/${memberId}`, { headers: { 'X-Join-Secret': join.body.secret } })).status, 404);

  assert.equal((await api('DELETE', `/api/v1/groups/${group.groupId}`, { token: group.ownerToken })).status, 204);
  assert.equal((await api('GET', `/api/v1/groups/${group.groupId}`, { token: group.ownerToken })).status, 401);
});

test('сроки хранения: позиции 2 часа, приглашения и заявки сутки, группы 7 дней без активности', async () => {
  const group = await createGroup();
  const alice = await joinApproved(group);
  await api('PUT', `/api/v1/groups/${group.groupId}/position`, { token: alice.token, body: { data: blob(), keyVersion: 1 } });
  const invite = await api('POST', `/api/v1/groups/${group.groupId}/invites`, { token: group.ownerToken });

  clock += 2 * HOUR - 1000;
  assert.equal((await api('GET', `/api/v1/groups/${group.groupId}`, { token: group.ownerToken })).body.positions.length, 1);
  clock += 2000;
  // устаревшая позиция не отдаётся, даже если очистка ещё не прошла
  assert.equal((await api('GET', `/api/v1/groups/${group.groupId}`, { token: group.ownerToken })).body.positions.length, 0);
  assert.equal(cleanup(db, clock).positions >= 1, true);

  clock += DAY;
  const late = await api('POST', '/api/v1/join', {
    body: { groupId: group.groupId, inviteId: invite.body.inviteId, keyVersion: 1, memberId: id(), nickEnc: blob(), pub: blob(65) }
  });
  assert.equal(late.status, 410);

  // последняя активность — позиция Алисы; через 7 дней без новых позиций группа удаляется
  clock += 6 * DAY;
  cleanup(db, clock);
  assert.equal((await api('GET', `/api/v1/groups/${group.groupId}`, { token: group.ownerToken })).status, 401);
});

test('CORS: разрешённые адреса, превью Netlify, приложение Android; чужой сайт — без заголовков', async () => {
  const allowed = await api('OPTIONS', '/api/v1/groups', { origin: 'https://claude-compass.netlify.app' });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://claude-compass.netlify.app');
  assert.match(allowed.headers.get('access-control-allow-headers'), /Authorization/);
  const preview = await api('GET', '/api/v1/health', { origin: 'https://deploy-preview-7--claude-compass.netlify.app' });
  assert.equal(preview.headers.get('access-control-allow-origin'), 'https://deploy-preview-7--claude-compass.netlify.app');
  const android = await api('GET', '/api/v1/health', { origin: 'https://localhost' });
  assert.equal(android.headers.get('access-control-allow-origin'), 'https://localhost');
  const evil = await api('GET', '/api/v1/health', { origin: 'https://evil.example' });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
});
