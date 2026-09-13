import { useRef, useState } from 'react';
import { streamChat } from '../lib/llm';
import type {
  ChatChunk,
  ChatRequest,
  CompletionResult,
  CompletionStatus,
  TokenUsage,
} from '../types/chat';

export type { CompletionResult, CompletionStatus };

type Accumulator = {
  output: string;
  usage: TokenUsage | null;
  firstTokenMs: number | null;
  error: string | null;
};

function emptyAccumulator(): Accumulator {
  return {
    output: '',
    usage: null,
    firstTokenMs: null,
    error: null,
  };
}

export function useChatCompletion() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<CompletionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [firstTokenMs, setFirstTokenMs] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const accRef = useRef<Accumulator>(emptyAccumulator());
  const startedAtRef = useRef(0);

  const elapsed = () => Math.round(performance.now() - startedAtRef.current);

  const stop = () => {
    abortRef.current?.abort();
  };

  const start = (controller: AbortController) => {
    abortRef.current = controller;
    accRef.current = emptyAccumulator();
    startedAtRef.current = performance.now();
    setText('');
    setUsage(null);
    setTotalMs(null);
    setFirstTokenMs(null);
    setError(null);
    setStatus('running');
  };

  const ingest = (chunk: ChatChunk) => {
    const acc = accRef.current;

    if (chunk.type === 'error') {
      acc.error = chunk.message;
      setError(chunk.message);
      setStatus('error');
      return;
    }

    if (chunk.type === 'delta') {
      if (acc.firstTokenMs === null) {
        acc.firstTokenMs = elapsed();
        setFirstTokenMs(acc.firstTokenMs);
      }
      acc.output += chunk.text;
      setText(acc.output);
    }

    if (chunk.type === 'usage') {
      acc.usage = chunk.usage;
      setUsage(chunk.usage);
    }
  };

  const finish = (options?: { aborted?: boolean }): CompletionResult => {
    const total = elapsed();
    const acc = accRef.current;
    setTotalMs(total);

    if (options?.aborted) {
      setStatus('idle');
      return {
        text: acc.output,
        firstTokenMs: acc.firstTokenMs,
        totalMs: total,
        usage: acc.usage,
        error: null,
        aborted: true,
      };
    }

    if (acc.error) {
      setStatus('error');
      return {
        text: acc.output,
        firstTokenMs: acc.firstTokenMs,
        totalMs: total,
        usage: acc.usage,
        error: acc.error,
        aborted: false,
      };
    }

    setStatus('idle');
    return {
      text: acc.output,
      firstTokenMs: acc.firstTokenMs,
      totalMs: total,
      usage: acc.usage,
      error: null,
      aborted: false,
    };
  };

  const run = async (request: ChatRequest): Promise<CompletionResult> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    start(controller);

    try {
      for await (const chunk of streamChat(request, controller.signal)) {
        ingest(chunk);
        if (chunk.type === 'error') {
          return finish();
        }
      }

      return finish();
    } catch (caught) {
      if (controller.signal.aborted) {
        return finish({ aborted: true });
      }

      const message =
        caught instanceof Error ? caught.message : 'Something went wrong.';
      ingest({ type: 'error', message });
      return finish();
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
    start,
    ingest,
    finish,
    stop,
  };
}
