# Missioncontrol v2

Missioncontrol is a chat-first internal workspace for Krabbe, Hummer, and Scout.

It combines:
- agent channels
- mission-specific threads
- task conversion from chat
- live agent status
- SQLite persistence on the host PC
- SSE updates for messages and status changes

## Stack

- React + Vite frontend
- Express backend
- SQLite via `better-sqlite3`
- OpenClaw CLI integration for real local agents
- OpenAI adapter or local fallback when OpenClaw is not available

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

## Agent integration modes

Missioncontrol supports three modes:

- `openclaw` — routes agent channels into real OpenClaw agents via the local CLI
- `openai` — uses the OpenAI Responses API directly
- `local` — lightweight fallback replies for offline/demo use
- `auto` — default; prefers OpenClaw when the CLI is installed, then OpenAI, then local fallback

### Recommended mode on the Krabben server

Use OpenClaw mode with the real agent mappings:

```bash
MISSIONCONTROL_AGENT_MODE=openclaw
MISSIONCONTROL_KRABBE_AGENT=main
MISSIONCONTROL_PROGRAMMER_AGENT=hummer
MISSIONCONTROL_SCOUT_AGENT=scout
npm start
```

Each Missioncontrol conversation gets its own stable OpenClaw session id, so the channels keep context across messages.

## Environment

Copy `.env.example` to `.env` and set what you need:

- `MISSIONCONTROL_AGENT_MODE`
- `MISSIONCONTROL_KRABBE_AGENT`
- `MISSIONCONTROL_PROGRAMMER_AGENT`
- `MISSIONCONTROL_SCOUT_AGENT`
- `MISSIONCONTROL_OPENCLAW_THINKING`
- `MISSIONCONTROL_OPENCLAW_TIMEOUT_MS`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `PORT`

If the mapped OpenClaw agent does not exist, Missioncontrol falls back locally for that channel instead of crashing.

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
