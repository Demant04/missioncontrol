import { createDemoWorkspace } from './demoData.js';

function groupMessages(messages = []) {
  return messages.reduce((accumulator, message) => {
    const list = accumulator[message.conversationId] || [];
    list.push(message);
    accumulator[message.conversationId] = sortMessages(list);
    return accumulator;
  }, {});
}

function sortMessages(messages) {
  return [...messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function normalizeWorkspace(payload) {
  const fallback = createDemoWorkspace();
  const source = payload && typeof payload === 'object' ? payload : fallback;
  const rawMessages =
    source.messagesByConversation && typeof source.messagesByConversation === 'object'
      ? Object.fromEntries(
          Object.entries(source.messagesByConversation).map(([conversationId, messages]) => [conversationId, sortMessages(messages)]),
        )
      : groupMessages(source.messages || []);

  return {
    agents: Array.isArray(source.agents) ? source.agents : fallback.agents,
    conversations: Array.isArray(source.conversations) ? source.conversations : fallback.conversations,
    missions: Array.isArray(source.missions) ? source.missions : fallback.missions,
    tasks: Array.isArray(source.tasks) ? source.tasks : fallback.tasks,
    messagesByConversation: Object.keys(rawMessages).length ? rawMessages : fallback.messagesByConversation,
  };
}

export function getInitialSelection(workspace) {
  return workspace.conversations[0]?.id || 'channel-all';
}

export function appendMessage(workspace, message) {
  const messages = workspace.messagesByConversation[message.conversationId] || [];
  const exists = messages.some((item) => item.id === message.id);
  return {
    ...workspace,
    messagesByConversation: {
      ...workspace.messagesByConversation,
      [message.conversationId]: exists
        ? sortMessages(messages.map((item) => (item.id === message.id ? { ...item, ...message } : item)))
        : sortMessages([...messages, message]),
    },
  };
}

export function appendMessageDelta(workspace, event) {
  const { conversationId, messageId, delta = '', body, authorId = 'agent', authorType = 'agent' } = event;
  const messages = workspace.messagesByConversation[conversationId] || [];
  const existing = messages.find((message) => message.id === messageId);

  if (existing) {
    const nextBody = typeof body === 'string' ? body : `${existing.body}${delta}`;
    return {
      ...workspace,
      messagesByConversation: {
        ...workspace.messagesByConversation,
        [conversationId]: messages.map((message) => (message.id === messageId ? { ...message, body: nextBody } : message)),
      },
    };
  }

  return appendMessage(workspace, {
    id: messageId,
    conversationId,
    authorType,
    authorId,
    body: typeof body === 'string' ? body : delta,
    createdAt: event.createdAt || new Date().toISOString(),
  });
}

export function upsertAgent(workspace, agent) {
  const exists = workspace.agents.some((item) => item.id === agent.id);
  return {
    ...workspace,
    agents: exists
      ? workspace.agents.map((item) => (item.id === agent.id ? { ...item, ...agent } : item))
      : [...workspace.agents, agent],
  };
}

export function upsertMission(workspace, mission) {
  const exists = workspace.missions.some((item) => item.id === mission.id);
  const nextMissions = exists
    ? workspace.missions.map((item) => (item.id === mission.id ? { ...item, ...mission } : item))
    : [mission, ...workspace.missions];

  const nextConversations =
    mission.conversationId && !workspace.conversations.some((item) => item.id === mission.conversationId)
      ? [
          ...workspace.conversations,
          {
            id: mission.conversationId,
            type: 'mission',
            title: mission.title,
            agentId: null,
            missionId: mission.id,
            unreadCount: 0,
          },
        ]
      : workspace.conversations.map((item) =>
          item.missionId === mission.id
            ? {
                ...item,
                title: mission.title,
              }
            : item,
        );

  return {
    ...workspace,
    missions: nextMissions,
    conversations: nextConversations,
  };
}

export function upsertTask(workspace, task) {
  const exists = workspace.tasks.some((item) => item.id === task.id);
  return {
    ...workspace,
    tasks: exists ? workspace.tasks.map((item) => (item.id === task.id ? { ...item, ...task } : item)) : [task, ...workspace.tasks],
  };
}

export function setConversationDetail(workspace, conversation) {
  const exists = workspace.conversations.some((item) => item.id === conversation.id);
  return {
    ...workspace,
    conversations: exists
      ? workspace.conversations.map((item) => (item.id === conversation.id ? { ...item, ...conversation } : item))
      : [...workspace.conversations, conversation],
    messagesByConversation: {
      ...workspace.messagesByConversation,
      [conversation.id]: sortMessages(conversation.messages || []),
    },
  };
}

export function setMissionDetail(workspace, mission) {
  let next = upsertMission(workspace, mission);
  if (mission.conversationId && Array.isArray(mission.messages)) {
    next = {
      ...next,
      messagesByConversation: {
        ...next.messagesByConversation,
        [mission.conversationId]: sortMessages(mission.messages),
      },
    };
  }

  if (Array.isArray(mission.tasks) && mission.tasks.length) {
    for (const task of mission.tasks) {
      next = upsertTask(next, task);
    }
  }

  return next;
}

export function applyEvent(workspace, event) {
  if (!event || typeof event !== 'object') return workspace;

  if (event.type === 'message.created' && event.message) return appendMessage(workspace, event.message);
  if (event.type === 'message.delta') return appendMessageDelta(workspace, event);
  if (event.type === 'agent.status' && event.agent) return upsertAgent(workspace, event.agent);
  if (event.type === 'task.updated' && event.task) return upsertTask(workspace, event.task);
  if (event.type === 'mission.updated' && event.mission) return upsertMission(workspace, event.mission);
  if (event.type === 'workspace.updated') return normalizeWorkspace(event.workspace || event);

  return workspace;
}
