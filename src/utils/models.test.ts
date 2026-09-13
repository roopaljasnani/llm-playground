import { describe, expect, it } from 'vitest';
import { modelContextWindow, modelLabel } from './models';

describe('modelLabel', () => {
  it('maps a known id to a display name', () => {
    expect(modelLabel('llama3.2')).toBe('Llama 3.2');
    expect(modelLabel('gemma3:4b')).toBe('Gemma 3');
  });

  it('falls back to the raw id', () => {
    expect(modelLabel('custom-model')).toBe('custom-model');
  });

  it('returns the model context window', () => {
    expect(modelContextWindow('llama3.2')).toBe(131072);
    expect(modelContextWindow('qwen2.5:7b')).toBe(32768);
    expect(modelContextWindow('unknown')).toBe(8192);
  });
});
