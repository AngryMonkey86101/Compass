import { memo, useEffect, useRef } from 'react';
import { shortestDelta, smoothAngle } from '../utils/angle';

// Постоянная времени сглаживания: больше — плавнее, но с бóльшим запаздыванием
const SMOOTHING_TAU_MS = 150;
// Ниже этой разницы угол считается установившимся и анимация останавливается
const SETTLE_DEG = 0.05;
// Защита от огромного шага после того, как вкладка была в фоне
const MAX_FRAME_MS = 100;

// subscribeHeading — подписка на сырой азимут устройства (из useDeviceOrientation),
// bearing — азимут на выбранную точку (null, пока неизвестно местоположение).
// Повороты применяются напрямую к DOM в requestAnimationFrame, без перерисовки React.
function CompassDial({ subscribeHeading, bearing }) {
  const faceRef = useRef(null);
  const arrowRef = useRef(null);
  const bearingRef = useRef(bearing);
  const wakeRef = useRef(() => {});

  useEffect(() => {
    let targetHeading = null;
    let shownHeading = null;
    let shownBearing = null;
    let frameId = 0;
    let lastTime = 0;

    const render = () => {
      const heading = shownHeading ?? 0;
      if (faceRef.current) {
        faceRef.current.style.transform = `rotate(${-heading}deg)`;
      }
      if (arrowRef.current && shownBearing !== null) {
        arrowRef.current.style.transform =
          `translate(-50%, -50%) rotate(${shownBearing - heading}deg)`;
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

  return (
    <div className="dial">
      <svg
        ref={faceRef}
        className="dial__face"
        viewBox="0 0 100 100"
        role="img"
        aria-label="Циферблат компаса"
      >
        <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#e5e5ea" strokeWidth="2" />
        <circle cx="50" cy="50" r="35" fill="none" stroke="#f2f2f7" strokeWidth="1" />

        <text x="50" y="16" textAnchor="middle" fill="#d70015" fontSize="12" fontWeight="bold">N</text>
        <text x="88" y="54" textAnchor="middle" fill="#6c6c70" fontSize="10" fontWeight="bold">E</text>
        <text x="50" y="91" textAnchor="middle" fill="#6c6c70" fontSize="10" fontWeight="bold">S</text>
        <text x="12" y="54" textAnchor="middle" fill="#6c6c70" fontSize="10" fontWeight="bold">W</text>

        <line x1="50" y1="2" x2="50" y2="7" stroke="#d70015" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="98" y1="50" x2="93" y2="50" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" />
        <line x1="50" y1="98" x2="50" y2="93" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" />
        <line x1="2" y1="50" x2="7" y2="50" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <div
        ref={arrowRef}
        className={`dial__arrow${bearing === null ? ' dial__arrow--hidden' : ''}`}
      >
        <svg viewBox="0 0 24 24" role="img" aria-label="Стрелка направления на выбранную точку">
          {/* Тень нарисована в SVG: CSS-фильтр на вращающемся слое пересчитывался бы каждый кадр */}
          <path d="M12 3.2L3 21.2l9-5 9 5z" fill="rgba(0, 122, 255, 0.18)" />
          <path d="M12 2L3 20l9-5 9 5z" fill="#007AFF" />
        </svg>
      </div>
    </div>
  );
}

export default memo(CompassDial);
