import { describe, it, expect } from 'vitest';
import { createDoubleTapDetector } from './doubleTap';

const tap = (detector, x, y, time, moveTo = [x, y]) => {
  detector.down(x, y);
  return detector.up(moveTo[0], moveTo[1], time);
};

describe('createDoubleTapDetector', () => {
  it('два быстрых касания рядом — двойное нажатие, третье начинает отсчёт заново', () => {
    const d = createDoubleTapDetector();
    expect(tap(d, 100, 100, 0)).toBe(false);
    expect(tap(d, 110, 105, 250)).toBe(true);
    expect(tap(d, 110, 105, 400)).toBe(false);
  });

  it('медленно, далеко друг от друга или со сдвигом пальца — не двойное', () => {
    const slow = createDoubleTapDetector();
    tap(slow, 100, 100, 0);
    expect(tap(slow, 100, 100, 400)).toBe(false);

    const far = createDoubleTapDetector();
    tap(far, 100, 100, 0);
    expect(tap(far, 200, 100, 100)).toBe(false);

    const swipe = createDoubleTapDetector();
    tap(swipe, 100, 100, 0);
    expect(tap(swipe, 100, 100, 100, [100, 160])).toBe(false);
  });

  it('прерванное касание и отпускание без нажатия сбрасывают состояние', () => {
    const d = createDoubleTapDetector();
    tap(d, 100, 100, 0);
    d.cancel();
    expect(tap(d, 100, 100, 100)).toBe(false);
    expect(d.up(100, 100, 150)).toBe(false);
  });
});
