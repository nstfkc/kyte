# sandbox-react

A simple **Bun fullstack** app with **React 19** — an AI chat UI built with the
[Vercel AI SDK](https://sdk.vercel.ai) (v5), [`@ai-sdk/anthropic`](https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic),
and [shadcn/ui](https://ui.shadcn.com) components styled with **Tailwind CSS v4**.

No Vite here: the frontend is bundled automatically by Bun's native fullstack
server (`Bun.serve` with HTML route imports), and Tailwind is compiled by the
`bun-plugin-tailwind` bundler plugin.

## Requirements

- [Bun](https://bun.sh) v1.3+
- An Anthropic API key exported as `ANTHROPIC_API_KEY`

```sh
export ANTHROPIC_API_KEY=sk-ant-...
```

## Run

From the repo root (deps are installed once for the whole workspace):

```sh
bun install
```

Then start the dev server with hot reload:

```sh
bun run dev
```

The server prints its URL on startup (e.g. `http://localhost:3000`). Open it in
your browser and start chatting.

## Scripts

| Script            | Description                                        |
| ----------------- | -------------------------------------------------- |
| `bun run dev`     | Start the fullstack server with `--hot` reload     |
| `bun run start`   | Start the server without hot reload                |
| `bun run build`   | Bundle the frontend to `dist/` (minified)          |
| `bun run typecheck` | Type-check with `tsc --noEmit`                   |

## How it works

- **`src/index.ts`** — `Bun.serve` with `routes`. `/` serves the bundled
  `index.html`; `/api/chat` streams a model response with `streamText` and
  returns `result.toUIMessageStreamResponse()`.
- **`src/App.tsx`** — chat UI using `useChat` from `@ai-sdk/react` (v5 API:
  `sendMessage({ text })`, render `message.parts`).
- **`src/styles.css`** — Tailwind v4 entry (`@import "tailwindcss"`) plus the
  shadcn design-token CSS variables and a `@theme inline` mapping.
- The chat endpoint defaults to the `claude-sonnet-4-5` model.
