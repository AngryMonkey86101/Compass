// Распознавание двойного нажатия по отпусканиям пальца или кнопки мыши. Своё, а не dblclick:
// на iPhone dblclick по нескроллируемому элементу срабатывает ненадёжно.
// Касание не засчитывается, если палец сдвинулся (прокрутка), а второе — если оно далеко от первого.

const MAX_DELAY_MS = 300;
const MAX_MOVE_PX = 10;
const MAX_GAP_PX = 40;

function createDoubleTapDetector({ maxDelay = MAX_DELAY_MS, maxMove = MAX_MOVE_PX, maxGap = MAX_GAP_PX } = {}) {
  let down = null;
  let lastTap = null;

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  return {
    // начало касания
    down(x, y) {
      down = { x, y };
    },
    // конец касания; true — это второе нажатие двойного
    up(x, y, time) {
      const start = down;
      down = null;
      if (!start || distance(start, { x, y }) > maxMove) {
        lastTap = null;
        return false;
      }
      const tap = { x, y, time };
      if (lastTap && time - lastTap.time <= maxDelay && distance(lastTap, tap) <= maxGap) {
        lastTap = null;
        return true;
      }
      lastTap = tap;
      return false;
    },
    // касание прервано системой (жест, прокрутка)
    cancel() {
      down = null;
      lastTap = null;
    }
  };
}

export { createDoubleTapDetector };
