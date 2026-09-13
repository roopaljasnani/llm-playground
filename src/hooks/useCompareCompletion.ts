import { useRef } from 'react';
import { streamCompare } from '../lib/llm';
import type { ChatRequest, CompareSide, CompletionResult } from '../types/chat';
import { useChatCompletion } from './useChatCompletion';

export function useCompareCompletion() {
  const left = useChatCompletion();
  const right = useChatCompletion();
  const abortRef = useRef<AbortController | null>(null);

  const stop = () => {
    abortRef.current?.abort();
  };

  const run = async (
    leftRequest: ChatRequest,
    rightRequest: ChatRequest,
  ): Promise<[CompletionResult, CompletionResult]> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    left.start(controller);
    right.start(controller);

    const results: Partial<Record<CompareSide, CompletionResult>> = {};

    const finishSide = (side: CompareSide, aborted = false) => {
      if (results[side]) {
        return;
      }
      const completion = side === 'left' ? left : right;
      results[side] = aborted
        ? completion.finish({ aborted: true })
        : completion.finish();
    };

    try {
      for await (const event of streamCompare(
        leftRequest,
        rightRequest,
        controller.signal,
      )) {
        if (event.type === 'closed') {
          finishSide(event.side);
          continue;
        }

        const { side, ...chunk } = event;
        if (side === 'left') {
          left.ingest(chunk);
        } else {
          right.ingest(chunk);
        }

        if (chunk.type === 'error') {
          finishSide(side);
        }
      }

      const aborted = controller.signal.aborted;
      finishSide('left', aborted);
      finishSide('right', aborted);
      return [results.left!, results.right!];
    } catch (caught) {
      if (controller.signal.aborted) {
        finishSide('left', true);
        finishSide('right', true);
        return [results.left!, results.right!];
      }

      const message =
        caught instanceof Error ? caught.message : 'Something went wrong.';
      if (!results.left) {
        left.ingest({ type: 'error', message });
      }
      if (!results.right) {
        right.ingest({ type: 'error', message });
      }
      finishSide('left');
      finishSide('right');
      return [results.left!, results.right!];
    }
  };

  return { left, right, run, stop };
}
