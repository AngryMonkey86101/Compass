// Кратчайшая разница углов (target - current) в диапазоне [-180, 180)
function shortestDelta(current, target) {
  return ((((target - current) % 360) + 540) % 360) - 180;
}

// Экспоненциальное сглаживание угла по кратчайшей дуге.
// dtMs — время с прошлого кадра, tauMs — постоянная времени фильтра:
// за tauMs угол проходит ~63% пути до цели независимо от частоты кадров.
// Результат не сворачивается в [0, 360), чтобы поворот через север был непрерывным.
function smoothAngle(current, target, dtMs, tauMs) {
  const k = 1 - Math.exp(-Math.max(dtMs, 0) / tauMs);
  return current + shortestDelta(current, target) * k;
}

export { shortestDelta, smoothAngle };
