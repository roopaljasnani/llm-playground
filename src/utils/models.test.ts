import { describe, expect, it } from 'vitest';
import { modelLabel } from './models';

describe('modelLabel', () => {
  it('maps a known id to a display name', () => {
    expect(modelLabel('llama3.2')).toBe('Llama 3.2');
    expect(modelLabel('gemma3:4b')).toBe('Gemma 3');
  });

  it('falls back to the raw id', () => {
    expect(modelLabel('custom-model')).toBe('custom-model');
  });
});
