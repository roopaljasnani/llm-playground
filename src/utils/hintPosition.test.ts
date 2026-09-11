import { describe, expect, it } from 'vitest';
import { HINT_WIDTH, hintPopupStyle } from './hintPosition';

const rect = { left: 40, right: 60, top: 80, bottom: 100 };

describe('hintPopupStyle', () => {
  it('opens below when there is room', () => {
    expect(hintPopupStyle(rect, { width: 800, height: 600 })).toEqual({
      width: HINT_WIDTH,
      left: 40,
      top: 108,
    });
  });

  it('flips above near the bottom of the viewport', () => {
    expect(hintPopupStyle(rect, { width: 800, height: 120 })).toEqual({
      width: HINT_WIDTH,
      left: 40,
      top: 72,
      transform: 'translateY(-100%)',
    });
  });

  it('aligns to the end and stays on screen', () => {
    const style = hintPopupStyle(
      { left: 760, right: 820, top: 80, bottom: 100 },
      { width: 800, height: 600 },
      'end',
    );

    expect(style.left).toBe(800 - HINT_WIDTH - 8);
    expect(style.top).toBe(108);
  });

  it('shrinks on a narrow viewport', () => {
    expect(hintPopupStyle(rect, { width: 200, height: 600 }).width).toBe(184);
  });
});
