import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { FieldHintProps } from '../types/hint';
import { hintPopupStyle } from '../utils/hintPosition';
import './FieldHint.scss';

export function FieldHint({
  label,
  name,
  openName,
  onOpenChange,
  align = 'start',
  children,
}: FieldHintProps) {
  const open = openName === name;
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      return;
    }

    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setPopupStyle(
        hintPopupStyle(
          rect,
          { width: window.innerWidth, height: window.innerHeight },
          align,
        ),
      );
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [align, open]);

  return (
    <span
      className={`hint${open ? ' hint--open' : ''}`}
      onMouseEnter={() => onOpenChange(name)}
      onMouseLeave={() => onOpenChange(null)}
    >
      <button
        ref={buttonRef}
        type="button"
        className="hint__button"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        aria-controls={id}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (window.matchMedia('(hover: hover)').matches) {
            return;
          }
          onOpenChange(open ? null : name);
        }}
        onBlur={() => onOpenChange(null)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle
            cx="8"
            cy="8"
            r="6.25"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          />
          <path
            d="M8 7.15v4.1"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
          <circle cx="8" cy="5.15" r="0.75" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <span id={id} role="tooltip" className="hint__popup" style={popupStyle}>
          {children}
        </span>
      ) : null}
    </span>
  );
}
