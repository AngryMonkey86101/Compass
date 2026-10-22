import { useId, useState } from 'react';
import Screen from './Screen';
import useGroups from '../hooks/useGroups';
import { goBack, navigate } from '../utils/router';
import { parseInvite } from '../utils/groupLogic';
import { cancelJoin, createGroup, dismissNotice, setNickname } from '../utils/groupsStore';

// Список групп: ник, свои группы, заявки на вступление, создание группы и вступление
// по ссылке. Поле для ссылки обязательно в APK: камера телефона открывает приглашение
// в браузере, а у браузера и приложения разные хранилища.
export default function GroupsScreen() {
  const groups = useGroups();
  const [nick, setNick] = useState(groups.nickname);
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nickId = useId();
  const nameId = useId();
  const linkId = useId();

  const needNick = !groups.nickname;

  const saveNick = (e) => {
    e.preventDefault();
    if (!nick.trim()) {
      setError('Введите ник — его увидят участники группы');
      return;
    }
    setNickname(nick);
    setError('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введите название группы');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const groupId = await createGroup(name.trim().slice(0, 60));
      setName('');
      navigate('group', groupId);
    } catch (err) {
      setError(err?.message || 'Не удалось создать группу');
    } finally {
      setBusy(false);
    }
  };

  const handleJoinLink = (e) => {
    e.preventDefault();
    const invite = parseInvite(link);
    if (!invite) {
      setError('Это не ссылка-приглашение Компаса');
      return;
    }
    setError('');
    setLink('');
    navigate('join', `${invite.groupId}.${invite.inviteId}.${invite.keyVersion}.${invite.key}`);
  };

  return (
    <Screen title="Группы" backLabel="Назад в меню" onBack={() => goBack('menu')}>
      {groups.notices.map((n) => (
        <div key={n.id} className="panel notice" role="status">
          <p className="screen__text">{n.text}</p>
          <button type="button" className="btn btn--secondary" onClick={() => dismissNotice(n.id)}>Понятно</button>
        </div>
      ))}

      <form className="panel form" onSubmit={saveNick} aria-label="Ваш ник">
        <label htmlFor={nickId} className="label field-label">Ваш ник в группах</label>
        <div className="btn-row">
          <input id={nickId} className="field" type="text" maxLength={40} placeholder="Например, Вася"
            value={nick} onChange={(e) => setNick(e.target.value)} />
          <button type="submit" className="btn btn--secondary" disabled={nick.trim() === groups.nickname}>Сохранить</button>
        </div>
      </form>

      {groups.groups.length > 0 && (
        <section className="panel" aria-label="Мои группы">
          <h2 className="label">Мои группы</h2>
          <ul className="loc-list">
            {groups.groups.map((g) => (
              <li key={g.groupId}>
                <button type="button" className="loc-item" onClick={() => navigate('group', g.groupId)}>
                  <span className="marker" aria-hidden="true">{g.view?.members?.length ?? '·'}</span>
                  <span className="loc-item__name">{g.name}</span>
                  <span className="loc-item__distance label">
                    {g.sharing ? <span className="tone-ok">передаю</span> : (g.role === 'owner' ? 'владелец' : '')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.pending.map((p) => (
        <div key={p.memberId} className="panel" role="status">
          <p className="screen__text">Заявка на вступление отправлена — ждём одобрения владельца группы.</p>
          <button type="button" className="btn btn--secondary" onClick={() => cancelJoin(p.memberId)}>Отменить</button>
        </div>
      ))}

      {error && <p className="error" role="alert">{error}</p>}

      <form className="panel form" onSubmit={handleCreate} aria-label="Новая группа">
        <h2 className="label">Новая группа</h2>
        <label htmlFor={nameId} className="label field-label">Название</label>
        <input id={nameId} className="field" type="text" maxLength={60} placeholder="Например, Поход на Таганай"
          value={name} onChange={(e) => setName(e.target.value)} disabled={needNick} />
        <button type="submit" className="btn btn--block" disabled={needNick || busy}>Создать группу</button>
        {needNick && <p className="screen__text tone-muted">Сначала сохраните ник.</p>}
      </form>

      <form className="panel form" onSubmit={handleJoinLink} aria-label="Вступить по ссылке">
        <h2 className="label">Вступить по приглашению</h2>
        <label htmlFor={linkId} className="label field-label">Ссылка-приглашение</label>
        <input id={linkId} className="field field--mono" type="text" autoComplete="off" autoCapitalize="off"
          spellCheck={false} placeholder="https://…/#/join/…" value={link} onChange={(e) => setLink(e.target.value)}
          disabled={needNick} />
        <button type="submit" className="btn btn--block btn--secondary" disabled={needNick || !link.trim()}>Вступить</button>
      </form>

      <p className="screen__text tone-muted">
        Участники видят позиции друг друга, пока приложение открыто. Данные шифруются на телефоне:
        сервер не знает ни названий, ни ников, ни координат. Позиции хранятся 2 часа, группа без
        активности удаляется через 7 дней.
      </p>
    </Screen>
  );
}
