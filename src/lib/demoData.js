const now = new Date('2026-03-13T10:30:00Z').toISOString();

export function createDemoWorkspace() {
  const agents = [
    {
      id: 'krabbe',
      name: 'Krabbe',
      role: 'Orchestrator',
      status: 'done',
      lastActiveAt: now,
      currentTaskSummary: 'Reviewing scope and keeping the build narrow',
      accent: '#f767b4',
    },
    {
      id: 'programmer',
      name: 'Programmør',
      role: 'Technical Builder',
      status: 'working',
      lastActiveAt: now,
      currentTaskSummary: 'Building the chat shell and wiring live events',
      accent: '#53b5ff',
    },
    {
      id: 'scout',
      name: 'Scout',
      role: 'Research and Recon',
      status: 'waiting',
      lastActiveAt: '2026-03-13T09:58:00Z',
      currentTaskSummary: 'Waiting on the next research prompt',
      accent: '#66d2a3',
    },
  ];

  const missions = [
    {
      id: 'mission-launch',
      title: 'Missioncontrol MVP',
      summary: 'Ship the chat-first internal workspace and make it reachable across devices.',
      notes: 'The first version should feel like Slack plus a light task board. Keep it private and reliable.',
      archived: false,
      conversationId: 'mission-mission-launch',
      links: [
        { id: 'link-tailscale', missionId: 'mission-launch', label: 'Tailscale docs', url: 'https://tailscale.com/docs/' },
        { id: 'link-slack', missionId: 'mission-launch', label: 'Slack AI agents', url: 'https://slack.com/ai-agents' },
      ],
    },
  ];

  const conversations = [
    { id: 'channel-all', type: 'agent', title: 'Alle', agentId: null, missionId: null, unreadCount: 0 },
    { id: 'channel-krabbe', type: 'agent', title: 'Krabbe', agentId: 'krabbe', missionId: null, unreadCount: 0 },
    { id: 'channel-programmer', type: 'agent', title: 'Programmør', agentId: 'programmer', missionId: null, unreadCount: 0 },
    { id: 'channel-scout', type: 'agent', title: 'Scout', agentId: 'scout', missionId: null, unreadCount: 0 },
    {
      id: 'mission-mission-launch',
      type: 'mission',
      title: 'Missioncontrol MVP',
      agentId: null,
      missionId: 'mission-launch',
      unreadCount: 0,
    },
  ];

  const messagesByConversation = {
    'channel-all': [
      {
        id: 'msg-all-1',
        conversationId: 'channel-all',
        authorType: 'user',
        authorId: 'you',
        body: 'Morning. What is the one thing each of you should push today?',
        createdAt: '2026-03-13T09:40:00Z',
      },
      {
        id: 'msg-all-2',
        conversationId: 'channel-all',
        authorType: 'agent',
        authorId: 'krabbe',
        body: 'Krabbe: lock scope and stop the product from drifting into dashboard territory.',
        createdAt: '2026-03-13T09:40:14Z',
      },
    ],
    'channel-programmer': [
      {
        id: 'msg-programmer-1',
        conversationId: 'channel-programmer',
        authorType: 'agent',
        authorId: 'programmer',
        body: 'Three surfaces: channels, focused chat, and a context rail for tasks and mission notes.',
        createdAt: '2026-03-13T09:05:19Z',
      },
    ],
    'mission-mission-launch': [
      {
        id: 'msg-mission-1',
        conversationId: 'mission-mission-launch',
        authorType: 'agent',
        authorId: 'krabbe',
        body: 'Mission opened. Keep the product chat-first and use tasks as structure around the conversations.',
        createdAt: '2026-03-13T09:00:00.000Z',
      },
      {
        id: 'msg-mission-2',
        conversationId: 'mission-mission-launch',
        authorType: 'user',
        authorId: 'you',
        body: 'Need the MVP to feel like Slack plus Linear-light, not a dashboard.',
        createdAt: '2026-03-13T09:06:00.000Z',
      },
    ],
  };

  const tasks = [
    {
      id: 'task-shell',
      title: 'Shape the workspace shell',
      description: 'Set up channel navigation, chat pane, and context panel.',
      status: 'doing',
      ownerAgentId: 'programmer',
      missionId: 'mission-launch',
      sourceMessageId: 'msg-programmer-1',
      blockerText: '',
      createdAt: '2026-03-13T09:08:00Z',
      updatedAt: now,
    },
    {
      id: 'task-adapter',
      title: 'Wire the agent adapter',
      description: 'Connect agent channels to a provider-backed runner.',
      status: 'todo',
      ownerAgentId: 'krabbe',
      missionId: 'mission-launch',
      sourceMessageId: 'msg-mission-1',
      blockerText: '',
      createdAt: '2026-03-13T09:12:00Z',
      updatedAt: '2026-03-13T09:12:00Z',
    },
  ];

  return {
    agents,
    conversations,
    missions,
    tasks,
    messagesByConversation,
  };
}
