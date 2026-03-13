import crypto from 'node:crypto';

export function createEventHub() {
  const clients = new Map();

  function subscribe(res) {
    const id = crypto.randomUUID();
    clients.set(id, res);
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const heartbeat = setInterval(() => {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
    }, 15000);

    return () => {
      clearInterval(heartbeat);
      clients.delete(id);
    };
  }

  function publish(type, payload) {
    const frame = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of clients.values()) {
      client.write(frame);
    }
  }

  return {
    subscribe,
    publish,
  };
}
