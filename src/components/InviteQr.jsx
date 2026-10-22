import { useEffect, useState } from 'react';

// QR-код ссылки-приглашения. Библиотека QR грузится только на этом экране —
// в основной бандл приложения она не попадает.
export default function InviteQr({ link }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    import('qrcode')
      .then((QRCode) => QRCode.toString(link, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 4,
        color: { dark: '#0d1820', light: '#ffffff' }
      }))
      .then((svg) => {
        if (!cancelled) setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });
    return () => {
      cancelled = true;
    };
  }, [link]);

  if (!src) return <p className="empty">QR-код готовится…</p>;
  return <img className="qr__code" src={src} alt="QR-код приглашения в группу" width="296" height="296" />;
}
