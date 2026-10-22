import { useEffect, useId, useState } from 'react';
import Screen from './Screen';
import useGroups from '../hooks/useGroups';
import { useRouteParam } from '../hooks/useRoute';
import { navigate, replaceRoute } from '../utils/router';
import { parseInvite } from '../utils/groupLogic';
import { requestJoin, setNickname } from '../utils/groupsStore';

// Вступление по ссылке-приглашению #/join/<группа>.<приглашение>.<версия>.<ключ>.
// Приглашение читается один раз, затем адрес заменяется на #/join без ключа, чтобы ключ
// группы не остался в истории браузера.
export default function JoinScreen() {
  const param = useRouteParam();
  const groups = useGroups();
  const [invite] = useState(() => parseInvite(`#/join/${param}`));
  const [nick, setNick] = useState(groups.nickname);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nickId = useId();

  useEffect(() => {
    if (param) replaceRoute('join');
  }, [param]);

  const alreadyMember = invite && groups.groups.some((g) => g.groupId === invite.groupId);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!nick.trim()) {
      setError('Введите ник — его увидят участники группы');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setNickname(nick);
      await requestJoin(invite);
      replaceRoute('groups');
    } catch (err) {
      setError(err?.message || 'Не удалось отправить заявку');
      setBusy(false);
    }
  };

  return (
    <Screen title="Приглашение" backLabel="К группам" onBack={() => navigate('groups')}>
      {!invite && (
        <section className="panel">
          <p className="error" role="alert">Ссылка-приглашение повреждена. Попросите участника группы прислать её заново.</p>
        </section>
      )}
      {invite && alreadyMember && (
        <section className="panel">
          <p className="screen__text">Вы уже в этой группе.</p>
          <button type="button" className="btn btn--block" onClick={() => replaceRoute('group', invite.groupId)}>Открыть группу</button>
        </section>
      )}
      {invite && !alreadyMember && (
        <form className="panel form" onSubmit={handleJoin} aria-label="Вступить в группу">
          <h2 className="label">Вступить в группу</h2>
          <p className="screen__text">
            Владелец группы увидит ваш ник и решит, принять ли заявку. После этого вы сможете
            видеть участников и передавать им свою позицию.
          </p>
          <label htmlFor={nickId} className="label field-label">Ваш ник</label>
          <input id={nickId} className="field" type="text" maxLength={40} placeholder="Например, Вася"
            value={nick} onChange={(e) => setNick(e.target.value)} autoFocus />
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn btn--block" disabled={busy}>Отправить заявку</button>
        </form>
      )}
    </Screen>
  );
}
