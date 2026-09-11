import type { ChatMessage, ChatRequest } from '../types/chat.ts';

export const JSON_MODE_INSTRUCTION =
  'Respond with a valid JSON object only. Do not wrap it in markdown. Do not invent keys the user did not ask for.';

export function buildChatMessages(
  request: Pick<
    ChatRequest,
    'prompt' | 'systemPrompt' | 'jsonMode' | 'messages'
  >,
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  if (request.jsonMode) {
    messages.push({ role: 'system', content: JSON_MODE_INSTRUCTION });
  }

  const systemPrompt = request.systemPrompt?.trim();
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  if (request.messages?.length) {
    messages.push(...request.messages);
  }

  const prompt = request.prompt.trim();
  if (prompt) {
    messages.push({ role: 'user', content: prompt });
  }

  return messages;
}

export function buildProviderPayload(
  request: ChatRequest,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: request.model,
    temperature: request.temperature,
    stream: true,
    stream_options: { include_usage: true },
    messages: buildChatMessages(request),
  };

  if (request.jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  if (request.maxTokens) {
    payload.max_tokens = request.maxTokens;
  }

  return payload;
}
