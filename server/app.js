import path from 'node:path';
import express from 'express';
import { createStore } from './store.js';
import { createEventHub } from './eventHub.js';
import { createAgentService } from './agents.js';
import { AGENT_DEFINITIONS } from './constants.js';
import { truncate } from './utils.js';

export function createApp(options = {}) {
  const app = express();
  const store = options.store || createStore();
  const eventHub = options.eventHub || createEventHub();
  const agentService = options.agentService || createAgentService();
  const distPath = path.join(process.cwd(), 'dist');

  app.use(express.json());

  app.get('/api/workspace', (_req, res) => {
    res.json(store.getWorkspace());
  });

  app.get('/api/conversations/:conversationId', (req, res) => {
    const conversation = store.getConversation(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    return res.json(conversation);
  });

  app.get('/api/missions/:missionId', (req, res) => {
    const mission = store.getMissionDetail(req.params.missionId);
    if (!mission) {
      return res.status(404).json({ error: 'Mission not found.' });
    }
    return res.json(mission);
  });

  app.post('/api/missions', (req, res) => {
    const mission = store.createMission(req.body || {});
    eventHub.publish('mission.updated', { mission });
    eventHub.publish('workspace.updated', store.getWorkspace());
    return res.status(201).json(mission);
  });

  app.patch('/api/missions/:missionId', (req, res) => {
    const mission = store.updateMission(req.params.missionId, req.body || {});
    if (!mission) {
      return res.status(404).json({ error: 'Mission not found.' });
    }
    eventHub.publish('mission.updated', { mission });
    eventHub.publish('workspace.updated', store.getWorkspace());
    return res.json(mission);
  });

  app.post('/api/missions/:missionId/links', (req, res) => {
    const mission = store.addMissionLink(req.params.missionId, req.body || {});
    if (!mission) {
      return res.status(400).json({ error: 'Mission or link payload invalid.' });
    }
    eventHub.publish('mission.updated', { mission });
    eventHub.publish('workspace.updated', store.getWorkspace());
    return res.status(201).json(mission);
  });

  app.get('/api/tasks', (req, res) => {
    return res.json(
      store.listTasks({
        status: req.query.status,
        ownerAgentId: req.query.ownerAgentId,
        missionId: req.query.missionId,
      }),
    );
  });

  app.post('/api/tasks', (req, res) => {
    const task = store.createTask(req.body || {});
    if (!task) {
      return res.status(400).json({ error: 'Task payload invalid.' });
    }
    eventHub.publish('task.updated', { task });
    eventHub.publish('workspace.updated', store.getWorkspace());
    return res.status(201).json(task);
  });

  app.patch('/api/tasks/:taskId', (req, res) => {
    const task = store.updateTask(req.params.taskId, req.body || {});
    if (!task) {
      return res.status(400).json({ error: 'Task not found or payload invalid.' });
    }
    eventHub.publish('task.updated', { task });
    eventHub.publish('workspace.updated', store.getWorkspace());
    return res.json(task);
  });

  app.post('/api/messages/:messageId/convert-to-task', (req, res) => {
    const task = store.createTaskFromMessage(req.params.messageId, req.body || {});
    if (!task) {
      return res.status(404).json({ error: 'Message not found.' });
    }
    eventHub.publish('task.updated', { task });
    eventHub.publish('workspace.updated', store.getWorkspace());
    return res.status(201).json(task);
  });

  app.post('/api/conversations/:conversationId/messages', async (req, res) => {
    const conversation = store.getConversation(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const body = req.body?.body?.trim();
    if (!body) {
      return res.status(400).json({ error: 'Message body is required.' });
    }

    const userMessage = store.createMessage({
      conversationId: conversation.id,
      authorType: 'user',
      authorId: 'you',
      body,
    });

    eventHub.publish('message.created', {
      message: userMessage,
      conversationId: conversation.id,
    });

    res.status(202).json({
      accepted: true,
      message: userMessage,
    });

    const missionContext = conversation.missionId ? store.getMissionDetail(conversation.missionId)?.summary : null;
    const targets =
      conversation.id === 'channel-all'
        ? AGENT_DEFINITIONS.map((agent) => agent.id)
        : conversation.agentId
          ? [conversation.agentId]
          : AGENT_DEFINITIONS.map((agent) => agent.id);

    for (const agentId of targets) {
      void runAgent({
        agentId,
        conversationId: conversation.id,
        userMessageId: userMessage.id,
        userPrompt: body,
        missionContext,
      });
    }
  });

  app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const unsubscribe = eventHub.subscribe(res);
    req.on('close', unsubscribe);
  });

  app.use(express.static(distPath));
  app.get(/^(?!\/api|\/events).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  async function runAgent({ agentId, conversationId, userMessageId, userPrompt, missionContext }) {
    const history = store.getConversation(conversationId)?.messages || [];
    const run = store.startAgentRun({
      agentId,
      conversationId,
      userMessageId,
      summary: truncate(userPrompt, 140),
    });

    eventHub.publish('agent.status', { agent: store.getAgent(agentId), run });
    eventHub.publish('workspace.updated', store.getWorkspace());

    const placeholder = store.createMessage({
      conversationId,
      authorType: 'agent',
      authorId: agentId,
      body: '',
      sourceMessageId: userMessageId,
    });

    eventHub.publish('message.created', {
      message: placeholder,
      conversationId,
    });

    try {
      let fullBody = '';
      for await (const event of agentService.streamAgent({
        agentId,
        conversationId,
        userPrompt,
        history,
        missionContext,
      })) {
        if (event.type !== 'delta') continue;
        fullBody += event.delta;
        const next = store.appendMessageText(placeholder.id, event.delta);
        eventHub.publish('message.delta', {
          messageId: placeholder.id,
          conversationId,
          authorId: agentId,
          delta: event.delta,
          body: next?.body || fullBody,
        });
      }

      const finishedRun = store.finishAgentRun(run.id, 'done', truncate(fullBody || userPrompt, 140));
      eventHub.publish('message.completed', {
        messageId: placeholder.id,
        conversationId,
        authorId: agentId,
      });
      eventHub.publish('agent.status', { agent: store.getAgent(agentId), run: finishedRun });
      eventHub.publish('workspace.updated', store.getWorkspace());
    } catch (error) {
      const delta = `\n\n[Agent error] ${error.message}`;
      const next = store.appendMessageText(placeholder.id, delta);
      const finishedRun = store.finishAgentRun(run.id, 'blocked', truncate(error.message, 140));
      eventHub.publish('message.delta', {
        messageId: placeholder.id,
        conversationId,
        authorId: agentId,
        delta,
        body: next?.body || delta,
      });
      eventHub.publish('agent.status', { agent: store.getAgent(agentId), run: finishedRun });
      eventHub.publish('workspace.updated', store.getWorkspace());
    }
  }

  return {
    app,
    store,
    eventHub,
  };
}
