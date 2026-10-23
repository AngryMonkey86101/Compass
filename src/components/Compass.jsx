import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { calculateDistance, formatDistance, calculateBearing } from '../utils/geoUtils';
import { indexToLetters } from '../utils/labels';
import { buildExport, EXPORT_FORMATS } from '../utils/exportPoints';
import { saveFile } from '../utils/saveFile';
import { navigate, goBack } from '../utils/router';
import useGeolocation from '../hooks/useGeolocation';
import useDeviceOrientation from '../hooks/useDeviceOrientation';
import useLocations from '../hooks/useLocations';
import useEventFeed from '../hooks/useEventFeed';
import useWakeLock from '../hooks/useWakeLock';
import useGroups from '../hooks/useGroups';
import useGroupSync from '../hooks/useGroupSync';
import useNow from '../hooks/useNow';
import useDeclination from '../hooks/useDeclination';
import { setTarget } from '../utils/groupsStore';
import { formatAge, freshness, initials, positionAge } from '../utils/groupLogic';
import StatusBar from './StatusBar';
import TargetPanel from './TargetPanel';
import CompassDial from './CompassDial';
import LocationList from './LocationList';
import CoordsPanel from './CoordsPanel';
import EventFeed from './EventFeed';
import InstallBanner from './InstallBanner';
import Version from './Version';

// Подсказка о выходе при каждом входе в режим: в установленном на iPhone приложении нет
// кнопки и жеста «Назад», двойное нажатие — единственный выход, и его легко забыть
const FOCUS_HINT_MS = 3000;

// Главный экран. isFocus — режим «только компас» (#/focus): остаются циферблат, маркер цели,
// курс и строка с выбранной точкой; остальное скрыто стилями, а не размонтировано, чтобы
// не сбрасывать сглаживание стрелки, GPS и разрешение датчика. hidden — открыт другой экран
// (меню, мануал): GPS и датчик продолжают работать, при возврате ждать их не нужно.
export default function Compass({ isFocus = false, hidden = false }) {
  const { coords, error: geoError, isLoading: isGeoLoading } = useGeolocation();
  const { subscribe: subscribeHeading, isPermissionGranted, requestPermission, error: orientError } = useDeviceOrientation();
  const { savedLocations, selectedLocation, addLocation, importLocations, deleteLocation, selectLocation } = useLocations();
  const { events, push } = useEventFeed();

  // Датчик даёт курс от магнитного севера, а азимут на точку считается от истинного.
  // Поправка на склонение прибавляется к каждому значению датчика: шкала, курс и стрелка
  // на точку — от истинного севера. Значение берётся из ref, чтобы не переподписываться.
  const declination = useDeclination(coords);
  const declinationRef = useRef(0);
  useEffect(() => {
    declinationRef.current = declination ?? 0;
  }, [declination]);
  const subscribeTrueHeading = useCallback((callback) => subscribeHeading((heading) => {
    callback((((heading + declinationRef.current) % 360) + 360) % 360);
  }), [subscribeHeading]);

  // Буквы, дистанции и азимут пересчитываются только при изменении позиции или списка, не при повороте
  const items = useMemo(() => savedLocations.map((loc, index) => ({
    ...loc,
    label: indexToLetters(index),
    distance: coords ? formatDistance(calculateDistance(coords.lat, coords.lon, loc.lat, loc.lon)) : null
  })), [savedLocations, coords]);

  // Группы: обмен с сервером, пока приложение открыто; участник группы может быть целью
  const groupsState = useGroups();
  useGroupSync(coords);
  const now = useNow(15000);
  const isSharing = groupsState.groups.some((g) => g.sharing);

  // Цель-участник: последняя известная позиция и её возраст. Через 2 часа без обновлений
  // позиции нет — цель остаётся, но направление не показывается
  const memberTarget = useMemo(() => {
    const t = groupsState.target;
    const group = t && groupsState.groups.find((g) => g.groupId === t.groupId);
    const member = group?.view?.members.find((m) => m.id === t.memberId);
    if (!member) return null;
    const pos = group.view.positions[member.id];
    const age = pos ? positionAge(pos.receivedAt, group.view.offset ?? 0, now) : null;
    const fresh = age !== null ? freshness(age) : 'expired';
    const known = fresh !== 'expired';
    return {
      id: `member:${group.groupId}:${member.id}`,
      name: member.nick,
      label: initials(member.nick),
      lat: known ? pos.lat : null,
      lon: known ? pos.lon : null,
      distance: known && coords ? formatDistance(calculateDistance(coords.lat, coords.lon, pos.lat, pos.lon)) : null,
      note: `${group.name} · ${known ? `обновлено ${formatAge(age)}` : 'нет свежих данных'}`,
      fresh
    };
  }, [groupsState, now, coords]);

  const selectedItem = memberTarget ?? items.find((item) => item.id === selectedLocation?.id) ?? null;

  const targetLat = selectedItem?.lat ?? null;
  const targetLon = selectedItem?.lon ?? null;
  const bearing = useMemo(() => {
    if (!coords || targetLat === null) return null;
    return calculateBearing(coords.lat, coords.lon, targetLat, targetLon);
  }, [coords, targetLat, targetLon]);

  // Выбор точки в списке снимает цель-участника
  const handleSelectPoint = useCallback((id) => {
    setTarget(null);
    selectLocation(id);
  }, [selectLocation]);

  // Номер показа подсказки: каждый вход в режим — новый номер и новый таймер на 3 с
  // (при повторном входе подсказка не исчезает раньше времени); 0 — подсказка скрыта
  const [hintShow, setHintShow] = useState(0);
  const showHint = isFocus && hintShow > 0;
  useWakeLock(isFocus && !hidden);

  const toggleFocus = useCallback(() => {
    if (isFocus) {
      goBack('nav');
      return;
    }
    navigate('focus');
    setHintShow((n) => n + 1);
  }, [isFocus]);

  useEffect(() => {
    if (!hintShow) return undefined;
    const timer = setTimeout(() => setHintShow(0), FOCUS_HINT_MS);
    return () => clearTimeout(timer);
  }, [hintShow]);

  // После возврата с меню или мануала фокус — на кнопке меню, а не на <body>:
  // клавиатура и экранный диктор продолжают с того места, откуда ушли
  const menuButtonRef = useRef(null);
  const wasHiddenRef = useRef(hidden);
  useEffect(() => {
    if (wasHiddenRef.current && !hidden) menuButtonRef.current?.focus({ preventScroll: true });
    wasHiddenRef.current = hidden;
  }, [hidden]);

  // Esc на компьютере выходит из режима «только компас»
  useEffect(() => {
    if (!isFocus || hidden) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') goBack('nav');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFocus, hidden]);

  const handleAdd = (name, lat, lon) => {
    if (addLocation(name, lat, lon)) push(`Точка «${name}» добавлена`, 'ok');
  };

  const handleSaveHere = (name, lat, lon) => {
    if (addLocation(name, lat, lon)) push('Текущее место сохранено', 'ok');
  };

  const handleImport = (points) => {
    const { added, replaced } = importLocations(points);
    if (added + replaced === 0) {
      push('Нет точек для импорта', 'danger');
      return;
    }
    push(`Импорт: добавлено ${added}${replaced ? `, заменено ${replaced}` : ''}`, 'ok');
  };

  // Файл собирается синхронно в обработчике нажатия: иначе iOS не откроет меню «Поделиться»
  const handleExport = (format) => {
    const label = EXPORT_FORMATS[format].label;
    let file;
    try {
      const { name, mime, content } = buildExport(savedLocations, format);
      file = new File([content], name, { type: mime });
    } catch {
      push(`Экспорт ${label} не удался`, 'danger');
      return;
    }
    saveFile(file).then((result) => {
      if (result === 'shared') push(`Экспорт ${label}: файл отправлен`, 'ok');
      else if (result === 'downloaded') push(`Экспорт ${label}: файл скачан`, 'ok');
    }, () => push(`Экспорт ${label} не удался`, 'danger'));
  };

  const handleDelete = (id) => {
    deleteLocation(id);
    push('Точка удалена');
  };

  return (
    <main className={`app${isFocus ? ' app--focus' : ''}`} hidden={hidden}>
      <StatusBar
        coords={coords}
        isGeoLoading={isGeoLoading}
        geoError={geoError}
        isSensorOn={isPermissionGranted}
        sensorError={orientError}
        onMenu={() => navigate('menu')}
        menuButtonRef={menuButtonRef}
        isSharing={isSharing}
      />

      <InstallBanner />

      <div className="layout">
        <div className="layout__target">
          <TargetPanel
            location={selectedItem}
            label={selectedItem?.label}
            distance={selectedItem?.distance}
            bearing={bearing}
            note={memberTarget?.note}
            noteTone={memberTarget ? memberTarget.fresh : null}
          />
        </div>

        <div className="layout__dial">
          {!isPermissionGranted && (
            <button type="button" className="btn btn--block" onClick={requestPermission}>
              Включить компас
            </button>
          )}
          {orientError && <p role="alert" className="error">{orientError}</p>}
          <CompassDial
            subscribeHeading={subscribeTrueHeading}
            bearing={bearing}
            targetLabel={selectedItem?.label ?? ''}
            onDoubleTap={toggleFocus}
            isFocus={isFocus}
          />
          {isFocus && (
            <p className="focus-target">
              {selectedItem ? (
                <>
                  <span className="focus-target__label">{selectedItem.label}</span>
                  <span className="focus-target__name">{selectedItem.name}</span>
                  <span className="mono">{selectedItem.distance ?? '—'}</span>
                </>
              ) : (
                <span className="tone-muted">Точка не выбрана</span>
              )}
            </p>
          )}
          {showHint && (
            <p className="focus-hint" role="status">Двойное нажатие на компас — вернуть интерфейс</p>
          )}
        </div>

        <div className="layout__list">
          <LocationList
            items={items}
            selectedId={memberTarget ? null : selectedLocation?.id ?? null}
            onSelect={handleSelectPoint}
            onAdd={handleAdd}
            onImport={handleImport}
            onExport={handleExport}
            onDelete={handleDelete}
          />
        </div>

        <div className="layout__coords">
          <CoordsPanel coords={coords} declination={declination} isLoading={isGeoLoading} error={geoError} onSave={handleSaveHere} />
        </div>
      </div>

      <Version />
      <EventFeed events={events} />
    </main>
  );
}
