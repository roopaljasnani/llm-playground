import { describe, expect, it } from 'vitest';
import { parseChatRequest } from './chatRequest';

const valid = {
  prompt: 'Hello',
  model: 'llama3.2',
  temperature: 0.7,
  jsonMode: false,
};

describe('parseChatRequest', () => {
  it('reads a minimal body', () => {
    expect(parseChatRequest(JSON.stringify(valid))).toEqual(valid);
  });

  it('reads history and max tokens', () => {
    expect(
      parseChatRequest(
        JSON.stringify({
          ...valid,
          systemPrompt: 'Be kind.',
          maxTokens: 256,
          messages: [
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello' },
          ],
        }),
      ),
    ).toEqual({
      ...valid,
      systemPrompt: 'Be kind.',
      maxTokens: 256,
      messages: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
      ],
    });
  });

  it('rejects a missing prompt', () => {
    expect(parseChatRequest(JSON.stringify({ ...valid, prompt: '  ' }))).toBe(
      'Prompt is required.',
    );
  });

  it('rejects a system role in history', () => {
    expect(
      parseChatRequest(
        JSON.stringify({
          ...valid,
          messages: [{ role: 'system', content: 'nope' }],
        }),
      ),
    ).toBe('Message roles must be user or assistant.');
  });

  it('rejects a bad maxTokens value', () => {
    expect(parseChatRequest(JSON.stringify({ ...valid, maxTokens: 0 }))).toBe(
      'maxTokens must be an integer between 1 and 8192.',
    );
  });
});
