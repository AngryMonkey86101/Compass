// Общие мелочи для текста из файлов: короткое название из описания и защита от формул в CSV.

// Первая строка текста, не длиннее max символов. Обрезка по символам Юникода, а не по
// UTF-16: иначе эмодзи на границе разрезается пополам и в названии остаётся «битый» символ.
function firstLine(text, max = 80) {
  const line = String(text ?? '').trim().split(/\r?\n/)[0].trim();
  const chars = Array.from(line);
  return chars.length > max ? chars.slice(0, max).join('') : line;
}

// Excel и Google Таблицы выполняют ячейку как формулу, если она начинается с = + - @
// (или табуляции/перевода строки). Название точки из чужого файла может быть
// «=HYPERLINK(…)», поэтому при экспорте в CSV перед таким текстом ставится апостроф —
// таблица покажет текст как есть. Апостроф в начале тоже экранируется, чтобы обратный
// разбор был однозначным.
const FORMULA_START = /^['=+\-@\t\r]/;
const PROTECTED_START = /^'(?=['=+\-@\t\r])/;

const protectFormula = (text) => (FORMULA_START.test(text) ? `'${text}` : text);
const unprotectFormula = (text) => text.replace(PROTECTED_START, '');

export { firstLine, protectFormula, unprotectFormula };
