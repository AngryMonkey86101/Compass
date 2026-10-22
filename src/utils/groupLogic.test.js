import { describe, it, expect } from 'vitest';
import {
  buildInviteLink, parseInvite, shouldSendPosition, positionAge, freshness, formatAge, initials
} from './groupLogic';

const invite = {
  groupId: 'AAAAAAAAAAAAAAAAAAAAAA',
  inviteId: 'BBBBBBBBBBBBBBBBBBBBBB',
  keyVersion: 3,
  key: 'C'.repeat(43)
};

describe('приглашение', () => {
  it('ссылка и обратный разбор, в том числе из текста с подписью', () => {
    const link = buildInviteLink('https://claude-compass.netlify.app/', invite);
    expect(link).toBe(`https://claude-compass.netlify.app/#/join/${invite.groupId}.${invite.inviteId}.3.${'C'.repeat(43)}`);
    expect(parseInvite(link)).toEqual(invite);
    expect(parseInvite(`Вступай в группу «Поход»: ${link} — до вечера`)).toEqual(invite);
    expect(parseInvite(`${invite.groupId}.${invite.inviteId}.3.${'C'.repeat(43)}`)).toEqual(invite);
  });

  it('битые ссылки отклоняются', () => {
    expect(parseInvite('https://claude-compass.netlify.app/#/menu')).toBeNull();
    expect(parseInvite(`#/join/${invite.groupId}.${invite.inviteId}.0.${'C'.repeat(43)}`)).toBeNull();
    expect(parseInvite(`#/join/${invite.groupId}.${invite.inviteId}.3.short`)).toBeNull();
    expect(parseInvite('')).toBeNull();
  });
});

describe('когда отправлять свою позицию', () => {
  const at = (lat, lon, time) => ({ lat, lon, time });
  const fix = (lat, lon) => ({ lat, lon });
  const t0 = 1_000_000;

  it('первая отправка — сразу; без координат — нет', () => {
    expect(shouldSendPosition(null, fix(56.8, 60.6), t0)).toBe(true);
    expect(shouldSendPosition(null, null, t0)).toBe(false);
  });

  it('стоим: раз в 3 минуты', () => {
    const last = at(56.8, 60.6, t0);
    expect(shouldSendPosition(last, fix(56.8, 60.6), t0 + 60_000)).toBe(false);
    expect(shouldSendPosition(last, fix(56.8, 60.6), t0 + 180_000)).toBe(true);
  });

  it('идём (сдвиг ≥ 15 м): раз в 30 секунд; скачок ≥ 50 м — сразу', () => {
    const last = at(56.8, 60.6, t0);
    expect(shouldSendPosition(last, fix(56.8002, 60.6), t0 + 10_000)).toBe(false); // ~22 м
    expect(shouldSendPosition(last, fix(56.8002, 60.6), t0 + 30_000)).toBe(true);
    expect(shouldSendPosition(last, fix(56.8006, 60.6), t0 + 1_000)).toBe(true); // ~67 м
  });
});

describe('возраст и свежесть позиции', () => {
  it('возраст по часам сервера: телефон спешит на час — возраст всё равно верный', () => {
    const serverNow = 10_000_000;
    const phoneNow = serverNow + 3_600_000;
    const offset = serverNow - phoneNow;
    expect(positionAge(serverNow - 120_000, offset, phoneNow)).toBe(120_000);
    expect(positionAge(serverNow + 5_000, 0, serverNow)).toBe(0);
  });

  it('цвет свежести и подпись', () => {
    expect(freshness(60_000)).toBe('fresh');
    expect(freshness(10 * 60_000)).toBe('recent');
    expect(freshness(90 * 60_000)).toBe('stale');
    expect(freshness(2 * 3_600_000)).toBe('expired');
    expect(formatAge(20_000)).toBe('только что');
    expect(formatAge(5 * 60_000)).toBe('5 мин назад');
    expect(formatAge(65 * 60_000)).toBe('1 ч 5 мин назад');
    expect(formatAge(120 * 60_000)).toBe('2 ч назад');
  });

  it('инициалы участника', () => {
    expect(initials('Вася Пупкин')).toBe('ВП');
    expect(initials('  аня ')).toBe('АН');
    expect(initials('')).toBe('?');
  });
});
