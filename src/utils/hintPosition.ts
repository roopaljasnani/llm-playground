import type { HintAlign } from '../types/hint';

export const HINT_WIDTH = 264;
export const HINT_VIEWPORT_GAP = 8;
export const HINT_FLIP_SPACE = 140;

export type HintRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type HintViewport = {
  width: number;
  height: number;
};

export type HintPopupStyle = {
  width: number;
  left: number;
  top: number;
  transform?: string;
};

export function hintPopupStyle(
  rect: HintRect,
  viewport: HintViewport,
  align: HintAlign = 'start',
): HintPopupStyle {
  const width = Math.min(HINT_WIDTH, viewport.width - HINT_VIEWPORT_GAP * 2);
  let left = align === 'end' ? rect.right - width : rect.left;
  left = Math.max(
    HINT_VIEWPORT_GAP,
    Math.min(left, viewport.width - width - HINT_VIEWPORT_GAP),
  );

  const openAbove = viewport.height - rect.bottom < HINT_FLIP_SPACE;
  const top = openAbove
    ? rect.top - HINT_VIEWPORT_GAP
    : rect.bottom + HINT_VIEWPORT_GAP;

  return {
    width,
    left,
    top,
    ...(openAbove ? { transform: 'translateY(-100%)' } : {}),
  };
}
