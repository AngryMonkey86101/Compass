import Screen from './Screen';
import { navigate } from '../utils/router';

// Иконки 24×24, линией в цвет текста — как остальная графика HUD
const ICONS = {
  nav: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 5l3 7-3 7-3-7z" />
    </>
  ),
  manual: (
    <>
      <path d="M5 4h10l4 4v12H5z" />
      <path d="M8 11h8M8 15h8M8 7h5" />
    </>
  ),
  qr: (
    <>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
      <path d="M14 14h2v2h-2zM18 14h2M14 18h2v2M18 18h2v2" />
    </>
  ),
  support: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
};

const ITEMS = [
  { route: 'nav', title: 'Навигация', hint: 'Компас и точки' },
  { route: 'manual', title: 'Мануал', hint: 'Как пользоваться' },
  { route: 'qr', title: 'QR-код приложения', hint: 'Поделиться ссылкой' },
  { route: 'support', title: 'Поддержать проект', hint: 'Скоро' }
];

// Главное меню: четыре плитки. Закрытие возвращает на навигацию.
export default function MainMenu() {
  return (
    <Screen title="Меню" backLabel="Закрыть меню" onBack={() => navigate('nav')}>
      <nav aria-label="Главное меню">
        <ul className="menu">
          {ITEMS.map(({ route, title, hint }) => (
            <li key={route}>
              <button type="button" className="menu__item" onClick={() => navigate(route)}>
                <svg className="menu__icon" viewBox="0 0 24 24" aria-hidden="true">{ICONS[route]}</svg>
                <span className="menu__text">
                  <span className="menu__title">{title}</span>
                  <span className="menu__hint">{hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </Screen>
  );
}
