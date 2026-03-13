import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createStore } from '../store.js';

function createTestServer() {
  const store = createStore({ dbPath: ':memory:' });
  const agentService = {
    async *streamAgent({ agentId, userPrompt }) {
      yield { type: 'delta', delta: `[${agentId}] ${userPrompt}` };
    },
  };
  return createApp({ store, agentService });
}

describe('app api', () => {
  it('creates a mission and fetches its detail view', async () => {
    const { app } = createTestServer();

    const createResponse = await request(app).post('/api/missions').send({
      title: 'Remote access setup',
      summary: 'Expose the app over Tailscale',
    });

    expect(createResponse.status).toBe(201);

    const detailResponse = await request(app).get(`/api/missions/${createResponse.body.id}`);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.title).toBe('Remote access setup');
    expect(detailResponse.body.messages).toEqual([]);
  });

  it('sends a message to one agent and stores the streamed reply', async () => {
    const { app, store } = createTestServer();

    const response = await request(app).post('/api/conversations/channel-programmer/messages').send({
      body: 'Build the API shell',
    });

    expect(response.status).toBe(202);

    await new Promise((resolve) => setTimeout(resolve, 40));
    const conversation = store.getConversation('channel-programmer');
    const reply = conversation.messages.at(-1);

    expect(reply.authorId).toBe('programmer');
    expect(reply.body).toContain('[programmer] Build the API shell');
    expect(store.getAgent('programmer').status).toBe('done');
  });

  it('broadcasts to all agents from the Alle channel', async () => {
    const { app, store } = createTestServer();

    const response = await request(app).post('/api/conversations/channel-all/messages').send({
      body: 'Report what you are working on',
    });

    expect(response.status).toBe(202);

    await new Promise((resolve) => setTimeout(resolve, 80));
    const conversation = store.getConversation('channel-all');
    const agentMessages = conversation.messages.filter((message) => message.authorType === 'agent');

    expect(agentMessages).toHaveLength(3);
    expect(agentMessages.map((message) => message.authorId).sort()).toEqual(['krabbe', 'programmer', 'scout']);
  });

  it('converts a chat message into a task with source linkage', async () => {
    const { app, store } = createTestServer();
    const source = store.getConversation('mission-mission-launch').messages[0];

    const response = await request(app).post(`/api/messages/${source.id}/convert-to-task`).send({
      ownerAgentId: 'krabbe',
      status: 'todo',
    });

    expect(response.status).toBe(201);
    expect(response.body.sourceMessageId).toBe(source.id);
    expect(response.body.ownerAgentId).toBe('krabbe');
    expect(response.body.missionId).toBe('mission-launch');
  });
});
