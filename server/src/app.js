import { createHash, randomBytes } from 'node:crypto';
import { transaction } from './db.js';
import { LIMITS, PREVIEW_ORIGIN } from './config.js';

// HTTP API групп. Без фреймворков: маршрутов мало, а каждая зависимость — это обновления
// и риски цепочки поставок на сервере, который обслуживается вручную.
//
// Идентификаторы группы и участника создаёт телефон (случайные 128 бит): они входят
// в дополнительные данные шифрования (AAD), поэтому должны быть известны до отправки.

const ID = /^[A-Za-z0-9_-]{22}$/;
const B64 = /^[A-Za-z0-9_-]+$/;
const SIZES = { nameEnc: 400, nickEnc: 300, data: 400, pub: 120, wrappedKey: 200, secret: 64 };

class HttpError extends Error {
  constructor(status, code, message) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

const sha256 = (text) => createHash('sha256').update(text).digest('base64url');
const newSecret = () => randomBytes(32).toString('base64url');
const newId = () => randomBytes(16).toString('base64url');

const isB64 = (value, max) => typeof value === 'string' && value.length >= 16 && value.length <= max && B64.test(value);

function requireId(value, field) {
  if (typeof value !== 'string' || !ID.test(value)) throw new HttpError(400, 'bad_request', `Неверный ${field}`);
  return value;
}

function requireB64(value, field) {
  if (!isB64(value, SIZES[field])) throw new HttpError(400, 'bad_request', `Неверное поле ${field}`);
  return value;
}

// Тело запроса — JSON до 16 КБ. Лишнее дочитывается без сохранения, чтобы клиент получил
// понятный ответ 413, а не оборванное соединение (Caddy дополнительно ограничивает размер).
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size <= LIMITS.maxBodyBytes) chunks.push(chunk);
    });
    req.on('end', () => {
      if (size > LIMITS.maxBodyBytes) return reject(new HttpError(413, 'too_large'));
      if (size === 0) return resolve({});
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
        resolve(body);
      } catch {
        reject(new HttpError(400, 'bad_json'));
      }
    });
    req.on('error', reject);
  });
}

// Ограничение частоты запросов (по участнику и мягкое — по адресу). Адрес живёт только
// в памяти этого процесса и не пишется в журналы.
function createRateLimiter(now) {
  const buckets = new Map();
  return (key, limit, windowMs) => {
    const time = now();
    const bucket = buckets.get(key);
    if (!bucket || time - bucket.start >= windowMs) {
      buckets.set(key, { start: time, count: 1 });
    } else if (bucket.count >= limit) {
      throw new HttpError(429, 'rate_limited', 'Слишком много запросов, попробуйте позже');
    } else {
      bucket.count += 1;
    }
    if (buckets.size > 50000) {
      for (const [k, b] of buckets) if (time - b.start >= windowMs) buckets.delete(k);
    }
  };
}

function createApp({ db, config, now = () => Date.now() }) {
  const limit = createRateLimiter(now);

  const q = {
    groupById: db.prepare('SELECT * FROM groups WHERE id = ?'),
    memberByToken: db.prepare('SELECT * FROM members WHERE token_hash = ?'),
    membersOf: db.prepare('SELECT id, nick_enc, pub, role FROM members WHERE group_id = ? ORDER BY joined_at'),
    countMembers: db.prepare('SELECT COUNT(*) AS n FROM members WHERE group_id = ?'),
    positionsOf: db.prepare('SELECT member_id, data, key_version, received_at FROM positions WHERE group_id = ?'),
    requestsOf: db.prepare("SELECT member_id, nick_enc, pub, created_at FROM requests WHERE group_id = ? AND status = 'pending' ORDER BY created_at"),
    countRequests: db.prepare("SELECT COUNT(*) AS n FROM requests WHERE group_id = ? AND status = 'pending'"),
    invitesOf: db.prepare('SELECT id, expires_at FROM invites WHERE group_id = ? AND expires_at > ? ORDER BY created_at'),
    insertGroup: db.prepare('INSERT INTO groups (id, name_enc, key_version, owner_id, created_at, last_activity) VALUES (?, ?, 1, ?, ?, ?)'),
    insertMember: db.prepare('INSERT INTO members (id, group_id, token_hash, pub, nick_enc, role, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    memberExists: db.prepare('SELECT 1 FROM members WHERE id = ? UNION SELECT 1 FROM requests WHERE member_id = ?'),
    touchGroup: db.prepare('UPDATE groups SET last_activity = ? WHERE id = ?'),
    upsertPosition: db.prepare(`INSERT INTO positions (member_id, group_id, data, key_version, received_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(member_id) DO UPDATE SET data = excluded.data, key_version = excluded.key_version, received_at = excluded.received_at`),
    deletePosition: db.prepare('DELETE FROM positions WHERE member_id = ?'),
    insertInvite: db.prepare('INSERT INTO invites (id, group_id, created_at, expires_at) VALUES (?, ?, ?, ?)'),
    inviteById: db.prepare('SELECT * FROM invites WHERE id = ? AND group_id = ?'),
    deleteInvite: db.prepare('DELETE FROM invites WHERE id = ? AND group_id = ?'),
    insertRequest: db.prepare("INSERT INTO requests (member_id, group_id, secret_hash, pub, nick_enc, created_at, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')"),
    requestById: db.prepare('SELECT * FROM requests WHERE member_id = ?'),
    approveRequest: db.prepare("UPDATE requests SET status = 'approved', member_token = ? WHERE member_id = ?"),
    deleteRequest: db.prepare('DELETE FROM requests WHERE member_id = ?'),
    deleteMember: db.prepare('DELETE FROM members WHERE id = ?'),
    deleteGroup: db.prepare('DELETE FROM groups WHERE id = ?'),
    rotateGroup: db.prepare('UPDATE groups SET key_version = ?, name_enc = ? WHERE id = ?'),
    rewrapMember: db.prepare('UPDATE members SET nick_enc = ?, wrapped_key = ?, wrapped_version = ? WHERE id = ?'),
    clearPositions: db.prepare('DELETE FROM positions WHERE group_id = ?'),
    clearInvites: db.prepare('DELETE FROM invites WHERE group_id = ?'),
    clearRequests: db.prepare('DELETE FROM requests WHERE group_id = ?')
  };

  // Участник по токену из заголовка Authorization: Bearer <token>; только в своей группе
  function authenticate(req, groupId) {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || token.length > 100) throw new HttpError(401, 'unauthorized');
    const member = q.memberByToken.get(sha256(token));
    if (!member) throw new HttpError(401, 'unauthorized', 'Вы больше не участник группы');
    if (member.group_id !== groupId) throw new HttpError(404, 'not_found');
    // основной лимит — по участнику: у мобильных операторов тысячи абонентов выходят
    // в интернет с одного IP-адреса, поэтому лимит по адресу сделан мягким
    limit(`member:${member.id}`, 120, 60 * 1000);
    const group = q.groupById.get(groupId);
    if (!group) throw new HttpError(404, 'not_found', 'Группа удалена');
    return { member, group };
  }

  function requireOwner(member) {
    if (member.role !== 'owner') throw new HttpError(403, 'forbidden', 'Только для владельца группы');
  }

  // Состояние группы для участника: участники, их зашифрованные позиции, а владельцу — заявки
  // и действующие приглашения. now — время сервера: по нему телефон считает возраст позиций.
  function groupState(group, member) {
    const time = now();
    const isOwner = member.role === 'owner';
    return {
      now: time,
      group: { id: group.id, nameEnc: group.name_enc, keyVersion: group.key_version, ownerId: group.owner_id },
      me: {
        id: member.id,
        role: member.role,
        wrappedKey: member.wrapped_version === group.key_version ? member.wrapped_key : null,
        wrappedVersion: member.wrapped_version === group.key_version ? member.wrapped_version : null
      },
      members: q.membersOf.all(group.id).map((m) => ({ id: m.id, nickEnc: m.nick_enc, pub: m.pub, role: m.role })),
      positions: q.positionsOf.all(group.id)
        .filter((p) => p.received_at > time - LIMITS.positionTtl)
        .map((p) => ({ memberId: p.member_id, data: p.data, keyVersion: p.key_version, receivedAt: p.received_at })),
      requests: isOwner
        ? q.requestsOf.all(group.id).map((r) => ({ id: r.member_id, nickEnc: r.nick_enc, pub: r.pub, createdAt: r.created_at }))
        : [],
      invites: isOwner ? q.invitesOf.all(group.id, time).map((i) => ({ id: i.id, expiresAt: i.expires_at })) : []
    };
  }

  const routes = [
    ['GET', /^\/api\/v1\/health$/, () => ({ status: 200, body: { ok: true, now: now() } })],

    // Создание группы: телефон присылает свои идентификаторы, зашифрованные название и ник,
    // открытый ключ устройства. В ответ — токен владельца (хранится только его хэш).
    ['POST', /^\/api\/v1\/groups$/, async ({ req, client }) => {
      limit(`create:${client}`, 200, 60 * 60 * 1000);
      const body = await readBody(req);
      const groupId = requireId(body.groupId, 'groupId');
      const memberId = requireId(body.memberId, 'memberId');
      const nameEnc = requireB64(body.nameEnc, 'nameEnc');
      const nickEnc = requireB64(body.nickEnc, 'nickEnc');
      const pub = requireB64(body.pub, 'pub');
      const token = newSecret();
      const time = now();
      transaction(db, () => {
        if (q.groupById.get(groupId) || q.memberExists.get(memberId, memberId)) {
          throw new HttpError(409, 'exists', 'Идентификатор уже занят');
        }
        q.insertGroup.run(groupId, nameEnc, memberId, time, time);
        q.insertMember.run(memberId, groupId, sha256(token), pub, nickEnc, 'owner', time);
      });
      return { status: 201, body: { token, keyVersion: 1, now: time } };
    }],

    ['GET', /^\/api\/v1\/groups\/([^/]+)$/, ({ req, params }) => {
      const { member, group } = authenticate(req, params[0]);
      return { status: 200, body: groupState(group, member) };
    }],

    // Своя позиция: зашифрованный блок ~150 байт. Устаревшая версия ключа — 409:
    // ключ сменили (кого-то исключили), телефон должен получить новый и зашифровать заново.
    ['PUT', /^\/api\/v1\/groups\/([^/]+)\/position$/, async ({ req, params }) => {
      const body = await readBody(req);
      const { member, group } = authenticate(req, params[0]);
      const data = requireB64(body.data, 'data');
      if (body.keyVersion !== group.key_version) {
        throw new HttpError(409, 'stale_key', 'Ключ группы сменился');
      }
      const time = now();
      q.upsertPosition.run(member.id, group.id, data, group.key_version, time);
      q.touchGroup.run(time, group.id);
      return { status: 200, body: { now: time } };
    }],

    // «Перестать передавать»: позиция удаляется сразу, а не через 2 часа
    ['DELETE', /^\/api\/v1\/groups\/([^/]+)\/position$/, ({ req, params }) => {
      const { member } = authenticate(req, params[0]);
      q.deletePosition.run(member.id);
      return { status: 204 };
    }],

    ['POST', /^\/api\/v1\/groups\/([^/]+)\/invites$/, ({ req, params }) => {
      const { member, group } = authenticate(req, params[0]);
      requireOwner(member);
      const id = newId();
      const time = now();
      const expiresAt = time + LIMITS.inviteTtl;
      q.insertInvite.run(id, group.id, time, expiresAt);
      return { status: 201, body: { inviteId: id, expiresAt, keyVersion: group.key_version } };
    }],

    ['DELETE', /^\/api\/v1\/groups\/([^/]+)\/invites\/([^/]+)$/, ({ req, params }) => {
      const { member, group } = authenticate(req, params[0]);
      requireOwner(member);
      q.deleteInvite.run(params[1], group.id);
      return { status: 204 };
    }],

    // Заявка на вступление по приглашению. Ответ — секрет, по которому новый участник
    // узнает решение владельца и получит свой токен.
    ['POST', /^\/api\/v1\/join$/, async ({ req, client }) => {
      limit(`join:${client}`, 300, 60 * 60 * 1000);
      const body = await readBody(req);
      const groupId = requireId(body.groupId, 'groupId');
      const inviteId = requireId(body.inviteId, 'inviteId');
      const memberId = requireId(body.memberId, 'memberId');
      const nickEnc = requireB64(body.nickEnc, 'nickEnc');
      const pub = requireB64(body.pub, 'pub');
      const time = now();
      const secret = newSecret();
      transaction(db, () => {
        const group = q.groupById.get(groupId);
        const invite = group && q.inviteById.get(inviteId, groupId);
        if (!invite || invite.expires_at <= time) {
          throw new HttpError(410, 'invite_expired', 'Приглашение недействительно или истекло');
        }
        if (body.keyVersion !== group.key_version) {
          throw new HttpError(410, 'invite_expired', 'Приглашение устарело');
        }
        if (q.countMembers.get(groupId).n >= LIMITS.maxMembers) {
          throw new HttpError(409, 'group_full', `В группе уже ${LIMITS.maxMembers} участников`);
        }
        if (q.countRequests.get(groupId).n >= LIMITS.maxPendingRequests) {
          throw new HttpError(409, 'too_many_requests', 'Слишком много заявок ждут решения');
        }
        if (q.memberExists.get(memberId, memberId)) throw new HttpError(409, 'exists', 'Идентификатор уже занят');
        q.insertRequest.run(memberId, groupId, sha256(secret), pub, nickEnc, time);
      });
      return { status: 202, body: { secret, expiresAt: time + LIMITS.requestTtl } };
    }],

    // Решение по заявке. Токен одобренного участника отдаётся один раз и сразу стирается.
    ['GET', /^\/api\/v1\/join\/([^/]+)$/, ({ req, params }) => {
      const secret = req.headers['x-join-secret'];
      const request = q.requestById.get(params[0]);
      if (!request || typeof secret !== 'string' || sha256(secret) !== request.secret_hash) {
        throw new HttpError(404, 'not_found', 'Заявка отклонена или истекла');
      }
      if (request.status !== 'approved') return { status: 200, body: { status: 'pending' } };
      q.deleteRequest.run(request.member_id);
      const group = q.groupById.get(request.group_id);
      return { status: 200, body: { status: 'approved', token: request.member_token, keyVersion: group.key_version } };
    }],

    ['POST', /^\/api\/v1\/groups\/([^/]+)\/requests\/([^/]+)\/approve$/, ({ req, params }) => {
      const { member, group } = authenticate(req, params[0]);
      requireOwner(member);
      const time = now();
      transaction(db, () => {
        const request = q.requestById.get(params[1]);
        if (!request || request.group_id !== group.id || request.status !== 'pending') {
          throw new HttpError(404, 'not_found', 'Заявка не найдена');
        }
        if (q.countMembers.get(group.id).n >= LIMITS.maxMembers) {
          throw new HttpError(409, 'group_full', `В группе уже ${LIMITS.maxMembers} участников`);
        }
        const token = newSecret();
        q.insertMember.run(request.member_id, group.id, sha256(token), request.pub, request.nick_enc, 'member', time);
        q.approveRequest.run(token, request.member_id);
        q.touchGroup.run(time, group.id);
      });
      return { status: 204 };
    }],

    ['DELETE', /^\/api\/v1\/groups\/([^/]+)\/requests\/([^/]+)$/, ({ req, params }) => {
      const { member, group } = authenticate(req, params[0]);
      requireOwner(member);
      const request = q.requestById.get(params[1]);
      if (request && request.group_id === group.id && request.status === 'pending') q.deleteRequest.run(params[1]);
      return { status: 204 };
    }],

    // Исключение участника со сменой ключа — одной транзакцией. Владелец присылает новую
    // версию ключа, заново зашифрованные название и ники и ключ, завёрнутый для каждого
    // оставшегося участника. Позиции, приглашения и заявки на старом ключе удаляются.
    ['POST', /^\/api\/v1\/groups\/([^/]+)\/rotate$/, async ({ req, params }) => {
      const body = await readBody(req);
      const { member, group } = authenticate(req, params[0]);
      requireOwner(member);
      const removeId = requireId(body.removeMemberId, 'removeMemberId');
      if (removeId === member.id) throw new HttpError(400, 'bad_request', 'Владелец не может исключить себя');
      if (body.keyVersion !== group.key_version + 1) throw new HttpError(409, 'stale_key', 'Ключ группы уже сменился');
      const nameEnc = requireB64(body.nameEnc, 'nameEnc');
      const updates = body.members;
      if (!updates || typeof updates !== 'object' || Array.isArray(updates)) throw new HttpError(400, 'bad_request');

      transaction(db, () => {
        const current = q.membersOf.all(group.id);
        if (!current.some((m) => m.id === removeId)) throw new HttpError(404, 'not_found', 'Участник не найден');
        const remaining = current.filter((m) => m.id !== removeId);
        const ids = Object.keys(updates);
        if (ids.length !== remaining.length || remaining.some((m) => !updates[m.id])) {
          throw new HttpError(409, 'members_changed', 'Состав группы изменился, обновите и повторите');
        }
        q.deleteMember.run(removeId);
        q.rotateGroup.run(body.keyVersion, nameEnc, group.id);
        for (const m of remaining) {
          const u = updates[m.id];
          const nickEnc = requireB64(u.nickEnc, 'nickEnc');
          const wrapped = m.id === member.id ? null : requireB64(u.wrappedKey, 'wrappedKey');
          q.rewrapMember.run(nickEnc, wrapped, wrapped ? body.keyVersion : null, m.id);
        }
        q.clearPositions.run(group.id);
        q.clearInvites.run(group.id);
        q.clearRequests.run(group.id);
      });
      return { status: 204 };
    }],

    // Выход из группы. Ключ при этом не меняется: ушедший участник его знает, но без токена
    // сервер ему ничего не отдаст. Владелец может только удалить группу целиком.
    ['DELETE', /^\/api\/v1\/groups\/([^/]+)\/members\/me$/, ({ req, params }) => {
      const { member } = authenticate(req, params[0]);
      if (member.role === 'owner') throw new HttpError(400, 'bad_request', 'Владелец может только удалить группу');
      q.deleteMember.run(member.id);
      return { status: 204 };
    }],

    ['DELETE', /^\/api\/v1\/groups\/([^/]+)$/, ({ req, params }) => {
      const { member, group } = authenticate(req, params[0]);
      requireOwner(member);
      q.deleteGroup.run(group.id);
      return { status: 204 };
    }]
  ];

  function corsHeaders(origin) {
    if (!origin) return {};
    const allowed = config.allowedOrigins.has(origin) || (config.allowPreviewOrigins && PREVIEW_ORIGIN.test(origin));
    if (!allowed) return {};
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Join-Secret',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin'
    };
  }

  function clientKey(req) {
    if (config.trustProxy) {
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress ?? 'unknown';
  }

  return async function handle(req, res) {
    const cors = corsHeaders(req.headers.origin);
    const send = (status, body) => {
      const headers = { ...cors, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
      if (body === undefined) {
        res.writeHead(status, headers);
        res.end();
      } else {
        res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(body));
      }
    };

    if (req.method === 'OPTIONS') return send(204);
    const path = (req.url ?? '/').split('?')[0];
    const client = clientKey(req);
    try {
      limit(`all:${client}`, 3000, 60 * 1000);
      for (const [method, pattern, handler] of routes) {
        const match = pattern.exec(path);
        if (!match || method !== req.method) continue;
        const result = await handler({ req, params: match.slice(1), client });
        return send(result.status, result.body);
      }
      throw new HttpError(404, 'not_found');
    } catch (err) {
      if (err instanceof HttpError) return send(err.status, { error: err.code, message: err.message });
      // В журнал — только тип и текст ошибки, без адреса клиента и содержимого запроса
      console.error('Ошибка сервера:', err?.name, err?.message);
      return send(500, { error: 'server_error' });
    }
  };
}

// Удаление устаревших данных: позиции — через 2 часа, заявки — через сутки, приглашения —
// по сроку, группы без активности — через 7 дней (участники и позиции удаляются каскадом)
function cleanup(db, time) {
  return transaction(db, () => ({
    positions: db.prepare('DELETE FROM positions WHERE received_at <= ?').run(time - LIMITS.positionTtl).changes,
    requests: db.prepare('DELETE FROM requests WHERE created_at <= ?').run(time - LIMITS.requestTtl).changes,
    invites: db.prepare('DELETE FROM invites WHERE expires_at <= ?').run(time).changes,
    groups: db.prepare('DELETE FROM groups WHERE last_activity <= ?').run(time - LIMITS.groupInactivityTtl).changes
  }));
}

export { createApp, cleanup, HttpError };
