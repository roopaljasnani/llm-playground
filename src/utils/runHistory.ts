import type { ChatRequest, CompletionResult, RunRecord } from '../types/chat';

export const MAX_RUNS = 20;

export function shouldRecordRun(result: CompletionResult): boolean {
  return !(result.error && !result.text);
}

export function createRunRecord(
  id: string,
  request: ChatRequest,
  result: CompletionResult,
): RunRecord {
  return {
    id,
    model: request.model,
    prompt: request.prompt,
    systemPrompt: request.systemPrompt ?? '',
    temperature: request.temperature,
    jsonMode: request.jsonMode,
    maxTokens: request.maxTokens ?? null,
    firstTokenMs: result.firstTokenMs,
    totalMs: result.totalMs,
    promptTokens: result.usage?.promptTokens ?? null,
    completionTokens: result.usage?.completionTokens ?? null,
  };
}

export function prependRun(
  current: RunRecord[],
  next: RunRecord,
  max = MAX_RUNS,
): RunRecord[] {
  return [next, ...current].slice(0, max);
}
