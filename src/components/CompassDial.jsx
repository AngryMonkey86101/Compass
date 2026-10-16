import { memo } from 'react';

// heading — накопленный азимут устройства в градусах (без сброса на 360°),
// bearing — азимут на выбранную точку (null, пока неизвестно местоположение)
function CompassDial({ heading, bearing }) {
  const arrowRotation = bearing === null ? 0 : bearing - heading;

  return (
    <div className="dial">
      <svg
        className="dial__face"
        viewBox="0 0 100 100"
        role="img"
        aria-label="Циферблат компаса"
        style={{ transform: `rotate(${-heading}deg)` }}
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
        className={`dial__arrow${bearing === null ? ' dial__arrow--hidden' : ''}`}
        style={{ transform: `translate(-50%, -50%) rotate(${arrowRotation}deg)` }}
      >
        <svg viewBox="0 0 24 24" role="img" aria-label="Стрелка направления на выбранную точку">
          <path d="M12 2L3 20l9-5 9 5z" fill="#007AFF" />
        </svg>
      </div>
    </div>
  );
}

export default memo(CompassDial);
