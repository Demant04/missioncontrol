export const TASK_STATUSES = ['todo', 'doing', 'review', 'done'];
export const RUN_STATUSES = ['working', 'blocked', 'waiting', 'done', 'idle'];

export const AGENT_DEFINITIONS = [
  {
    id: 'krabbe',
    name: 'Krabbe',
    role: 'Orchestrator',
    systemPrompt:
      'You are Krabbe, the operational lead. Help prioritize, decide next actions, unblock work, and keep Missioncontrol brutally clear and outcome-focused.',
    accent: '#f767b4',
  },
  {
    id: 'programmer',
    name: 'Programmør',
    role: 'Technical Builder',
    systemPrompt:
      'You are Programmør, the technical build brain. Respond with implementation thinking, concise tradeoffs, code or system plans, and delivery-oriented next steps.',
    accent: '#53b5ff',
  },
  {
    id: 'scout',
    name: 'Scout',
    role: 'Research and Recon',
    systemPrompt:
      'You are Scout, a focused researcher. Surface options, risks, facts to verify, and concise recommendations that help the team move faster.',
    accent: '#66d2a3',
  },
];

export const SPECIAL_CONVERSATIONS = [
  {
    id: 'channel-all',
    type: 'agent',
    title: 'Alle',
    agentId: null,
    missionId: null,
  },
];

export const DEFAULT_MISSIONS = [
  {
    id: 'mission-launch',
    title: 'Missioncontrol MVP',
    summary: 'Ship the chat-first internal workspace and make it reachable across devices.',
    notes:
      'The first version should feel like Slack plus a light task board. Keep it single-user, private, and reliable.',
    archived: 0,
    links: [
      { id: 'link-tailscale', label: 'Tailscale docs', url: 'https://tailscale.com/docs/' },
      { id: 'link-slack-ai', label: 'Slack AI agents', url: 'https://slack.com/ai-agents' },
    ],
    tasks: [
      {
        id: 'task-shell',
        title: 'Shape the workspace shell',
        description: 'Set up channel navigation, chat pane, and context panel.',
        status: 'doing',
        ownerAgentId: 'programmer',
        blockerText: '',
      },
      {
        id: 'task-adapter',
        title: 'Wire the agent adapter',
        description: 'Connect agent channels to a provider-backed runner.',
        status: 'todo',
        ownerAgentId: 'krabbe',
        blockerText: '',
      },
    ],
    messages: [
      {
        id: 'msg-mission-1',
        authorType: 'agent',
        authorId: 'krabbe',
        body: 'Mission opened. Keep the product chat-first and use tasks only as structure around the conversations.',
        createdAt: '2026-03-13T09:00:00.000Z',
      },
      {
        id: 'msg-mission-2',
        authorType: 'user',
        authorId: 'you',
        body: 'Need the MVP to feel like Slack plus Linear-light, not a dashboard.',
        createdAt: '2026-03-13T09:06:00.000Z',
      },
    ],
  },
];
