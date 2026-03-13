# Missioncontrol v2

Missioncontrol is now a chat-first internal workspace for Krabbe, Programmør, and Scout.

It combines:
- agent channels
- mission-specific threads
- task conversion from chat
- live agent status
- SQLite persistence on the host PC
- SSE streaming for message and status updates

## Stack

- React + Vite frontend
- Express backend
- SQLite via `better-sqlite3`
- OpenAI-backed agent adapter with local fallback when `OPENAI_API_KEY` is not set

## Run locally

Install dependencies:

```bash
npm install
```

Start frontend and backend in development:

```bash
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API requests to the backend on `http://localhost:8787`.

## Production-style run

Build the frontend:

```bash
npm run build
```

Start the app server:

```bash
npm start
```

Then open:

- `http://127.0.0.1:8787/`

## Environment

Copy `.env.example` to `.env` and set:

- `OPENAI_API_KEY` to enable real model-backed agents
- `OPENAI_MODEL` if you want a different model than the default
- `PORT` if the backend should listen on a different port

If `OPENAI_API_KEY` is missing, the agent channels still work with a local fallback responder so the product remains usable during setup.

## Tailscale deployment

For private access from your other PCs:

1. Install Tailscale on the always-on host PC and on the client machines.
2. Run `npm run build` once and `npm start` on the host PC.
3. Expose the local server port with Tailscale Serve.

Example:

```bash
tailscale serve --bg 8787
```

After that, open the Tailscale URL from another machine on the same tailnet.

## Tests

Run the automated suite:

```bash
npx vitest run
```

Covered flows include:
- task state transitions
- mission creation/linkage
- sending a message to one agent
- broadcasting to `Alle`
- converting a message into a task
- rendering the React app and opening the task conversion modal
