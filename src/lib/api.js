import { createDemoWorkspace } from './demoData.js';
import { normalizeWorkspace } from './state.js';

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with status ${response.status}`);
  }
  return response.json();
}

export function createMissionControlClient(baseUrl = '') {
  return {
    async loadWorkspace() {
      try {
        const payload = await fetchJson(`${baseUrl}/api/workspace`);
        return normalizeWorkspace(payload);
      } catch {
        return createDemoWorkspace();
      }
    },

    async loadConversation(conversationId) {
      return fetchJson(`${baseUrl}/api/conversations/${conversationId}`);
    },

    async loadMission(missionId) {
      return fetchJson(`${baseUrl}/api/missions/${missionId}`);
    },

    async sendMessage(conversationId, body) {
      try {
        return await fetchJson(`${baseUrl}/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        });
      } catch {
        return {
          accepted: true,
          message: {
            id: `local-${crypto.randomUUID()}`,
            conversationId,
            authorType: 'user',
            authorId: 'you',
            body,
            createdAt: new Date().toISOString(),
          },
        };
      }
    },

    async convertMessageToTask(messageId, payload) {
      return fetchJson(`${baseUrl}/api/messages/${messageId}/convert-to-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },

    async updateTask(taskId, payload) {
      return fetchJson(`${baseUrl}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },

    async createMission(payload) {
      return fetchJson(`${baseUrl}/api/missions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },

    async updateMission(missionId, payload) {
      return fetchJson(`${baseUrl}/api/missions/${missionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },

    async addMissionLink(missionId, payload) {
      return fetchJson(`${baseUrl}/api/missions/${missionId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },

    subscribe(onEvent, onReady) {
      if (typeof EventSource === 'undefined') return () => {};

      const stream = new EventSource(`${baseUrl}/events`);
      const listeners = [
        ['ready', (message) => onReady?.(JSON.parse(message.data))],
        ['heartbeat', () => {}],
        ['message.created', (message) => onEvent({ type: 'message.created', ...JSON.parse(message.data) })],
        ['message.delta', (message) => onEvent({ type: 'message.delta', ...JSON.parse(message.data) })],
        ['message.completed', (message) => onEvent({ type: 'message.completed', ...JSON.parse(message.data) })],
        ['agent.status', (message) => onEvent({ type: 'agent.status', ...JSON.parse(message.data) })],
        ['task.updated', (message) => onEvent({ type: 'task.updated', ...JSON.parse(message.data) })],
        ['mission.updated', (message) => onEvent({ type: 'mission.updated', ...JSON.parse(message.data) })],
        ['workspace.updated', (message) => onEvent({ type: 'workspace.updated', workspace: JSON.parse(message.data) })],
      ];

      for (const [type, handler] of listeners) {
        stream.addEventListener(type, handler);
      }

      stream.onerror = () => {
        stream.close();
      };

      return () => {
        for (const [type, handler] of listeners) {
          stream.removeEventListener(type, handler);
        }
        stream.close();
      };
    },
  };
}

export const defaultClient = createMissionControlClient('');
