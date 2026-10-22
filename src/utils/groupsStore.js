import { groupsApi, ApiError } from './groupsApi';
import {
  randomId, aad, generateGroupKey, encryptJSON, decryptJSON, generateDeviceKeys, wrapGroupKey, unwrapGroupKey
} from './groupCrypto';
import { POSITION_TTL_MS, shouldSendPosition, positionAge } from './groupLogic';

// Состояние групп на телефоне и действия с ними. Внешнее хранилище для useSyncExternalStore:
// его читают и компас (участник как цель), и экраны групп.
//
// В localStorage:
// - compassGroups — ключи устройства, ник, группы (токен, роль, ключи группы, «передавать ли»),
//   заявки на вступление, согласие на передачу;
// - compassGroupsCache — последнее состояние групп (расшифрованное) для работы без сети;
//   позиции старше 2 часов отбрасываются.

const STORAGE_KEY = 'compassGroups';
const CACHE_KEY = 'compassGroupsCache';

const emptyState = () => ({ device: null, nickname: '', groups: {}, pending: {}, consentGiven: false });

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // хранилище недоступно или переполнено — группы работают до перезапуска
  }
}

let persisted = { ...emptyState(), ...readJson(STORAGE_KEY, {}) };
// views[groupId]: { name, members, positions, requests, invites, offset, syncedAt, status }
let views = readJson(CACHE_KEY, {});
let notices = [];
let target = null;
let latestFix = null;
const lastSent = {};
const sendStatus = {};

const listeners = new Set();
let snapshot = null;

function buildSnapshot() {
  snapshot = {
    nickname: persisted.nickname,
    consentGiven: persisted.consentGiven,
    groups: Object.values(persisted.groups).map((g) => ({
      groupId: g.groupId,
      memberId: g.memberId,
      role: g.role,
      name: views[g.groupId]?.name || g.name || 'Группа',
      sharing: Boolean(g.sharing),
      view: views[g.groupId] ?? null,
      send: sendStatus[g.groupId] ?? null
    })),
    pending: Object.values(persisted.pending).map((p) => ({ memberId: p.memberId, groupName: p.groupName, createdAt: p.createdAt })),
    notices,
    target,
    fix: latestFix
  };
}

function emit() {
  buildSnapshot();
  listeners.forEach((listener) => listener());
}

function save() {
  writeJson(STORAGE_KEY, persisted);
}

function saveCache() {
  writeJson(CACHE_KEY, views);
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  if (!snapshot) buildSnapshot();
  return snapshot;
}

function addNotice(text) {
  notices = [...notices.slice(-4), { id: Date.now() + Math.random(), text }];
  emit();
}

function dismissNotice(id) {
  notices = notices.filter((n) => n.id !== id);
  emit();
}

async function ensureDevice() {
  if (!persisted.device) {
    persisted = { ...persisted, device: await generateDeviceKeys() };
    save();
  }
  return persisted.device;
}

function setNickname(nickname) {
  persisted = { ...persisted, nickname: String(nickname).trim().slice(0, 40) };
  save();
  emit();
}

function giveConsent() {
  persisted = { ...persisted, consentGiven: true };
  save();
  emit();
}

function updateGroup(groupId, patch) {
  const group = persisted.groups[groupId];
  if (!group) return;
  persisted = { ...persisted, groups: { ...persisted.groups, [groupId]: { ...group, ...patch } } };
  save();
}

function removeGroupLocal(groupId, notice) {
  const { [groupId]: removed, ...rest } = persisted.groups;
  if (!removed) return;
  persisted = { ...persisted, groups: rest };
  const { [groupId]: _view, ...otherViews } = views;
  views = otherViews;
  delete lastSent[groupId];
  delete sendStatus[groupId];
  if (target?.groupId === groupId) target = null;
  save();
  saveCache();
  if (notice) addNotice(notice);
  else emit();
}

const keyOf = (group, version = group.keyVersion) => group.keys?.[version];

// ---------- Создание и вступление ----------

async function createGroup(name) {
  const device = await ensureDevice();
  const groupId = randomId();
  const memberId = randomId();
  const key = await generateGroupKey();
  const nick = persisted.nickname || 'Я';
  const res = await groupsApi.createGroup({
    groupId,
    memberId,
    nameEnc: await encryptJSON(key, { n: name }, aad.name(groupId, 1)),
    nickEnc: await encryptJSON(key, { n: nick }, aad.nick(groupId, memberId, 1)),
    pub: device.pub
  });
  persisted = {
    ...persisted,
    groups: {
      ...persisted.groups,
      [groupId]: { groupId, memberId, token: res.token, role: 'owner', keyVersion: 1, keys: { 1: key }, name, sharing: false }
    }
  };
  save();
  emit();
  await syncGroup(groupId);
  return groupId;
}

// Заявка по приглашению. Ник шифруется ключом из приглашения, поэтому сервер его не видит.
async function requestJoin(invite) {
  if (persisted.groups[invite.groupId]) return { already: true };
  const device = await ensureDevice();
  const memberId = randomId();
  const nick = persisted.nickname || 'Без имени';
  const res = await groupsApi.join({
    groupId: invite.groupId,
    inviteId: invite.inviteId,
    keyVersion: invite.keyVersion,
    memberId,
    nickEnc: await encryptJSON(invite.key, { n: nick }, aad.nick(invite.groupId, memberId, invite.keyVersion)),
    pub: device.pub
  });
  persisted = {
    ...persisted,
    pending: {
      ...persisted.pending,
      [memberId]: { ...invite, memberId, secret: res.secret, createdAt: Date.now(), groupName: '' }
    }
  };
  save();
  emit();
  return { already: false };
}

function cancelJoin(memberId) {
  const { [memberId]: _removed, ...rest } = persisted.pending;
  persisted = { ...persisted, pending: rest };
  save();
  emit();
}

async function checkPending() {
  for (const p of Object.values(persisted.pending)) {
    try {
      const res = await groupsApi.joinStatus(p.memberId, p.secret);
      if (res.status !== 'approved') continue;
      cancelJoin(p.memberId);
      persisted = {
        ...persisted,
        groups: {
          ...persisted.groups,
          [p.groupId]: {
            groupId: p.groupId, memberId: p.memberId, token: res.token, role: 'member',
            keyVersion: p.keyVersion, keys: { [p.keyVersion]: p.key }, name: '', sharing: false
          }
        }
      };
      save();
      await syncGroup(p.groupId);
      addNotice(`Вас приняли в группу «${views[p.groupId]?.name ?? 'Группа'}»`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        cancelJoin(p.memberId);
        addNotice('Заявка на вступление отклонена или истекла');
      }
      // нет сети — проверим в следующий раз
    }
  }
}

// ---------- Синхронизация ----------

function lostAccess(groupId) {
  const name = views[groupId]?.name || persisted.groups[groupId]?.name || 'Группа';
  removeGroupLocal(groupId, `Группа «${name}» недоступна: вас исключили или группа удалена (в том числе после 7 дней без активности)`);
}

// Новый ключ после исключения кого-то из группы: завёрнут владельцем для этого устройства
async function adoptRotatedKey(group, state) {
  const version = state.group.keyVersion;
  if (version <= group.keyVersion || keyOf(group, version)) return group;
  const owner = state.members.find((m) => m.role === 'owner');
  if (!owner || !state.me.wrappedKey || state.me.wrappedVersion !== version) return group;
  const key = await unwrapGroupKey(persisted.device.privJwk, owner.pub, state.me.wrappedKey, aad.wrap(group.groupId, group.memberId, version));
  if (!key) return group;
  updateGroup(group.groupId, { keyVersion: version, keys: { [version]: key } });
  return persisted.groups[group.groupId];
}

async function syncGroup(groupId) {
  let group = persisted.groups[groupId];
  if (!group) return;
  let state;
  try {
    state = await groupsApi.getGroup(groupId, group.token);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 404)) return lostAccess(groupId);
    views = { ...views, [groupId]: { ...views[groupId], status: err.code === 'network' ? 'offline' : 'error' } };
    emit();
    return;
  }

  group = await adoptRotatedKey(group, state);
  const version = state.group.keyVersion;
  const key = keyOf(group, version);
  const decrypt = (b64, context) => (key ? decryptJSON(key, b64, context) : Promise.resolve(null));

  const name = (await decrypt(state.group.nameEnc, aad.name(groupId, version)))?.n ?? '';
  const members = await Promise.all(state.members.map(async (m) => ({
    id: m.id,
    role: m.role,
    pub: m.pub,
    nick: (await decrypt(m.nickEnc, aad.nick(groupId, m.id, version)))?.n ?? '—'
  })));
  const positions = {};
  for (const p of state.positions) {
    const pKey = keyOf(group, p.keyVersion);
    const data = pKey ? await decryptJSON(pKey, p.data, aad.position(groupId, p.memberId, p.keyVersion)) : null;
    if (data) positions[p.memberId] = { lat: data.a, lon: data.o, acc: data.c, fixTime: data.t, receivedAt: p.receivedAt };
  }
  const requests = await Promise.all(state.requests.map(async (r) => ({
    id: r.id,
    createdAt: r.createdAt,
    nick: (await decrypt(r.nickEnc, aad.nick(groupId, r.id, version)))?.n ?? '—'
  })));

  views = {
    ...views,
    [groupId]: {
      name,
      members,
      positions,
      requests,
      invites: state.invites,
      offset: state.now - Date.now(),
      syncedAt: Date.now(),
      status: key ? 'ok' : 'no_key'
    }
  };
  if (name && name !== group.name) updateGroup(groupId, { name });
  saveCache();
  emit();
}

// Позиции старше 2 часов не показываются и удаляются из кэша
function pruneExpired() {
  const now = Date.now();
  let changed = false;
  const next = {};
  for (const [groupId, view] of Object.entries(views)) {
    const positions = {};
    for (const [memberId, p] of Object.entries(view.positions ?? {})) {
      if (positionAge(p.receivedAt, view.offset ?? 0, now) < POSITION_TTL_MS) positions[memberId] = p;
      else changed = true;
    }
    next[groupId] = { ...view, positions };
  }
  if (changed) {
    views = next;
    saveCache();
    emit();
  }
}

let syncing = false;

async function syncAll() {
  if (syncing) return;
  syncing = true;
  try {
    await checkPending();
    for (const groupId of Object.keys(persisted.groups)) await syncGroup(groupId);
    pruneExpired();
  } finally {
    syncing = false;
  }
}

// ---------- Передача своей позиции ----------

function reportFix(coords) {
  latestFix = coords ? { lat: coords.lat, lon: coords.lon, acc: coords.accuracy, time: Date.now() } : null;
  emit();
}

let sending = false;

// Отправляет позицию в группы, где включена передача, если пора (см. shouldSendPosition).
// Без связи ничего не копится: в следующий раз уйдёт самая свежая точка.
async function sendPositions() {
  if (sending || !latestFix) return;
  sending = true;
  try {
    for (const group of Object.values(persisted.groups)) {
      if (!group.sharing) continue;
      const now = Date.now();
      if (!shouldSendPosition(lastSent[group.groupId], latestFix, now)) continue;
      const fix = latestFix;
      const send = async (g) => groupsApi.putPosition(g.groupId, g.token, {
        keyVersion: g.keyVersion,
        data: await encryptJSON(keyOf(g), {
          a: Number(fix.lat.toFixed(6)),
          o: Number(fix.lon.toFixed(6)),
          c: Math.round(fix.acc ?? 0),
          t: Math.round(fix.time / 1000)
        }, aad.position(g.groupId, g.memberId, g.keyVersion))
      });
      try {
        try {
          await send(group);
        } catch (err) {
          // ключ сменился — получаем новый и шифруем заново
          if (!(err instanceof ApiError) || err.status !== 409) throw err;
          await syncGroup(group.groupId);
          const fresh = persisted.groups[group.groupId];
          if (!fresh || !keyOf(fresh)) throw err;
          await send(fresh);
        }
        lastSent[group.groupId] = { lat: fix.lat, lon: fix.lon, time: now };
        sendStatus[group.groupId] = { ok: true, at: now };
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          lostAccess(group.groupId);
          continue;
        }
        sendStatus[group.groupId] = { ok: false, at: sendStatus[group.groupId]?.at ?? null, offline: err.code === 'network' };
      }
      emit();
    }
  } finally {
    sending = false;
  }
}

async function setSharing(groupId, on) {
  const group = persisted.groups[groupId];
  if (!group) return;
  updateGroup(groupId, { sharing: on });
  delete lastSent[groupId];
  if (!on) {
    delete sendStatus[groupId];
    emit();
    // позиция удаляется с сервера сразу, а не через 2 часа
    await groupsApi.deletePosition(groupId, group.token).catch(() => {});
    await syncGroup(groupId);
    return;
  }
  emit();
  await sendPositions();
}

// ---------- Управление группой (владелец) ----------

async function createInvite(groupId) {
  const group = persisted.groups[groupId];
  const res = await groupsApi.createInvite(groupId, group.token);
  await syncGroup(groupId);
  return { inviteId: res.inviteId, expiresAt: res.expiresAt, keyVersion: res.keyVersion, key: keyOf(group, res.keyVersion) };
}

async function revokeInvite(groupId, inviteId) {
  await groupsApi.revokeInvite(groupId, persisted.groups[groupId].token, inviteId);
  await syncGroup(groupId);
}

async function approveRequest(groupId, memberId) {
  await groupsApi.approve(groupId, persisted.groups[groupId].token, memberId);
  await syncGroup(groupId);
}

async function rejectRequest(groupId, memberId) {
  await groupsApi.reject(groupId, persisted.groups[groupId].token, memberId);
  await syncGroup(groupId);
}

// Исключение со сменой ключа: новый ключ, заново зашифрованные название и ники,
// ключ завёрнут для каждого оставшегося участника. Исключённый знает только старый ключ.
async function removeMember(groupId, memberId) {
  await syncGroup(groupId);
  const group = persisted.groups[groupId];
  const view = views[groupId];
  if (!group || !view) throw new Error('Группа недоступна');
  const device = await ensureDevice();
  const version = group.keyVersion + 1;
  const key = await generateGroupKey();
  const members = {};
  for (const m of view.members) {
    if (m.id === memberId) continue;
    members[m.id] = {
      nickEnc: await encryptJSON(key, { n: m.nick }, aad.nick(groupId, m.id, version)),
      ...(m.id === group.memberId ? {} : { wrappedKey: await wrapGroupKey(device.privJwk, m.pub, key, aad.wrap(groupId, m.id, version)) })
    };
  }
  await groupsApi.rotate(groupId, group.token, {
    removeMemberId: memberId,
    keyVersion: version,
    nameEnc: await encryptJSON(key, { n: view.name }, aad.name(groupId, version)),
    members
  });
  updateGroup(groupId, { keyVersion: version, keys: { [version]: key } });
  if (target?.groupId === groupId && target.memberId === memberId) target = null;
  delete lastSent[groupId];
  await syncGroup(groupId);
}

async function leaveGroup(groupId) {
  const group = persisted.groups[groupId];
  await groupsApi.leave(groupId, group.token);
  removeGroupLocal(groupId);
}

async function deleteGroup(groupId) {
  const group = persisted.groups[groupId];
  await groupsApi.deleteGroup(groupId, group.token);
  removeGroupLocal(groupId);
}

// ---------- Участник как цель компаса ----------

function setTarget(next) {
  target = next;
  emit();
}

export {
  subscribe, getSnapshot,
  setNickname, giveConsent, dismissNotice,
  createGroup, requestJoin, cancelJoin,
  syncAll, syncGroup, reportFix, sendPositions, setSharing,
  createInvite, revokeInvite, approveRequest, rejectRequest, removeMember, leaveGroup, deleteGroup,
  setTarget
};
