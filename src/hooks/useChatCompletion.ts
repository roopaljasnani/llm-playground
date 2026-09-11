import { useRef, useState } from 'react';
import { streamChat } from '../lib/llm';
import type {
  ChatRequest,
  CompletionResult,
  CompletionStatus,
  TokenUsage,
} from '../types/chat';

export type { CompletionResult, CompletionStatus };

export function useChatCompletion() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<CompletionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [firstTokenMs, setFirstTokenMs] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = () => {
    abortRef.current?.abort();
  };

  const run = async (request: ChatRequest): Promise<CompletionResult> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setText('');
    setUsage(null);
    setTotalMs(null);
    setFirstTokenMs(null);
    setError(null);
    setStatus('running');

    const startedAt = performance.now();
    let output = '';
    let nextUsage: TokenUsage | null = null;
    let nextFirstTokenMs: number | null = null;

    const elapsed = () => Math.round(performance.now() - startedAt);

    try {
      for await (const chunk of streamChat(request, controller.signal)) {
        if (chunk.type === 'error') {
          setError(chunk.message);
          setStatus('error');
          return {
            text: output,
            firstTokenMs: nextFirstTokenMs,
            totalMs: elapsed(),
            usage: nextUsage,
            error: chunk.message,
            aborted: false,
          };
        }

        if (chunk.type === 'delta') {
          if (nextFirstTokenMs === null) {
            nextFirstTokenMs = elapsed();
            setFirstTokenMs(nextFirstTokenMs);
          }
          output += chunk.text;
          setText(output);
        }

        if (chunk.type === 'usage') {
          nextUsage = chunk.usage;
          setUsage(chunk.usage);
        }
      }

      const total = elapsed();
      setTotalMs(total);
      setStatus('idle');
      return {
        text: output,
        firstTokenMs: nextFirstTokenMs,
        totalMs: total,
        usage: nextUsage,
        error: null,
        aborted: false,
      };
    } catch (caught) {
      const total = elapsed();
      if (controller.signal.aborted) {
        setTotalMs(total);
        setStatus('idle');
        return {
          text: output,
          firstTokenMs: nextFirstTokenMs,
          totalMs: total,
          usage: nextUsage,
          error: null,
          aborted: true,
        };
      }

      const message =
        caught instanceof Error ? caught.message : 'Something went wrong.';
      setError(message);
      setStatus('error');
      return {
        text: output,
        firstTokenMs: nextFirstTokenMs,
        totalMs: total,
        usage: nextUsage,
        error: message,
        aborted: false,
      };
    }
  };

  return {
    text,
    status,
    error,
    usage,
    totalMs,
    firstTokenMs,
    run,
    stop,
  };
}
