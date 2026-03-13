import { describe, expect, it } from 'vitest';
import { createStore } from '../store.js';

describe('store', () => {
  it('creates a task from a mission message and carries source linkage', () => {
    const store = createStore({ dbPath: ':memory:' });
    const mission = store.getMissionDetail('mission-launch');
    const sourceMessage = mission.messages[0];

    const task = store.createTaskFromMessage(sourceMessage.id, {
      ownerAgentId: 'programmer',
      status: 'todo',
    });

    expect(task).toMatchObject({
      sourceMessageId: sourceMessage.id,
      missionId: 'mission-launch',
      ownerAgentId: 'programmer',
      status: 'todo',
    });
  });

  it('updates task status through the supported workflow states', () => {
    const store = createStore({ dbPath: ':memory:' });
    const task = store.createTask({
      title: 'Test transitions',
      status: 'todo',
      ownerAgentId: 'krabbe',
    });

    expect(store.updateTask(task.id, { status: 'doing' }).status).toBe('doing');
    expect(store.updateTask(task.id, { status: 'review' }).status).toBe('review');
    expect(store.updateTask(task.id, { status: 'done' }).status).toBe('done');
  });

  it('creates a mission with an attached mission conversation', () => {
    const store = createStore({ dbPath: ':memory:' });
    const mission = store.createMission({
      title: 'New mission',
      summary: 'Check mission linkage',
    });

    const detail = store.getMissionDetail(mission.id);
    const conversation = store.getConversation(detail.conversationId);

    expect(detail.title).toBe('New mission');
    expect(conversation.type).toBe('mission');
    expect(conversation.missionId).toBe(detail.id);
  });

  it('tracks agent status transitions and last-active timestamps', () => {
    const store = createStore({ dbPath: ':memory:' });
    const run = store.startAgentRun({
      agentId: 'scout',
      conversationId: 'channel-scout',
      userMessageId: null,
      summary: 'Investigate options',
    });

    const working = store.getAgent('scout');
    const finished = store.finishAgentRun(run.id, 'done', 'Research wrapped');
    const done = store.getAgent('scout');

    expect(working.status).toBe('working');
    expect(working.lastActiveAt).toBeTruthy();
    expect(finished.status).toBe('done');
    expect(done.currentTaskSummary).toBe('Research wrapped');
  });
});
