import { describe, expect, it } from 'vitest';
import type { ChatRequest } from '../types/chat';
import {
  JSON_MODE_INSTRUCTION,
  buildChatMessages,
  buildProviderPayload,
} from './messages';

const base: ChatRequest = {
  prompt: 'What is 2+2?',
  model: 'llama3.2',
  temperature: 0.7,
  jsonMode: false,
};

describe('buildChatMessages', () => {
  it('sends the prompt as the user message', () => {
    expect(buildChatMessages(base)).toEqual([
      { role: 'user', content: 'What is 2+2?' },
    ]);
  });

  it('prepends system and JSON instructions', () => {
    expect(
      buildChatMessages({
        ...base,
        jsonMode: true,
        systemPrompt: 'Be brief.',
      }),
    ).toEqual([
      { role: 'system', content: JSON_MODE_INSTRUCTION },
      { role: 'system', content: 'Be brief.' },
      { role: 'user', content: 'What is 2+2?' },
    ]);
  });

  it('omits an empty follow-up prompt', () => {
    expect(
      buildChatMessages({
        ...base,
        prompt: '  ',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    ).toEqual([{ role: 'user', content: 'Hi' }]);
  });

  it('includes prior turns before the new prompt', () => {
    expect(
      buildChatMessages({
        ...base,
        prompt: 'And 3+3?',
        messages: [
          { role: 'user', content: 'What is 2+2?' },
          { role: 'assistant', content: '4' },
        ],
      }),
    ).toEqual([
      { role: 'user', content: 'What is 2+2?' },
      { role: 'assistant', content: '4' },
      { role: 'user', content: 'And 3+3?' },
    ]);
  });
});

describe('buildProviderPayload', () => {
  it('builds the OpenAI-compatible body', () => {
    expect(buildProviderPayload({ ...base, maxTokens: 128 })).toEqual({
      model: 'llama3.2',
      temperature: 0.7,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 128,
      messages: [{ role: 'user', content: 'What is 2+2?' }],
    });
  });

  it('adds JSON response format only in JSON mode', () => {
    const payload = buildProviderPayload({ ...base, jsonMode: true });
    expect(payload.response_format).toEqual({ type: 'json_object' });
    expect(payload.max_tokens).toBeUndefined();
  });
});
