import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi } from 'vitest';
import { MissionControlApp } from '../App.jsx';
import { createDemoWorkspace } from '../lib/demoData.js';

function createClient() {
  const workspace = createDemoWorkspace();
  const channelAll = {
    ...workspace.conversations.find((conversation) => conversation.id === 'channel-all'),
    messages: workspace.messagesByConversation['channel-all'],
  };

  return {
    loadWorkspace: vi.fn().mockResolvedValue({
      agents: workspace.agents,
      conversations: workspace.conversations,
      missions: workspace.missions,
      tasks: workspace.tasks,
    }),
    loadConversation: vi.fn().mockImplementation(async (conversationId) =>
      conversationId === 'channel-all'
        ? channelAll
        : {
            ...workspace.conversations.find((conversation) => conversation.id === conversationId),
            messages: workspace.messagesByConversation[conversationId] || [],
          },
    ),
    loadMission: vi.fn().mockImplementation(async (missionId) => {
      const mission = workspace.missions.find((item) => item.id === missionId);
      return {
        ...mission,
        tasks: workspace.tasks.filter((task) => task.missionId === missionId),
        messages: workspace.messagesByConversation[mission.conversationId] || [],
      };
    }),
    sendMessage: vi.fn().mockResolvedValue({
      accepted: true,
      message: {
        id: 'msg-new',
        conversationId: 'channel-all',
        authorType: 'user',
        authorId: 'you',
        body: 'Hello team',
        createdAt: '2026-03-13T10:30:00Z',
      },
    }),
    convertMessageToTask: vi.fn().mockResolvedValue({
      id: 'task-converted',
      title: 'Morning follow-up',
      description: 'Morning. What is the one thing each of you should push today?',
      status: 'todo',
      ownerAgentId: 'krabbe',
      missionId: 'mission-launch',
      blockerText: '',
      createdAt: '2026-03-13T10:31:00Z',
      updatedAt: '2026-03-13T10:31:00Z',
    }),
    updateTask: vi.fn().mockImplementation(async (taskId, payload) => ({
      id: taskId,
      ...payload,
      updatedAt: '2026-03-13T10:32:00Z',
    })),
    createMission: vi.fn(),
    updateMission: vi.fn().mockResolvedValue({
      ...workspace.missions[0],
      tasks: workspace.tasks,
      messages: workspace.messagesByConversation['mission-mission-launch'],
    }),
    addMissionLink: vi.fn().mockResolvedValue({
      ...workspace.missions[0],
      links: [...workspace.missions[0].links, { id: 'link-new', missionId: 'mission-launch', label: 'New link', url: 'https://example.com' }],
      tasks: workspace.tasks,
      messages: workspace.messagesByConversation['mission-mission-launch'],
    }),
    subscribe: vi.fn(() => () => {}),
  };
}

test('loads a conversation and converts a message into a task', async () => {
  const client = createClient();
  const user = userEvent.setup();

  render(<MissionControlApp client={client} />);

  await screen.findByRole('heading', { name: 'Alle' });
  await screen.findByText(/Morning\. What is the one thing/i);

  await user.click(screen.getAllByRole('button', { name: 'To task' })[0]);
  expect(screen.getByRole('dialog', { name: 'Create task from chat' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Create task' }));

  await waitFor(() => {
    expect(client.convertMessageToTask).toHaveBeenCalled();
    expect(screen.getAllByText('Morning follow-up').length).toBeGreaterThan(0);
  });
});
