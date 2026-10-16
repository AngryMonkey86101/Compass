// Буквенная метка точки по её порядковому номеру: 0 → A, 25 → Z, 26 → AA, 27 → AB …
function indexToLetters(index) {
  let n = Math.max(0, Math.floor(index));
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

// Оценка точности GPS для цвета: ok ≤ 15 м, warn ≤ 50 м, иначе danger
function accuracyTone(accuracy) {
  if (!Number.isFinite(accuracy)) return 'muted';
  if (accuracy <= 15) return 'ok';
  if (accuracy <= 50) return 'warn';
  return 'danger';
}

export { indexToLetters, accuracyTone };
