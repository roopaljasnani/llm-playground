import {
  useId,
  useRef,
  useState,
  type SubmitEvent,
  type KeyboardEvent,
} from 'react';
import { ContextMeter } from '../components/ContextMeter';
import { ConversationThread } from '../components/ConversationThread';
import { FieldHint } from '../components/FieldHint';
import { PayloadPreview } from '../components/PayloadPreview';
import { ResponsePane } from '../components/ResponsePane';
import { RunHistory } from '../components/RunHistory';
import { useChatCompletion } from '../hooks/useChatCompletion';
import { useCompareCompletion } from '../hooks/useCompareCompletion';
import { completeChat } from '../lib/llm';
import type {
  ChatMessage,
  ChatRequest,
  CompletionResult,
  RunRecord,
} from '../types/chat';
import { MAX_TEMPERATURE } from '../utils/chatRequest';
import {
  applyConversationSummary,
  buildSummaryRequest,
  contextUsage,
  estimatePromptTokens,
  splitThreadForSummary,
} from '../utils/context';
import { formatMaxTokens, formatScore } from '../utils/format';
import { buildProviderPayload } from '../utils/messages';
import { MODELS, modelContextWindow, modelLabel } from '../utils/models';
import {
  DEFAULT_QUALITY_THRESHOLD,
  buildQualityJudgeRequest,
  emptyQuality,
  parseQualityScores,
  shouldRegenerate,
  type QualityScores,
  type QualityView,
} from '../utils/quality';
import {
  createRunRecord,
  prependRun,
  shouldRecordRun,
} from '../utils/runHistory';
import './Playground.scss';

const Playground: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState<string>(MODELS[0].id);
  const [compareModel, setCompareModel] = useState<string>(MODELS[1].id);
  const [compareMode, setCompareMode] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(0);
  const [jsonMode, setJsonMode] = useState(false);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [openHint, setOpenHint] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [qualityThreshold, setQualityThreshold] = useState(
    DEFAULT_QUALITY_THRESHOLD,
  );
  const [leftQuality, setLeftQuality] = useState<QualityView>(() =>
    emptyQuality(DEFAULT_QUALITY_THRESHOLD),
  );
  const [rightQuality, setRightQuality] = useState<QualityView>(() =>
    emptyQuality(DEFAULT_QUALITY_THRESHOLD),
  );
  const summarizeAbortRef = useRef<AbortController | null>(null);
  const gateAbortRef = useRef<AbortController | null>(null);

  const systemPromptId = useId();
  const promptId = useId();
  const modelId = useId();
  const compareModelId = useId();
  const temperatureId = useId();
  const maxTokensId = useId();
  const jsonModeId = useId();
  const compareModeId = useId();
  const qualityThresholdId = useId();

  const primary = useChatCompletion();
  const compare = useCompareCompletion();
  const hint = {
    openName: openHint,
    onOpenChange: setOpenHint,
  };

  const running = compareMode
    ? compare.left.status === 'running' || compare.right.status === 'running'
    : primary.status === 'running';
  const scoring =
    leftQuality.phase === 'scoring' ||
    leftQuality.phase === 'regenerating' ||
    rightQuality.phase === 'scoring' ||
    rightQuality.phase === 'regenerating';
  const busy = running || summarizing || scoring;
  const canRun =
    prompt.trim().length > 0 &&
    !busy &&
    (!compareMode || compareModel !== model);

  const stopAll = () => {
    primary.stop();
    compare.stop();
    summarizeAbortRef.current?.abort();
    gateAbortRef.current?.abort();
  };

  const beginGate = () => {
    gateAbortRef.current?.abort();
    const controller = new AbortController();
    gateAbortRef.current = controller;
    return controller;
  };

  const scoreReply = async (
    request: ChatRequest,
    reply: string,
    signal: AbortSignal,
  ): Promise<QualityScores> => {
    const raw = await completeChat(
      buildQualityJudgeRequest(request, reply),
      signal,
    );
    const parsed = parseQualityScores(raw);
    if (typeof parsed === 'string') {
      throw new Error(parsed);
    }
    return parsed;
  };

  const buildRequest = (modelIdValue: string): ChatRequest => ({
    prompt: prompt.trim(),
    model: modelIdValue,
    temperature,
    jsonMode,
    ...(systemPrompt.trim() ? { systemPrompt: systemPrompt.trim() } : {}),
    ...(thread.length ? { messages: thread } : {}),
    ...(maxTokens > 0 ? { maxTokens } : {}),
  });

  const record = (request: ChatRequest, result: CompletionResult) => {
    if (!shouldRecordRun(result)) {
      return;
    }

    setRuns((current) =>
      prependRun(
        current,
        createRunRecord(crypto.randomUUID(), request, result),
      ),
    );
  };

  const commitThread = (request: ChatRequest, result: CompletionResult) => {
    if (result.text && !result.error) {
      setThread((current) => [
        ...current,
        { role: 'user', content: request.prompt },
        { role: 'assistant', content: result.text },
      ]);
      setPrompt('');
    }
  };

  const scoreOne = async (
    setQuality: (quality: QualityView) => void,
    request: ChatRequest,
    result: CompletionResult,
    signal: AbortSignal,
  ) => {
    if (!result.text || result.error || result.aborted) {
      return;
    }

    setQuality({
      scores: null,
      threshold: qualityThreshold,
      phase: 'scoring',
      retries: 0,
      error: null,
    });

    try {
      const scores = await scoreReply(request, result.text, signal);
      if (signal.aborted) {
        return;
      }
      setQuality({
        scores,
        threshold: qualityThreshold,
        phase: 'ready',
        retries: 0,
        error: null,
      });
    } catch (caught) {
      if (signal.aborted) {
        return;
      }
      setQuality({
        scores: null,
        threshold: qualityThreshold,
        phase: 'error',
        retries: 0,
        error:
          caught instanceof Error
            ? caught.message
            : 'Could not score this reply.',
      });
    }
  };

  const runSingle = async (request: ChatRequest, signal: AbortSignal) => {
    let result = await primary.run(request);
    if (signal.aborted || result.aborted || !result.text || result.error) {
      record(request, result);
      return;
    }

    setLeftQuality({
      scores: null,
      threshold: qualityThreshold,
      phase: 'scoring',
      retries: 0,
      error: null,
    });

    let scores: QualityScores;
    let retries = 0;

    try {
      scores = await scoreReply(request, result.text, signal);
    } catch (caught) {
      if (signal.aborted) {
        record(request, result);
        commitThread(request, result);
        return;
      }
      setLeftQuality({
        scores: null,
        threshold: qualityThreshold,
        phase: 'error',
        retries: 0,
        error:
          caught instanceof Error
            ? caught.message
            : 'Could not score this reply.',
      });
      record(request, result);
      commitThread(request, result);
      return;
    }

    if (signal.aborted) {
      record(request, result);
      commitThread(request, result);
      return;
    }

    if (shouldRegenerate(scores, qualityThreshold, retries)) {
      retries = 1;
      setLeftQuality({
        scores,
        threshold: qualityThreshold,
        phase: 'regenerating',
        retries,
        error: null,
      });
      const retry = await primary.run(request);
      if (signal.aborted || retry.aborted) {
        record(request, result);
        commitThread(request, result);
        return;
      }
      if (retry.text && !retry.error) {
        result = retry;
        setLeftQuality({
          scores,
          threshold: qualityThreshold,
          phase: 'scoring',
          retries,
          error: null,
        });
        try {
          scores = await scoreReply(request, result.text, signal);
        } catch (caught) {
          if (signal.aborted) {
            record(request, result);
            commitThread(request, result);
            return;
          }
          setLeftQuality({
            scores,
            threshold: qualityThreshold,
            phase: 'error',
            retries,
            error:
              caught instanceof Error
                ? caught.message
                : 'Could not score this reply.',
          });
          record(request, result);
          commitThread(request, result);
          return;
        }
      }
    }

    if (signal.aborted) {
      record(request, result);
      commitThread(request, result);
      return;
    }

    setLeftQuality({
      scores,
      threshold: qualityThreshold,
      phase: 'ready',
      retries,
      error: null,
    });
    record(request, result);
    commitThread(request, result);
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!canRun) {
      return;
    }

    const leftRequest = buildRequest(model);
    const gate = beginGate();
    setLeftQuality(emptyQuality(qualityThreshold));
    setRightQuality(emptyQuality(qualityThreshold));

    if (!compareMode) {
      void runSingle(leftRequest, gate.signal);
      return;
    }

    const rightRequest = buildRequest(compareModel);
    void compare.run(leftRequest, rightRequest).then(async ([left, right]) => {
      record(leftRequest, left);
      record(rightRequest, right);
      if (gate.signal.aborted) {
        return;
      }

      await Promise.all([
        scoreOne(setLeftQuality, leftRequest, left, gate.signal),
        scoreOne(setRightQuality, rightRequest, right, gate.signal),
      ]);
    });
  };

  const onPromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.currentTarget.form?.requestSubmit();
    }
  };

  const restore = (run: RunRecord) => {
    setSelectedRunId(run.id);
    setPrompt(run.prompt);
    setSystemPrompt(run.systemPrompt);
    setModel(run.model);
    setTemperature(Math.min(run.temperature, MAX_TEMPERATURE));
    setJsonMode(run.jsonMode);
    setMaxTokens(run.maxTokens ?? 0);
  };

  const leftRequest = buildRequest(model);
  const rightRequest = buildRequest(compareModel);
  const leftContext = contextUsage(
    estimatePromptTokens(leftRequest),
    modelContextWindow(model),
  );
  const rightContext = contextUsage(
    estimatePromptTokens(rightRequest),
    modelContextWindow(compareModel),
  );
  const formContext =
    compareMode && rightContext.percent > leftContext.percent
      ? rightContext
      : leftContext;
  const canSummarize =
    thread.length > 0 && !busy && (formContext.warning || formContext.exceeded);

  const summarizeThread = () => {
    const { older, recent } = splitThreadForSummary(thread);
    if (older.length === 0) {
      return;
    }

    summarizeAbortRef.current?.abort();
    const controller = new AbortController();
    summarizeAbortRef.current = controller;
    setSummarizing(true);
    setSummaryError(null);

    void completeChat(buildSummaryRequest(older, model), controller.signal)
      .then((summary) => {
        if (controller.signal.aborted) {
          return;
        }
        setThread(applyConversationSummary(summary, recent));
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setSummaryError(
          caught instanceof Error
            ? caught.message
            : 'Could not summarize the chat.',
        );
      })
      .finally(() => {
        if (summarizeAbortRef.current === controller) {
          setSummarizing(false);
        }
      });
  };

  const leftPayload = buildProviderPayload(leftRequest);
  const rightPayload = compareMode
    ? buildProviderPayload(rightRequest)
    : undefined;

  return (
    <div className="playground">
      <header className="playground__header">
        <h1>LLM Playground</h1>
        <p>
          A small lab for prompt, model, and temperature. Runs on local Ollama
          by default — no cloud key or billing. Watch streaming, tokens, and
          latency.
        </p>
      </header>

      <div className="playground__grid">
        <form className="playground__form" onSubmit={submit}>
          <div className="field">
            <span className="field__label">
              <span className="field__title">
                <label htmlFor={systemPromptId}>System prompt</label>
                <FieldHint name="system" label="system prompt" {...hint}>
                  Standing instructions for the model — who it is and how it
                  should behave. Sent with every run. Optional.
                </FieldHint>
              </span>
            </span>
            <textarea
              id={systemPromptId}
              name="systemPrompt"
              rows={3}
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              placeholder="Optional. Who is the model, and what must it do?"
            />
          </div>

          <div className="field">
            <span className="field__label">
              <span className="field__title">
                <label htmlFor={promptId}>
                  {thread.length > 0 ? 'Next message' : 'Prompt'}
                </label>
                <FieldHint name="prompt" label="prompt" {...hint}>
                  The user message for this run. Prior turns stay in the
                  conversation and are sent again with it.
                </FieldHint>
              </span>
              {thread.length > 0 ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setThread([])}
                >
                  Clear chat
                </button>
              ) : null}
            </span>
            <textarea
              id={promptId}
              name="prompt"
              rows={8}
              required
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={onPromptKeyDown}
              placeholder={
                thread.length > 0
                  ? 'Ask a follow-up…'
                  : 'Explain this error to me…'
              }
            />
          </div>

          <div className="check">
            <input
              id={compareModeId}
              type="checkbox"
              checked={compareMode}
              onChange={(event) => setCompareMode(event.target.checked)}
            />
            <label htmlFor={compareModeId}>Compare models</label>
            <FieldHint name="compare" label="compare models" {...hint}>
              Run the same prompt and chat history on two models at once.
              Neither reply is added to the conversation.
            </FieldHint>
          </div>

          <div className="playground__controls">
            <div className="field">
              <span className="field__label">
                <span className="field__title">
                  <label htmlFor={modelId}>
                    {compareMode ? 'Model A' : 'Model'}
                  </label>
                  <FieldHint name="model" label="model" {...hint}>
                    Which local Ollama model answers. Smaller is faster. Larger
                    is usually better at hard questions.
                  </FieldHint>
                </span>
              </span>
              <select
                id={modelId}
                name="model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
              >
                {MODELS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} · {option.detail}
                  </option>
                ))}
              </select>
            </div>

            {compareMode ? (
              <div className="field">
                <span className="field__label">
                  <span className="field__title">
                    <label htmlFor={compareModelId}>Model B</label>
                    <FieldHint
                      name="compare-model"
                      align="end"
                      label="compare model"
                      {...hint}
                    >
                      The second model. Pick a different one than Model A.
                    </FieldHint>
                  </span>
                </span>
                <select
                  id={compareModelId}
                  name="compareModel"
                  value={compareModel}
                  onChange={(event) => setCompareModel(event.target.value)}
                >
                  {MODELS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label} · {option.detail}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="field">
                <span className="field__label">
                  <span className="field__title">
                    <label htmlFor={temperatureId}>Temperature</label>
                    <FieldHint
                      name="temperature"
                      align="end"
                      label="temperature"
                      {...hint}
                    >
                      How random the reply can be. 0 is more predictable. 1 is
                      the maximum. 0.7 is a common default.
                    </FieldHint>
                  </span>
                  <span className="field__value">{temperature.toFixed(1)}</span>
                </span>
                <input
                  id={temperatureId}
                  name="temperature"
                  type="range"
                  min={0}
                  max={MAX_TEMPERATURE}
                  step={0.1}
                  value={temperature}
                  onChange={(event) =>
                    setTemperature(Number(event.target.value))
                  }
                />
              </div>
            )}
          </div>

          {compareMode ? (
            <div className="field">
              <span className="field__label">
                <span className="field__title">
                  <label htmlFor={temperatureId}>Temperature</label>
                  <FieldHint name="temperature" label="temperature" {...hint}>
                    How random the reply can be. Applied to both models. 1 is
                    the maximum.
                  </FieldHint>
                </span>
                <span className="field__value">{temperature.toFixed(1)}</span>
              </span>
              <input
                id={temperatureId}
                name="temperature"
                type="range"
                min={0}
                max={MAX_TEMPERATURE}
                step={0.1}
                value={temperature}
                onChange={(event) => setTemperature(Number(event.target.value))}
              />
            </div>
          ) : null}

          <div className="field">
            <span className="field__label">
              <span className="field__title">
                <label htmlFor={maxTokensId}>Max tokens</label>
                <FieldHint name="max-tokens" label="max tokens" {...hint}>
                  Cap on how long the reply can be. 0 means no cap — the model
                  stops when it is done.
                </FieldHint>
              </span>
              <span className="field__value">{formatMaxTokens(maxTokens)}</span>
            </span>
            <input
              id={maxTokensId}
              name="maxTokens"
              type="range"
              min={0}
              max={2048}
              step={64}
              value={maxTokens}
              onChange={(event) => setMaxTokens(Number(event.target.value))}
            />
          </div>

          <div className="field">
            <span className="field__label">
              <span className="field__title">
                <label htmlFor={qualityThresholdId}>Quality threshold</label>
                <FieldHint
                  name="quality-threshold"
                  label="quality threshold"
                  {...hint}
                >
                  After a reply, a judge scores relevance, coherence, and
                  helpfulness from 0 to 1. In single-model mode, a score below
                  this value regenerates once. Compare still scores both sides
                  but does not retry.
                </FieldHint>
              </span>
              <span className="field__value">
                {formatScore(qualityThreshold)}
              </span>
            </span>
            <input
              id={qualityThresholdId}
              name="qualityThreshold"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={qualityThreshold}
              onChange={(event) =>
                setQualityThreshold(Number(event.target.value))
              }
            />
          </div>

          <div className="check">
            <input
              id={jsonModeId}
              type="checkbox"
              checked={jsonMode}
              onChange={(event) => setJsonMode(event.target.checked)}
            />
            <label htmlFor={jsonModeId}>JSON output</label>
            <FieldHint name="json" label="JSON output" {...hint}>
              Ask the model to reply with a JSON object only — no markdown, no
              extra prose. Useful when you want structured output.
            </FieldHint>
          </div>

          <div className="playground__actions">
            <button type="submit" className="button" disabled={!canRun}>
              {compareMode ? 'Compare' : 'Run'}
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={stopAll}
              disabled={!busy}
            >
              Stop
            </button>
            <p className="playground__hint">⌘↵ or Ctrl+Enter</p>
          </div>

          {compareMode && compareModel === model ? (
            <p className="error" role="alert">
              Pick two different models to compare.
            </p>
          ) : null}
        </form>

        <section className="playground__response" aria-live="polite">
          {compareMode ? (
            <div className="context-meter-stack">
              <ContextMeter
                usage={leftContext}
                label={modelLabel(model)}
                onSummarize={summarizeThread}
                canSummarize={canSummarize}
                summarizing={summarizing}
              />
              <ContextMeter
                usage={rightContext}
                label={modelLabel(compareModel)}
                onSummarize={summarizeThread}
                canSummarize={canSummarize}
                summarizing={summarizing}
              />
            </div>
          ) : (
            <ContextMeter
              usage={formContext}
              onSummarize={summarizeThread}
              canSummarize={canSummarize}
              summarizing={summarizing}
            />
          )}
          {formContext.exceeded ? (
            <p className="error" role="alert">
              This prompt is over the model context window. Summarize earlier
              turns or shorten the chat before running.
            </p>
          ) : null}
          {summaryError ? (
            <p className="error" role="alert">
              {summaryError}
            </p>
          ) : null}

          <ConversationThread messages={thread} />

          {compareMode ? (
            <div className="playground__compare">
              <ResponsePane
                title={modelLabel(model)}
                status={compare.left.status}
                error={compare.left.error}
                text={compare.left.text}
                jsonMode={jsonMode}
                quality={leftQuality}
                onStop={stopAll}
              />
              <ResponsePane
                title={modelLabel(compareModel)}
                status={compare.right.status}
                error={compare.right.error}
                text={compare.right.text}
                jsonMode={jsonMode}
                quality={rightQuality}
                onStop={stopAll}
              />
            </div>
          ) : (
            <ResponsePane
              title="Response"
              status={primary.status}
              error={primary.error}
              text={primary.text}
              jsonMode={jsonMode}
              quality={leftQuality}
              onStop={stopAll}
            />
          )}

          <PayloadPreview payload={leftPayload} comparePayload={rightPayload} />

          <RunHistory
            runs={runs}
            selectedId={selectedRunId}
            hint={hint}
            onRestore={restore}
          />
        </section>
      </div>
    </div>
  );
};

export default Playground;
