# Krabbe Mission Board

A local command-center style frontend for Krabbe and Demant's freelance firm.

## What it does

- Gives a high-level overview of the business
- Tracks missions from capture → qualify → proposal → build → ship
- Lets you write directly into command notes on the board
- Lets you add, edit, move, and delete mission cards
- Autosaves state in the browser with `localStorage`
- Can be screenshot-tested in headless Chromium

## Files

- `index.html` — app shell
- `styles.css` — visual design
- `app.js` — state, rendering, autosave, import/export

## Run locally

From the workspace root:

```bash
python3 -m http.server 8123 -d /home/frederik/.openclaw/workspace/mission-board
```

Then open:

- `http://127.0.0.1:8123/`

## Headless screenshot test

```bash
OUT=/home/frederik/snap/chromium/common/krabbe-mission-board.png
/snap/bin/chromium --headless --no-sandbox --disable-gpu --virtual-time-budget=5000 --screenshot="$OUT" --window-size=1600,2400 'http://127.0.0.1:8123/'
```

## Notes

- The board is intentionally designed for a small freelance operation that wants clarity, pipeline visibility, and room for future agents.
- Current aesthetic direction: dark command deck + glassmorphism + premium internal tool.
