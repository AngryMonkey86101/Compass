import { memo, useEffect, useRef } from 'react';
import { shortestDelta, smoothAngle } from '../utils/angle';
import { createDoubleTapDetector } from '../utils/doubleTap';

// Постоянная времени сглаживания: больше — плавнее, но с бóльшим запаздыванием
const SMOOTHING_TAU_MS = 150;
// Ниже этой разницы угол считается установившимся и анимация останавливается
const SETTLE_DEG = 0.05;
// Защита от огромного шага после того, как вкладка была в фоне
const MAX_FRAME_MS = 100;

// Геометрия шкалы в системе координат 300×300, центр (150, 150). Строится один раз.
const C = 150;
const point = (deg, r) => {
  const t = (deg * Math.PI) / 180;
  return `${(C + r * Math.sin(t)).toFixed(1)} ${(C - r * Math.cos(t)).toFixed(1)}`;
};
const buildTicks = (filter, inner) => {
  let d = '';
  for (let deg = 0; deg < 360; deg += 5) {
    if (filter(deg)) d += `M${point(deg, inner)}L${point(deg, 140)}`;
  }
  return d;
};
const MINOR_TICKS = buildTicks((deg) => deg % 30 !== 0, 133);
const MAJOR_TICKS = buildTicks((deg) => deg % 30 === 0 && deg !== 0, 124);

const formatHeading = (deg) => `${String(Math.round(((deg % 360) + 360) % 360) % 360).padStart(3, '0')}°`;

// subscribeHeading — подписка на сырой азимут устройства (из useDeviceOrientation),
// bearing — азимут на выбранную точку (null, пока неизвестно местоположение),
// targetLabel — буква выбранной точки для маркера на кольце,
// onDoubleTap — двойное нажатие на циферблат (переключение режима «только компас»), isFocus — режим включён.
// Все повороты применяются напрямую к DOM в requestAnimationFrame через transform, без перерисовки React
// и без CSS-фильтров на вращающихся слоях — иначе на iOS возвращаются рывки.
function CompassDial({ subscribeHeading, bearing, targetLabel, onDoubleTap, isFocus = false }) {
  const faceRef = useRef(null);
  const arrowRef = useRef(null);
  const orbitRef = useRef(null);
  const orbitMarkerRef = useRef(null);
  const headingTextRef = useRef(null);
  const bearingRef = useRef(bearing);
  const wakeRef = useRef(() => {});
  const tapRef = useRef(null);
  if (tapRef.current === null) tapRef.current = createDoubleTapDetector();

  useEffect(() => {
    let targetHeading = null;
    let shownHeading = null;
    let shownBearing = null;
    let shownHeadingText = '';
    let frameId = 0;
    let lastTime = 0;

    const render = () => {
      const heading = shownHeading ?? 0;
      if (faceRef.current) {
        faceRef.current.style.transform = `rotate(${-heading}deg)`;
      }
      if (shownBearing !== null) {
        const relative = shownBearing - heading;
        if (arrowRef.current) arrowRef.current.style.transform = `rotate(${relative}deg)`;
        if (orbitRef.current) orbitRef.current.style.transform = `rotate(${relative}deg)`;
        // Маркер держит букву прямо, компенсируя поворот орбиты
        if (orbitMarkerRef.current) orbitMarkerRef.current.style.transform = `rotate(${-relative}deg)`;
      }
      const text = shownHeading === null ? '—' : formatHeading(shownHeading);
      if (text !== shownHeadingText && headingTextRef.current) {
        headingTextRef.current.textContent = text;
        shownHeadingText = text;
      }
    };

    const tick = (now) => {
      const dt = Math.min(now - lastTime, MAX_FRAME_MS);
      lastTime = now;
      let settled = true;

      if (targetHeading !== null) {
        shownHeading = shownHeading === null
          ? targetHeading
          : smoothAngle(shownHeading, targetHeading, dt, SMOOTHING_TAU_MS);
        if (Math.abs(shortestDelta(shownHeading, targetHeading)) > SETTLE_DEG) settled = false;
      }

      const targetBearing = bearingRef.current;
      if (targetBearing === null) {
        shownBearing = null;
      } else {
        shownBearing = shownBearing === null
          ? targetBearing
          : smoothAngle(shownBearing, targetBearing, dt, SMOOTHING_TAU_MS);
        if (Math.abs(shortestDelta(shownBearing, targetBearing)) > SETTLE_DEG) settled = false;
      }

      render();
      frameId = settled ? 0 : requestAnimationFrame(tick);
    };

    const wake = () => {
      if (frameId) return;
      lastTime = performance.now();
      frameId = requestAnimationFrame(tick);
    };
    wakeRef.current = wake;

    const unsubscribe = subscribeHeading((heading) => {
      targetHeading = heading;
      wake();
    });
    wake();

    return () => {
      unsubscribe();
      if (frameId) cancelAnimationFrame(frameId);
      wakeRef.current = () => {};
    };
  }, [subscribeHeading]);

  useEffect(() => {
    bearingRef.current = bearing;
    wakeRef.current();
  }, [bearing]);

  const hidden = bearing === null;

  // Двойное нажатие: только основная кнопка мыши или касание; с клавиатуры — Enter или пробел.
  // Экранный диктор активирует элемент одиночным синтетическим кликом (detail === 0) —
  // он тоже переключает режим. Обычный клик пальцем или мышью (detail ≥ 1) не переключает.
  const tapHandlers = {
    role: 'button',
    tabIndex: 0,
    'aria-label': 'Режим «только компас» (двойное нажатие)',
    'aria-pressed': isFocus,
    onPointerDown: (e) => {
      if (e.isPrimary && e.button === 0) tapRef.current.down(e.clientX, e.clientY);
    },
    onPointerUp: (e) => {
      if (e.isPrimary && tapRef.current.up(e.clientX, e.clientY, e.timeStamp)) onDoubleTap();
    },
    onPointerCancel: () => tapRef.current.cancel(),
    onClick: (e) => {
      if (e.detail === 0) onDoubleTap();
    },
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onDoubleTap();
      }
    }
  };

  return (
    <div className="dial-section">
      <div className="dial-stage dial-stage--tappable" {...tapHandlers}>
        <span className="dial-section__crosshair-h" aria-hidden="true" />
        <span className="dial-section__crosshair-v" aria-hidden="true" />

        <div className="dial">
          <svg className="dial__base" viewBox="0 0 300 300" aria-hidden="true">
            <circle cx="150" cy="150" r="148" fill="#13222c" fillOpacity="0.9" stroke="rgba(190,210,222,0.35)" strokeWidth="1" />
            <circle cx="150" cy="150" r="96" fill="none" stroke="rgba(190,210,222,0.18)" strokeWidth="1" strokeDasharray="2 4" />
          </svg>

          <svg ref={faceRef} className="dial__face" viewBox="0 0 300 300" role="img" aria-label="Шкала компаса">
            <path d={MINOR_TICKS} stroke="rgba(190,210,222,0.45)" strokeWidth="1" fill="none" />
            <path d={MAJOR_TICKS} stroke="#c9d6de" strokeWidth="1.5" fill="none" />
            <path d={`M${point(0, 124)}L${point(0, 140)}`} stroke="#f28b6e" strokeWidth="2.5" fill="none" />
            <g fontFamily="'Fira Sans Condensed', sans-serif" fontWeight="700" textAnchor="middle">
              <text x="150" y="46" fontSize="17" fill="#f28b6e">N</text>
              <text x="258" y="154" fontSize="15" fill="#e6eef2">E</text>
              <text x="150" y="262" fontSize="15" fill="#e6eef2">S</text>
              <text x="42" y="154" fontSize="15" fill="#e6eef2">W</text>
            </g>
          </svg>

          <svg className="dial__lubber" viewBox="0 0 300 300" aria-hidden="true">
            <path d="M150 3L144 13H156Z" fill="#e6eef2" />
          </svg>

          <svg
            ref={arrowRef}
            className={`dial__arrow${hidden ? ' dial__arrow--hidden' : ''}`}
            viewBox="0 0 300 300"
            role="img"
            aria-label="Стрелка направления на выбранную точку"
          >
            <path d="M150 54L128 186L150 170L172 186Z" fill="#4fc3f7" />
            <path d="M150 54L150 170L172 186Z" fill="#000000" fillOpacity="0.18" />
            <circle cx="150" cy="150" r="5" fill="#0d1820" stroke="#e6eef2" strokeWidth="1.5" />
          </svg>

          <div ref={orbitRef} className={`dial__orbit${hidden ? ' dial__orbit--hidden' : ''}`} aria-hidden="true">
            <svg ref={orbitMarkerRef} className="dial__orbit-marker" viewBox="0 0 32 32">
              <rect x="7" y="7" width="18" height="18" transform="rotate(45 16 16)" fill="#0d1820" stroke="#f28b6e" strokeWidth="2" />
              <text x="16" y="20.5" fontFamily="'Fira Sans Condensed', sans-serif" fontSize="12" fontWeight="700" fill="#f28b6e" textAnchor="middle">
                {targetLabel}
              </text>
            </svg>
          </div>
        </div>
      </div>

      <div className="dial__readout">
        <span className="label">Курс</span>
        <span ref={headingTextRef} className="dial__heading mono">—</span>
      </div>
    </div>
  );
}

export default memo(CompassDial);
