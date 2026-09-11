import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FieldHint } from './FieldHint';

function HintHost() {
  const [openName, setOpenName] = useState<string | null>(null);

  return (
    <FieldHint
      name="prompt"
      label="prompt"
      openName={openName}
      onOpenChange={setOpenName}
    >
      The question for this run.
    </FieldHint>
  );
}

describe('FieldHint', () => {
  it('shows the tooltip on hover', () => {
    render(<HintHost />);

    fireEvent.mouseEnter(
      screen.getByRole('button', { name: 'What is prompt?' }).parentElement!,
    );

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'The question for this run.',
    );
  });

  it('toggles on click when hover is unavailable', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: '(hover: hover)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });

    render(<HintHost />);
    const button = screen.getByRole('button', { name: 'What is prompt?' });

    fireEvent.click(button);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
