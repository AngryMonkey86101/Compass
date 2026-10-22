import { GROUPS_API_URL } from '../config';

// Запросы к серверу групп. Таймаут 10 с: на слабой связи запрос может висеть минутами,
// а позиция за это время устареет. AbortController вместо AbortSignal.timeout —
// последнего нет в Safari 13 и старых WebView.

const TIMEOUT_MS = 10000;

class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, { token, body, joinSecret } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    if (joinSecret) headers['X-Join-Secret'] = joinSecret;
    res = await fetch(`${GROUPS_API_URL}/api/v1${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: controller.signal
    });
  } catch {
    throw new ApiError(0, 'network', 'Нет связи с сервером групп');
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text().catch(() => '');
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'error', data?.message);
  return data;
}

const enc = encodeURIComponent;

const groupsApi = {
  createGroup: (body) => request('POST', '/groups', { body }),
  getGroup: (groupId, token) => request('GET', `/groups/${enc(groupId)}`, { token }),
  putPosition: (groupId, token, body) => request('PUT', `/groups/${enc(groupId)}/position`, { token, body }),
  deletePosition: (groupId, token) => request('DELETE', `/groups/${enc(groupId)}/position`, { token }),
  createInvite: (groupId, token) => request('POST', `/groups/${enc(groupId)}/invites`, { token }),
  revokeInvite: (groupId, token, inviteId) => request('DELETE', `/groups/${enc(groupId)}/invites/${enc(inviteId)}`, { token }),
  join: (body) => request('POST', '/join', { body }),
  joinStatus: (memberId, joinSecret) => request('GET', `/join/${enc(memberId)}`, { joinSecret }),
  approve: (groupId, token, memberId) => request('POST', `/groups/${enc(groupId)}/requests/${enc(memberId)}/approve`, { token }),
  reject: (groupId, token, memberId) => request('DELETE', `/groups/${enc(groupId)}/requests/${enc(memberId)}`, { token }),
  rotate: (groupId, token, body) => request('POST', `/groups/${enc(groupId)}/rotate`, { token, body }),
  leave: (groupId, token) => request('DELETE', `/groups/${enc(groupId)}/members/me`, { token }),
  deleteGroup: (groupId, token) => request('DELETE', `/groups/${enc(groupId)}`, { token })
};

export { groupsApi, ApiError };
