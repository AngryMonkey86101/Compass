// Экраны приложения в адресе после «#»: #/ — навигация (стартовый), #/focus — только компас,
// #/menu, #/manual, #/qr, #/support. Переходы кладутся в историю браузера, поэтому кнопка
// «Назад» на Android и в браузере работает без дополнительного кода. В установленном на iPhone
// приложении «Назад» нет — на каждом экране есть своя кнопка возврата.

const ROUTES = ['nav', 'focus', 'menu', 'manual', 'qr', 'support'];
const CHANGE_EVENT = 'compass:routechange';

// '#/manual' → 'manual'; пустой или неизвестный адрес — навигация
function parseRoute(hash) {
  const name = String(hash ?? '').replace(/^#\/?/, '').replace(/\/$/, '');
  return ROUTES.includes(name) ? name : 'nav';
}

const hashFor = (route) => (route === 'nav' ? '#/' : `#/${route}`);

const notify = () => window.dispatchEvent(new Event(CHANGE_EVENT));

// Переход с записью в историю. Отметка inApp в state показывает, что «назад» вернёт
// на предыдущий экран приложения, а не уведёт со страницы. Переход на экран, с которого
// пришли (меню → «Навигация»), — это шаг назад: история не растёт, «Назад» не ходит по кругу.
function navigate(route) {
  const from = parseRoute(window.location.hash);
  if (from === route) return;
  if (window.history.state?.inApp && window.history.state.from === route) {
    window.history.back();
    return;
  }
  window.history.pushState({ inApp: true, from }, '', hashFor(route));
  notify();
}

// Возврат на предыдущий экран; если приложение открыли сразу на этом адресе — замена на fallback
function goBack(fallback = 'nav') {
  if (window.history.state?.inApp) {
    window.history.back();
    return;
  }
  window.history.replaceState(null, '', hashFor(fallback));
  notify();
}

function subscribeRoute(callback) {
  window.addEventListener('popstate', callback);
  window.addEventListener('hashchange', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener('hashchange', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

const currentRoute = () => parseRoute(window.location.hash);

export { ROUTES, parseRoute, hashFor, navigate, goBack, subscribeRoute, currentRoute };
