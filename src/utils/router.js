// Экраны приложения в адресе после «#»: #/ — навигация (стартовый), #/focus — только компас,
// #/menu, #/manual, #/qr, #/support, #/groups; с параметром — #/group/<id>, #/join/<приглашение>. Переходы кладутся в историю браузера, поэтому кнопка
// «Назад» на Android и в браузере работает без дополнительного кода. В установленном на iPhone
// приложении «Назад» нет — на каждом экране есть своя кнопка возврата.

const ROUTES = ['nav', 'focus', 'menu', 'manual', 'qr', 'support', 'groups', 'group', 'join'];
const CHANGE_EVENT = 'compass:routechange';

const segments = (hash) => String(hash ?? '').replace(/^#\/?/, '').replace(/\/$/, '').split('/');

// '#/manual' → 'manual', '#/group/abc' → 'group'; пустой или неизвестный адрес — навигация
function parseRoute(hash) {
  const name = segments(hash)[0];
  return ROUTES.includes(name) ? name : 'nav';
}

// Параметр экрана: '#/group/abc' → 'abc'; без параметра — ''
function parseRouteParam(hash) {
  return parseRoute(hash) === 'nav' ? '' : segments(hash).slice(1).join('/');
}

const hashFor = (route, param = '') => {
  if (route === 'nav') return '#/';
  return param ? `#/${route}/${param}` : `#/${route}`;
};

const notify = () => window.dispatchEvent(new Event(CHANGE_EVENT));

// history.back() асинхронный: пока браузер не прислал popstate, адрес ещё старый. Второе
// нажатие «Назад» или «Закрыть» в это окно сделало бы второй шаг назад и увело со страницы,
// поэтому переходы до прихода popstate игнорируются.
// Если popstate так и не придёт (браузер ушёл со страницы), флаг снимается по таймеру.
const BACK_TIMEOUT_MS = 1000;
let backPending = false;

const stepBack = () => {
  backPending = true;
  setTimeout(() => {
    backPending = false;
  }, BACK_TIMEOUT_MS);
  window.history.back();
};

// Переход с записью в историю. Отметка inApp в state показывает, что «назад» вернёт
// на предыдущий экран приложения, а не уведёт со страницы. Переход на экран, с которого
// пришли (меню → «Навигация»), — это шаг назад: история не растёт, «Назад» не ходит по кругу.
// Если приложение открыли сразу на экране (#/menu) и уходят на навигацию, запись заменяется:
// иначе системное «Назад» вернуло бы на только что закрытый экран.
function navigate(route, param = '') {
  if (backPending) return;
  const from = parseRoute(window.location.hash);
  const target = hashFor(route, param);
  if (hashFor(from, parseRouteParam(window.location.hash)) === target) return;
  const state = window.history.state;
  if (state?.inApp && state.from === target) {
    stepBack();
    return;
  }
  if (!state?.inApp && route === 'nav') {
    window.history.replaceState(null, '', target);
  } else {
    window.history.pushState({ inApp: true, from: window.location.hash || '#/' }, '', target);
  }
  notify();
}

// Замена текущего экрана без записи в историю: после вступления по приглашению ссылка
// с ключом группы не должна оставаться в истории браузера
function replaceRoute(route, param = '') {
  window.history.replaceState(window.history.state, '', hashFor(route, param));
  notify();
}

// Возврат на предыдущий экран; если приложение открыли сразу на этом адресе — замена на fallback
function goBack(fallback = 'nav') {
  if (backPending) return;
  if (window.history.state?.inApp) {
    stepBack();
    return;
  }
  window.history.replaceState(null, '', hashFor(fallback));
  notify();
}

// popstate приходит и при «Назад», и при ручной смене адреса после «#», поэтому отдельная
// подписка на hashchange не нужна (она давала вторую перерисовку на каждое «Назад»)
function subscribeRoute(callback) {
  const onPop = () => {
    backPending = false;
    callback();
  };
  window.addEventListener('popstate', onPop);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('popstate', onPop);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

const currentRoute = () => parseRoute(window.location.hash);
const currentRouteParam = () => parseRouteParam(window.location.hash);

export {
  ROUTES, parseRoute, parseRouteParam, hashFor, navigate, replaceRoute, goBack, subscribeRoute,
  currentRoute, currentRouteParam
};
