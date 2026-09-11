import { useId, useState, type SubmitEvent, type KeyboardEvent } from 'react';
import { ConversationThread } from '../components/ConversationThread';
import { FieldHint } from '../components/FieldHint';
import { PayloadPreview } from '../components/PayloadPreview';
import { ResponsePane } from '../components/ResponsePane';
import { RunHistory } from '../components/RunHistory';
import { useChatCompletion } from '../hooks/useChatCompletion';
import type { ChatMessage, ChatRequest, RunRecord } from '../types/chat';
import { formatMaxTokens } from '../utils/format';
import { buildProviderPayload } from '../utils/messages';
import { MODELS, modelLabel } from '../utils/models';
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

  const systemPromptId = useId();
  const promptId = useId();
  const modelId = useId();
  const compareModelId = useId();
  const temperatureId = useId();
  const maxTokensId = useId();
  const jsonModeId = useId();
  const compareModeId = useId();

  const primary = useChatCompletion();
  const secondary = useChatCompletion();
  const hint = {
    openName: openHint,
    onOpenChange: setOpenHint,
  };

  const running =
    primary.status === 'running' || secondary.status === 'running';
  const canRun =
    prompt.trim().length > 0 &&
    !running &&
    (!compareMode || compareModel !== model);

  const buildRequest = (modelIdValue: string): ChatRequest => ({
    prompt: prompt.trim(),
    model: modelIdValue,
    temperature,
    jsonMode,
    ...(systemPrompt.trim() ? { systemPrompt: systemPrompt.trim() } : {}),
    ...(thread.length ? { messages: thread } : {}),
    ...(maxTokens > 0 ? { maxTokens } : {}),
  });

  const record = (
    request: ChatRequest,
    result: Awaited<ReturnType<typeof primary.run>>,
  ) => {
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

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!canRun) {
      return;
    }

    const leftRequest = buildRequest(model);

    if (!compareMode) {
      void primary.run(leftRequest).then((result) => {
        record(leftRequest, result);
        if (result.text && !result.error) {
          setThread((current) => [
            ...current,
            { role: 'user', content: leftRequest.prompt },
            { role: 'assistant', content: result.text },
          ]);
          setPrompt('');
        }
      });
      return;
    }

    const rightRequest = buildRequest(compareModel);
    void Promise.all([
      primary.run(leftRequest),
      secondary.run(rightRequest),
    ]).then(([left, right]) => {
      record(leftRequest, left);
      record(rightRequest, right);
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
    setTemperature(run.temperature);
    setJsonMode(run.jsonMode);
    setMaxTokens(run.maxTokens ?? 0);
  };

  const leftPayload = buildProviderPayload(buildRequest(model));
  const rightPayload = compareMode
    ? buildProviderPayload(buildRequest(compareModel))
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
                      How random the reply can be. 0 is more predictable. Higher
                      is more varied. 0.7 is a common default.
                    </FieldHint>
                  </span>
                  <span className="field__value">{temperature.toFixed(1)}</span>
                </span>
                <input
                  id={temperatureId}
                  name="temperature"
                  type="range"
                  min={0}
                  max={2}
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
                    How random the reply can be. Applied to both models.
                  </FieldHint>
                </span>
                <span className="field__value">{temperature.toFixed(1)}</span>
              </span>
              <input
                id={temperatureId}
                name="temperature"
                type="range"
                min={0}
                max={2}
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
            {running ? (
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  primary.stop();
                  secondary.stop();
                }}
              >
                Stop
              </button>
            ) : (
              <button type="submit" className="button" disabled={!canRun}>
                {compareMode ? 'Compare' : 'Run'}
              </button>
            )}
            <p className="playground__hint">⌘↵ or Ctrl+Enter</p>
          </div>

          {compareMode && compareModel === model ? (
            <p className="error" role="alert">
              Pick two different models to compare.
            </p>
          ) : null}
        </form>

        <section className="playground__response" aria-live="polite">
          <ConversationThread messages={thread} />

          {compareMode ? (
            <div className="playground__compare">
              <ResponsePane
                title={modelLabel(model)}
                status={primary.status}
                error={primary.error}
                text={primary.text}
                jsonMode={jsonMode}
              />
              <ResponsePane
                title={modelLabel(compareModel)}
                status={secondary.status}
                error={secondary.error}
                text={secondary.text}
                jsonMode={jsonMode}
              />
            </div>
          ) : primary.status === 'running' ||
            primary.error ||
            thread.length === 0 ? (
            <ResponsePane
              title="Response"
              status={primary.status}
              error={primary.error}
              text={primary.text}
              jsonMode={jsonMode}
            />
          ) : null}

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
