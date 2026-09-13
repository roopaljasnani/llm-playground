import type { ChatChunk, ChatRequest, CompareChunk } from '../types/chat';
import {
  parseCompareSseData,
  parseSseData,
  readSseDataLines,
} from '../utils/sse';

export type { ChatChunk, ChatRequest, TokenUsage } from '../types/chat';
export { parseSseData } from '../utils/sse';

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string } | string;
    };
    if (typeof payload.error === 'string') {
      return payload.error;
    }
    if (payload.error?.message) {
      return payload.error.message;
    }
  } catch {
    // fall through
  }
  return `Request failed (${response.status}).`;
}

async function* readChatChunks(response: Response): AsyncGenerator<ChatChunk> {
  if (!response.body) {
    yield { type: 'error', message: 'The server returned an empty response.' };
    return;
  }

  for await (const data of readSseDataLines(response.body)) {
    const parsed = parseSseData(data);
    if (parsed === 'done') {
      return;
    }
    if (parsed) {
      yield parsed;
    }
  }
}

export async function* streamChat(
  request: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<ChatChunk> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    yield { type: 'error', message: await readErrorMessage(response) };
    return;
  }

  yield* readChatChunks(response);
}

export async function completeChat(
  request: ChatRequest,
  signal?: AbortSignal,
): Promise<string> {
  let output = '';

  for await (const chunk of streamChat(request, signal)) {
    if (chunk.type === 'error') {
      throw new Error(chunk.message);
    }
    if (chunk.type === 'delta') {
      output += chunk.text;
    }
  }

  const text = output.trim();
  if (!text) {
    throw new Error('The model returned an empty reply.');
  }

  return text;
}

export async function* streamCompare(
  left: ChatRequest,
  right: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<CompareChunk> {
  const response = await fetch('/api/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ left, right }),
    signal,
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    yield { side: 'left', type: 'error', message };
    yield { side: 'right', type: 'error', message };
    return;
  }

  if (!response.body) {
    const message = 'The server returned an empty response.';
    yield { side: 'left', type: 'error', message };
    yield { side: 'right', type: 'error', message };
    return;
  }

  for await (const data of readSseDataLines(response.body)) {
    const parsed = parseCompareSseData(data);
    if (parsed === 'done') {
      return;
    }
    if (parsed) {
      yield parsed;
    }
  }
}
