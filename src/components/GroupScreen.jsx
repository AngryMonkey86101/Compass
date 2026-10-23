import { useState } from 'react';
import Screen from './Screen';
import InviteQr from './InviteQr';
import useGroups from '../hooks/useGroups';
import useNow from '../hooks/useNow';
import { useRouteParam } from '../hooks/useRoute';
import { goBack, navigate } from '../utils/router';
import { calculateDistance, formatDistance } from '../utils/geoUtils';
import { buildInviteLink, formatAge, freshness, positionAge } from '../utils/groupLogic';
import { isNativeApp } from '../utils/platform';
import { APP_URL } from '../config';
import {
  approveRequest, createInvite, deleteGroup, giveConsent, leaveGroup, rejectRequest,
  removeMember, revokeInvite, setSharing, setTarget, syncGroup
} from '../utils/groupsStore';

const TONE = { fresh: 'tone-ok', recent: 'tone-warn', stale: 'tone-muted' };

// Ссылка ведёт туда же, где открыт Компас: на сайте — на этот же адрес (в том числе
// превью и локальную проверку), в APK — на опубликованный сайт
const inviteOrigin = () => (isNativeApp ? APP_URL : window.location.origin);

const formatTime = (ms) => new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export default function GroupScreen() {
  const groupId = useRouteParam();
  const groups = useGroups();
  const now = useNow(10000);
  const group = groups.groups.find((g) => g.groupId === groupId);
  const [invite, setInvite] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [askConsent, setAskConsent] = useState(false);

  if (!group) {
    return (
      <Screen title="Группа" backLabel="К группам" onBack={() => goBack('groups')}>
        <section className="panel" role="status">
          {/* если доступ потерян во время просмотра — показываем причину, а не общий текст */}
          {groups.notices.length > 0 ? (
            <p className="screen__text">{groups.notices[groups.notices.length - 1].text}</p>
          ) : (
            <p className="screen__text">Группа не найдена: возможно, вы из неё вышли или её удалили.</p>
          )}
          <button type="button" className="btn btn--block" onClick={() => navigate('groups')}>К группам</button>
        </section>
      </Screen>
    );
  }

  const view = group.view ?? { members: [], positions: {}, requests: [], invites: [], offset: 0 };
  const isOwner = group.role === 'owner';
  const fix = groups.fix;

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err?.message || 'Не получилось — проверьте связь и повторите');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const toggleSharing = () => {
    if (group.sharing) return run(() => setSharing(groupId, false));
    if (!groups.consentGiven) {
      setAskConsent(true);
      return undefined;
    }
    return run(() => setSharing(groupId, true));
  };

  const acceptConsent = () => {
    giveConsent();
    setAskConsent(false);
    run(() => setSharing(groupId, true));
  };

  const makeInvite = () => run(async () => {
    const created = await createInvite(groupId);
    setInvite({ ...created, link: buildInviteLink(inviteOrigin(), { groupId, ...created }) });
    setCopied(false);
  });

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopied(true);
    } catch {
      setError('Не удалось скопировать — выделите ссылку вручную');
    }
  };

  const shareInvite = () => {
    navigator.share({ title: `Группа «${group.name}» в Компасе`, url: invite.link }).catch(() => {});
  };

  const showAsTarget = (memberId) => {
    setTarget({ groupId, memberId });
    navigate('nav');
  };

  let status = 'Позиция не передаётся';
  if (group.sharing) {
    if (!fix) status = 'Жду координаты GPS…';
    else if (group.send?.ok) status = `Передаю · отправлено в ${formatTime(group.send.at)}`;
    else if (group.send?.offline) status = 'Нет связи — отправлю, когда появится';
    else if (group.send) status = 'Не удалось отправить — повторю';
    else status = 'Передаю…';
  }

  return (
    <Screen title={group.name} backLabel="К группам" onBack={() => goBack('groups')}>
      {view.status === 'offline' && view.syncedAt && (
        <p className="screen__text tone-warn" role="status">
          Нет связи с сервером. Данные на {formatTime(view.syncedAt)}, возраст позиций продолжает расти.
        </p>
      )}
      {view.status === 'no_key' && (
        <p className="error" role="alert">Нет ключа группы — попросите владельца пригласить вас заново.</p>
      )}

      <section className={`panel${group.sharing ? ' panel--active' : ''}`} aria-label="Моя позиция">
        <h2 className="label">Моя позиция</h2>
        <p className={`screen__text${group.sharing ? ' tone-ok' : ' tone-muted'}`} role="status">{status}</p>
        {askConsent ? (
          <div className="form">
            <p className="screen__text">
              Участники группы будут видеть, где вы находитесь, пока Компас открыт на экране.
              Координаты шифруются на телефоне, сервер хранит их 2 часа. Остановить передачу
              можно в любой момент этой же кнопкой.
            </p>
            <button type="button" className="btn btn--secondary" onClick={() => navigate('privacy')}>
              Политика конфиденциальности
            </button>
            <div className="btn-row">
              <button type="button" className="btn" onClick={acceptConsent}>Согласен, передавать</button>
              <button type="button" className="btn btn--secondary" onClick={() => setAskConsent(false)}>Отмена</button>
            </div>
          </div>
        ) : (
          <button type="button" className={`btn btn--block${group.sharing ? ' btn--danger' : ''}`}
            aria-pressed={group.sharing} onClick={toggleSharing} disabled={busy}>
            {group.sharing ? 'Остановить передачу' : 'Передавать мою позицию'}
          </button>
        )}
      </section>

      <section className="panel" aria-label="Участники">
        <div className="panel__header">
          <h2 className="label">Участники · {view.members.length}</h2>
          <button type="button" className="btn btn--secondary" onClick={() => run(() => syncGroup(groupId))} disabled={busy}>
            Обновить
          </button>
        </div>
        <ul className="members">
          {view.members.map((m) => {
            const pos = view.positions[m.id];
            const age = pos ? positionAge(pos.receivedAt, view.offset ?? 0, now) : null;
            const fresh = age !== null ? freshness(age) : 'expired';
            const visible = pos && fresh !== 'expired';
            const isMe = m.id === group.memberId;
            const distance = visible && fix && !isMe
              ? formatDistance(calculateDistance(fix.lat, fix.lon, pos.lat, pos.lon))
              : null;
            return (
              <li key={m.id} className="member">
                <div className="member__main">
                  <span className="member__nick">
                    {m.nick}{isMe ? ' (вы)' : ''}{m.role === 'owner' ? ' · владелец' : ''}
                  </span>
                  <span className={`member__age ${visible ? TONE[fresh] : 'tone-muted'}`}>
                    {visible ? `${formatAge(age)} · ±${pos.acc} м` : 'нет данных'}
                  </span>
                </div>
                {distance && <span className="member__distance mono">{distance}</span>}
                <div className="btn-row member__actions">
                  {visible && !isMe && (
                    <button type="button" className="btn btn--secondary" onClick={() => showAsTarget(m.id)}>Цель</button>
                  )}
                  {isOwner && !isMe && (confirm === m.id ? (
                    <>
                      <button type="button" className="btn btn--danger" disabled={busy}
                        onClick={() => run(() => removeMember(groupId, m.id))}>Исключить</button>
                      <button type="button" className="btn btn--secondary" onClick={() => setConfirm(null)}>Нет</button>
                    </>
                  ) : (
                    <button type="button" className="btn btn--secondary" onClick={() => setConfirm(m.id)}
                      aria-label={`Исключить ${m.nick}`}>×</button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        {view.members.length === 0 && <p className="empty">Загрузка участников…</p>}
      </section>

      {isOwner && view.requests.length > 0 && (
        <section className="panel panel--active" aria-label="Заявки">
          <h2 className="label">Заявки на вступление</h2>
          <ul className="members">
            {view.requests.map((r) => (
              <li key={r.id} className="member">
                <span className="member__nick">{r.nick}</span>
                <div className="btn-row member__actions">
                  <button type="button" className="btn" disabled={busy || view.members.length >= 15}
                    onClick={() => run(() => approveRequest(groupId, r.id))}>Принять</button>
                  <button type="button" className="btn btn--secondary" disabled={busy}
                    onClick={() => run(() => rejectRequest(groupId, r.id))}>Отклонить</button>
                </div>
              </li>
            ))}
          </ul>
          {view.members.length >= 15 && <p className="screen__text tone-warn">В группе уже 15 участников — это максимум.</p>}
        </section>
      )}

      {isOwner && (
        <section className="panel qr" aria-label="Приглашение">
          <h2 className="label">Пригласить в группу</h2>
          {invite ? (
            <>
              <InviteQr link={invite.link} />
              <p className="qr__url mono">{invite.link}</p>
              <p className="screen__text tone-muted">
                Действует до {formatTime(invite.expiresAt)} завтра. Каждая заявка придёт вам на одобрение.
                В приложении Android ссылку нужно вставить в «Группы → Вступить по приглашению».
              </p>
              <div className="btn-row">
                <button type="button" className="btn" onClick={copyInvite}>{copied ? 'Скопировано' : 'Скопировать'}</button>
                {typeof navigator.share === 'function' && (
                  <button type="button" className="btn btn--secondary" onClick={shareInvite}>Поделиться</button>
                )}
              </div>
            </>
          ) : (
            <button type="button" className="btn btn--block" onClick={makeInvite} disabled={busy || view.members.length >= 15}>
              Создать приглашение
            </button>
          )}
          {view.invites.length > 0 && (
            <ul className="members">
              {view.invites.map((i) => (
                <li key={i.id} className="member">
                  <span className="member__nick">Приглашение до {formatTime(i.expiresAt)}</span>
                  <button type="button" className="btn btn--secondary" disabled={busy}
                    onClick={() => run(async () => {
                      await revokeInvite(groupId, i.id);
                      if (invite?.inviteId === i.id) setInvite(null);
                    })}>Отозвать</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <section className="panel">
        {confirm === 'leave' ? (
          <>
            <p className="error" role="alert">
              {isOwner ? 'Удалить группу для всех участников?' : 'Выйти из группы?'}
            </p>
            <div className="btn-row">
              <button type="button" className="btn btn--danger" disabled={busy} onClick={() => run(async () => {
                if (isOwner) await deleteGroup(groupId);
                else await leaveGroup(groupId);
                navigate('groups');
              })}>{isOwner ? 'Удалить' : 'Выйти'}</button>
              <button type="button" className="btn btn--secondary" onClick={() => setConfirm(null)}>Отмена</button>
            </div>
          </>
        ) : (
          <button type="button" className="btn btn--danger btn--block" onClick={() => setConfirm('leave')}>
            {isOwner ? 'Удалить группу' : 'Выйти из группы'}
          </button>
        )}
      </section>
    </Screen>
  );
}
