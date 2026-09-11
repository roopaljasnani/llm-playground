# LLM Playground

A tiny lab for talking to an LLM: prompt, model, temperature, streaming, token usage, latency, and JSON output.

This is a copy of the React TypeScript starter, not a fork of that repo. Keep the starter clean; grow this app instead.

## What you learn

The UI calls a same-origin `/api/chat` proxy. The proxy adds your API key and streams an OpenAI-compatible chat completion back to the browser.

```text
React form
    ↓
POST /api/chat   ← key stays on the server
    ↓
OpenAI-compatible /chat/completions (streamed)
    ↓
tokens, latency, text
```

You do not need to understand transformers. You are learning how to treat the model as an unreliable function and constrain it.

## Setup

Node.js 22+ (see `.nvmrc`).

```bash
nvm use
yarn install
cp .env.example .env
```

The default `.env` talks to local [Ollama](https://ollama.com) (no cloud bill):

```bash
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://127.0.0.1:11434/v1
```

Pull the models the UI lists, then keep Ollama running:

```bash
ollama pull llama3.2
ollama pull gemma3:4b
ollama pull qwen2.5:7b
```

`OPENAI_BASE_URL` can still point at any compatible host (OpenAI, OpenRouter, Groq, Azure, …). Restart `yarn dev` after changing env files.

```bash
yarn dev
```

Open the URL Vite prints. Type a prompt and press Run, or ⌘↵ / Ctrl+Enter.

## Scripts

| Command             | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `yarn dev`          | Start the Vite dev server                                 |
| `yarn build`        | Type-check, then write a production build to `dist/`      |
| `yarn preview`      | Serve the production build locally (proxy still works)    |
| `yarn typecheck`    | Type-check the app and Vite config via project references |
| `yarn lint`         | Run ESLint                                                |
| `yarn test`         | Run the test suite once                                   |
| `yarn test:watch`   | Run tests in watch mode                                   |
| `yarn format`       | Format the repo with Prettier                             |
| `yarn format:check` | Check formatting without writing files                    |

## Project structure

```text
server/
└── llm-proxy.ts     # Vite middleware: /api/chat → provider
src/
├── components/      # FieldHint
├── hooks/           # useChatCompletion
├── lib/llm.ts       # fetch + stream
├── pages/Playground.tsx
├── types/
├── utils/
├── styles/
├── App.tsx
├── router.tsx
└── main.tsx
```

The key is read in `server/llm-proxy.ts`. It is never prefixed with `VITE_`, so it is not bundled into the client.

## What to try next

These are the original Project 1 extras, already in the UI:

- Streaming tokens
- Time to first token and total latency
- Prompt / completion token counts
- JSON mode (`response_format: json_object`)

When this feels boring, start **Ask My Docs** as a new repo. Do not add RAG here just because you will need it later.

## License

[MIT](LICENSE) — Copyright (c) 2026 Roopal Jasnani.
