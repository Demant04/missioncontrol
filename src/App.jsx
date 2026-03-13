import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { defaultClient } from './lib/api.js';
import {
  appendMessage,
  applyEvent,
  getInitialSelection,
  normalizeWorkspace,
  setConversationDetail,
  setMissionDetail,
  upsertMission,
  upsertTask,
} from './lib/state.js';
import { createDemoWorkspace } from './lib/demoData.js';
import './styles.css';

const STATUS_ORDER = ['todo', 'doing', 'review', 'done'];

function formatRelativeTime(value) {
  if (!value) return 'Never';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatTimestamp(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('da-DK', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function slugStatus(value) {
  return String(value || 'idle').toLowerCase();
}

function sortTasks(tasks) {
  return [...tasks].sort((left, right) => {
    const statusDelta = STATUS_ORDER.indexOf(left.status) - STATUS_ORDER.indexOf(right.status);
    if (statusDelta !== 0) return statusDelta;
    return (right.updatedAt || '').localeCompare(left.updatedAt || '');
  });
}

function createTaskDraft(message, selection, workspace) {
  return {
    messageId: message.id,
    title: message.body.split('\n')[0].slice(0, 72) || 'New task',
    description: message.body,
    ownerAgentId: selection?.agentId || '',
    missionId: selection?.missionId || '',
    status: 'todo',
    blockerText: '',
    sourceMessageId: message.sourceMessageId || null,
  };
}

function toTaskPatch(task, status) {
  return {
    title: task.title,
    description: task.description,
    ownerAgentId: task.ownerAgentId,
    missionId: task.missionId,
    blockerText: task.blockerText,
    status,
  };
}

function useWorkspace(client) {
  const initialWorkspace = normalizeWorkspace(createDemoWorkspace());
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [selectedId, setSelectedId] = useState(() => getInitialSelection(initialWorkspace));
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    client
      .loadWorkspace()
      .then((payload) => {
        if (!active) return;
        const nextWorkspace = normalizeWorkspace(payload);
        startTransition(() => {
          setWorkspace(nextWorkspace);
          setSelectedId((current) => current || getInitialSelection(nextWorkspace));
          setLoadingWorkspace(false);
        });
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message);
        setLoadingWorkspace(false);
      });

    const unsubscribe = client.subscribe(
      (event) => {
        startTransition(() => {
          setWorkspace((current) => applyEvent(current, event));
        });
      },
      () => setStreamReady(true),
    );

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [client]);

  const activeSelection = workspace.conversations.find((conversation) => conversation.id === selectedId);

  useEffect(() => {
    if (!activeSelection) return;

    let active = true;
    setLoadingDetail(true);

    const loader =
      activeSelection.type === 'mission' && activeSelection.missionId
        ? client.loadMission(activeSelection.missionId).then((detail) => {
            if (!active) return;
            setWorkspace((current) => setMissionDetail(current, detail));
          })
        : client.loadConversation(activeSelection.id).then((detail) => {
            if (!active) return;
            setWorkspace((current) => setConversationDetail(current, detail));
          });

    loader
      .catch((detailError) => {
        if (!active) return;
        setError(detailError.message);
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });

    return () => {
      active = false;
    };
  }, [client, activeSelection?.id, activeSelection?.missionId, activeSelection?.type]);

  return {
    workspace,
    setWorkspace,
    selectedId,
    setSelectedId,
    loadingWorkspace,
    loadingDetail,
    streamReady,
    error,
  };
}

function Sidebar({ workspace, selectedId, activeView, onSelect, onViewChange, onCreateMission }) {
  return (
    <aside className="sidebar panel">
      <div className="brand-lockup">
        <div className="brand-mark">
          <span />
          <span />
          <span />
        </div>
        <div>
          <p className="eyebrow">Missioncontrol</p>
          <h1>Agent workspace</h1>
        </div>
      </div>

      <div className="sidebar-mode-toggle" role="tablist" aria-label="Main views">
        <button className={activeView === 'chat' ? 'active' : ''} type="button" onClick={() => onViewChange('chat')}>
          Chat
        </button>
        <button className={activeView === 'tasks' ? 'active' : ''} type="button" onClick={() => onViewChange('tasks')}>
          Tasks
        </button>
      </div>

      <section className="sidebar-section">
        <div className="sidebar-heading">
          <span>Channels</span>
          <span className="soft-dot" />
        </div>
        <div className="nav-list">
          {workspace.conversations
            .filter((conversation) => conversation.type === 'agent')
            .map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={`nav-item ${selectedId === conversation.id ? 'selected' : ''}`}
                onClick={() => onSelect(conversation.id)}
              >
                <div>
                  <strong>{conversation.title}</strong>
                  <span>{conversation.agentId ? 'Direct channel' : 'Broadcast to all agents'}</span>
                </div>
              </button>
            ))}
        </div>
      </section>

      <section className="sidebar-section">
        <div className="sidebar-heading">
          <span>Missions</span>
          <button className="ghost-action inline" type="button" onClick={onCreateMission}>
            New
          </button>
        </div>
        <div className="nav-list">
          {workspace.conversations
            .filter((conversation) => conversation.type === 'mission')
            .map((conversation) => {
              const mission = workspace.missions.find((item) => item.id === conversation.missionId);
              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={`nav-item mission ${selectedId === conversation.id ? 'selected' : ''}`}
                  onClick={() => onSelect(conversation.id)}
                >
                  <div>
                    <strong>{conversation.title}</strong>
                    <span>{mission?.summary || 'Mission thread'}</span>
                  </div>
                </button>
              );
            })}
        </div>
      </section>
    </aside>
  );
}

function ChatHeader({ selection, workspace, streamReady }) {
  const agent = workspace.agents.find((item) => item.id === selection?.agentId);
  const mission = workspace.missions.find((item) => item.id === selection?.missionId);

  return (
    <header className="chat-header panel">
      <div>
        <p className="eyebrow">{selection?.type === 'mission' ? 'Mission view' : 'Channel'}</p>
        <h2>{selection?.title || 'Workspace'}</h2>
        <p>
          {mission
            ? mission.summary
            : agent
              ? `${agent.role} | ${agent.currentTaskSummary}`
              : 'Shared channel for all agents and synchronized status.'}
        </p>
      </div>
      <div className="chat-header-status">
        <span className={`presence-pill ${streamReady ? 'live' : ''}`}>{streamReady ? 'SSE live' : 'Connecting stream'}</span>
        {agent ? <span className={`status-pill ${slugStatus(agent.status)}`}>{agent.status}</span> : null}
      </div>
    </header>
  );
}

function MessageBubble({ message, agent, onConvert }) {
  const isUser = message.authorType === 'user';

  return (
    <article className={`message-bubble ${isUser ? 'user' : 'agent'}`}>
      <div className="message-meta">
        <div className="message-author">
          <span className={`avatar ${isUser ? 'user' : slugStatus(agent?.status)}`}>{isUser ? 'You' : agent?.name?.slice(0, 2) || 'AI'}</span>
          <div>
            <strong>{isUser ? 'You' : agent?.name || 'Agent'}</strong>
            <span>{formatTimestamp(message.createdAt)}</span>
          </div>
        </div>
        <button className="ghost-action" type="button" onClick={() => onConvert(message)}>
          To task
        </button>
      </div>
      <p>{message.body || '...'}</p>
    </article>
  );
}

function ChatPane({ selection, workspace, messages, composerText, setComposerText, onSend, onConvert, sending }) {
  return (
    <section className="chat-pane">
      <div className="message-list panel">
        {messages.length ? (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              agent={workspace.agents.find((agent) => agent.id === message.authorId)}
              onConvert={onConvert}
            />
          ))
        ) : (
          <div className="empty-state">
            <p className="eyebrow">Thread is empty</p>
            <h3>Start the conversation</h3>
            <p>Messages become tasks, agent work updates, and mission context. This is the primary surface.</p>
          </div>
        )}
      </div>

      <form className="composer panel" onSubmit={onSend}>
        <label htmlFor="composer-text" className="sr-only">
          Message
        </label>
        <textarea
          id="composer-text"
          rows={4}
          value={composerText}
          onChange={(event) => setComposerText(event.target.value)}
          placeholder={
            selection?.type === 'mission'
              ? 'Write into the mission thread and keep work scoped to this mission...'
              : 'Talk to the agents. Ask, delegate, clarify, or broadcast...'
          }
        />
        <div className="composer-footer">
          <span>{selection?.type === 'mission' ? 'Mission-linked thread' : 'Agent-linked thread'}</span>
          <button className="primary-action" type="submit" disabled={sending || !composerText.trim()}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  );
}

function TaskBoard({ tasks, agents, missions, onAdvance }) {
  return (
    <section className="task-board">
      {STATUS_ORDER.map((status) => (
        <article className="task-column panel" key={status}>
          <header>
            <div>
              <p className="eyebrow">Status</p>
              <h3>{status}</h3>
            </div>
            <span>{tasks.filter((task) => task.status === status).length}</span>
          </header>

          <div className="task-card-list">
            {tasks
              .filter((task) => task.status === status)
              .map((task) => {
                const owner = agents.find((agent) => agent.id === task.ownerAgentId);
                const mission = missions.find((missionItem) => missionItem.id === task.missionId);
                const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(task.status) + 1];
                return (
                  <div className="task-card" key={task.id}>
                    <div className="task-card-top">
                      <strong>{task.title}</strong>
                      <span>{owner?.name || 'Unassigned'}</span>
                    </div>
                    <p>{task.description || 'No description yet.'}</p>
                    <div className="task-card-meta">
                      <span>{mission?.title || 'General work'}</span>
                      <span>{formatRelativeTime(task.updatedAt)}</span>
                    </div>
                    {task.blockerText ? <div className="blocker-pill">Blocked: {task.blockerText}</div> : null}
                    {nextStatus ? (
                      <button className="secondary-action" type="button" onClick={() => onAdvance(task, nextStatus)}>
                        Move to {nextStatus}
                      </button>
                    ) : null}
                  </div>
                );
              })}
          </div>
        </article>
      ))}
    </section>
  );
}

function TaskFilters({ filters, setFilters, agents, missions }) {
  return (
    <div className="task-filters panel">
      <label>
        <span>Status</span>
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          <option value="">All statuses</option>
          {STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Owner</span>
        <select
          value={filters.ownerAgentId}
          onChange={(event) => setFilters((current) => ({ ...current, ownerAgentId: event.target.value }))}
        >
          <option value="">All agents</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Mission</span>
        <select value={filters.missionId} onChange={(event) => setFilters((current) => ({ ...current, missionId: event.target.value }))}>
          <option value="">All missions</option>
          {missions.map((mission) => (
            <option key={mission.id} value={mission.id}>
              {mission.title}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function AgentRail({ selection, workspace, scopedTasks }) {
  const activeAgent = workspace.agents.find((item) => item.id === selection?.agentId);
  const agents = activeAgent ? [activeAgent] : workspace.agents;

  return (
    <aside className="context-rail">
      <section className="context-card panel">
        <div className="context-card-header">
          <div>
            <p className="eyebrow">Agent status</p>
            <h3>{activeAgent?.name || 'All agents'}</h3>
          </div>
        </div>

        <div className="agent-grid">
          {agents.map((agent) => (
            <div className="agent-card" key={agent.id}>
              <div>
                <strong>{agent.name}</strong>
                <span>{agent.role}</span>
              </div>
              <em className={`status-pill ${slugStatus(agent.status)}`}>{agent.status}</em>
              <p>{agent.currentTaskSummary}</p>
              <small>Last active {formatRelativeTime(agent.lastActiveAt)}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="context-card panel">
        <div className="context-card-header">
          <div>
            <p className="eyebrow">Task context</p>
            <h3>{scopedTasks.length} tasks in scope</h3>
          </div>
        </div>
        <div className="mini-task-list">
          {scopedTasks.length ? (
            scopedTasks.map((task) => (
              <div className="mini-task" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.status}</span>
                </div>
                <em>{workspace.missions.find((mission) => mission.id === task.missionId)?.title || 'General'}</em>
              </div>
            ))
          ) : (
            <p className="muted-copy">No tasks linked yet.</p>
          )}
        </div>
      </section>
    </aside>
  );
}

function MissionRail({ mission, scopedTasks, agents, missionDraft, setMissionDraft, newLink, setNewLink, onSaveMission, onAddLink }) {
  return (
    <aside className="context-rail">
      <section className="context-card panel">
        <div className="context-card-header">
          <div>
            <p className="eyebrow">Mission</p>
            <h3>{mission.title}</h3>
          </div>
        </div>

        <div className="form-stack">
          <label>
            <span>Title</span>
            <input value={missionDraft.title} onChange={(event) => setMissionDraft({ ...missionDraft, title: event.target.value })} />
          </label>
          <label>
            <span>Summary</span>
            <textarea rows={3} value={missionDraft.summary} onChange={(event) => setMissionDraft({ ...missionDraft, summary: event.target.value })} />
          </label>
          <label>
            <span>Notes</span>
            <textarea rows={6} value={missionDraft.notes} onChange={(event) => setMissionDraft({ ...missionDraft, notes: event.target.value })} />
          </label>
        </div>

        <div className="modal-actions">
          <button className="primary-action" type="button" onClick={onSaveMission}>
            Save mission
          </button>
        </div>
      </section>

      <section className="context-card panel">
        <div className="context-card-header">
          <div>
            <p className="eyebrow">Links and tasks</p>
            <h3>{mission.links?.length || 0} links</h3>
          </div>
        </div>

        <div className="link-list">
          {mission.links?.map((link) => (
            <a key={link.id} href={link.url} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </div>

        <div className="form-grid">
          <label>
            <span>Label</span>
            <input value={newLink.label} onChange={(event) => setNewLink({ ...newLink, label: event.target.value })} />
          </label>
          <label>
            <span>URL</span>
            <input value={newLink.url} onChange={(event) => setNewLink({ ...newLink, url: event.target.value })} />
          </label>
        </div>

        <button className="secondary-action" type="button" onClick={onAddLink} disabled={!newLink.label.trim() || !newLink.url.trim()}>
          Add link
        </button>

        <div className="mini-task-list">
          {scopedTasks.map((task) => (
            <div className="mini-task" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <span>{agents.find((agent) => agent.id === task.ownerAgentId)?.name || 'Unassigned'}</span>
              </div>
              <em>{task.status}</em>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function TaskModal({ draft, missions, agents, onChange, onClose, onSubmit }) {
  if (!draft) return null;

  return (
    <div className="modal-shell" role="presentation">
      <div className="modal-card panel" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <div className="context-card-header">
          <div>
            <p className="eyebrow">Convert message</p>
            <h3 id="task-modal-title">Create task from chat</h3>
          </div>
          <button className="ghost-action" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <label>
          <span>Title</span>
          <input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} />
        </label>
        <label>
          <span>Description</span>
          <textarea rows={5} value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} />
        </label>

        <div className="form-grid">
          <label>
            <span>Owner</span>
            <select value={draft.ownerAgentId} onChange={(event) => onChange({ ...draft, ownerAgentId: event.target.value })}>
              <option value="">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Mission</span>
            <select value={draft.missionId} onChange={(event) => onChange({ ...draft, missionId: event.target.value })}>
              <option value="">General work</option>
              {missions.map((mission) => (
                <option key={mission.id} value={mission.id}>
                  {mission.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <span>Status</span>
          <select value={draft.status} onChange={(event) => onChange({ ...draft, status: event.target.value })}>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Blocker / waiting note</span>
          <input value={draft.blockerText} onChange={(event) => onChange({ ...draft, blockerText: event.target.value })} />
        </label>

        <div className="modal-actions">
          <button className="secondary-action" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-action" type="button" onClick={onSubmit} disabled={!draft.title.trim()}>
            Create task
          </button>
        </div>
      </div>
    </div>
  );
}

function MissionModal({ draft, onChange, onClose, onSubmit }) {
  if (!draft) return null;

  return (
    <div className="modal-shell" role="presentation">
      <div className="modal-card panel" role="dialog" aria-modal="true" aria-labelledby="mission-modal-title">
        <div className="context-card-header">
          <div>
            <p className="eyebrow">New mission</p>
            <h3 id="mission-modal-title">Create mission</h3>
          </div>
          <button className="ghost-action" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <label>
          <span>Title</span>
          <input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} />
        </label>
        <label>
          <span>Summary</span>
          <textarea rows={3} value={draft.summary} onChange={(event) => onChange({ ...draft, summary: event.target.value })} />
        </label>
        <label>
          <span>Notes</span>
          <textarea rows={5} value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} />
        </label>

        <div className="modal-actions">
          <button className="secondary-action" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-action" type="button" onClick={onSubmit} disabled={!draft.title.trim() || !draft.summary.trim()}>
            Create mission
          </button>
        </div>
      </div>
    </div>
  );
}

export function MissionControlApp({ client = defaultClient }) {
  const { workspace, setWorkspace, selectedId, setSelectedId, loadingWorkspace, loadingDetail, streamReady, error } = useWorkspace(client);
  const [activeView, setActiveView] = useState('chat');
  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);
  const [taskDraft, setTaskDraft] = useState(null);
  const [missionDraft, setMissionDraft] = useState(null);
  const [missionEditor, setMissionEditor] = useState({ title: '', summary: '', notes: '' });
  const [newLink, setNewLink] = useState({ label: '', url: '' });
  const [taskFilters, setTaskFilters] = useState({ status: '', ownerAgentId: '', missionId: '' });

  const selection = workspace.conversations.find((conversation) => conversation.id === selectedId) || workspace.conversations[0];
  const currentMission = workspace.missions.find((mission) => mission.id === selection?.missionId) || null;
  const messages = workspace.messagesByConversation[selectedId] || [];
  const deferredFilters = useDeferredValue(taskFilters);
  const visibleTasks = useMemo(
    () =>
      sortTasks(workspace.tasks).filter((task) => {
        if (deferredFilters.status && task.status !== deferredFilters.status) return false;
        if (deferredFilters.ownerAgentId && task.ownerAgentId !== deferredFilters.ownerAgentId) return false;
        if (deferredFilters.missionId && task.missionId !== deferredFilters.missionId) return false;
        return true;
      }),
    [deferredFilters, workspace.tasks],
  );
  const scopedTasks = visibleTasks.filter((task) =>
    selection?.type === 'mission' ? task.missionId === selection.missionId : selection?.agentId ? task.ownerAgentId === selection.agentId : true,
  );

  useEffect(() => {
    if (currentMission) {
      setMissionEditor({
        title: currentMission.title || '',
        summary: currentMission.summary || '',
        notes: currentMission.notes || '',
      });
      setNewLink({ label: '', url: '' });
    }
  }, [currentMission]);

  async function handleSendMessage(event) {
    event.preventDefault();
    if (!selection || !composerText.trim()) return;
    setSending(true);

    try {
      const response = await client.sendMessage(selection.id, composerText.trim());
      if (response?.message) {
        setWorkspace((current) => appendMessage(current, response.message));
      }
      setComposerText('');
    } finally {
      setSending(false);
    }
  }

  async function handleConvertToTask() {
    if (!taskDraft) return;
    const response = await client.convertMessageToTask(taskDraft.messageId, {
      title: taskDraft.title,
      description: taskDraft.description,
      ownerAgentId: taskDraft.ownerAgentId || null,
      missionId: taskDraft.missionId || null,
      status: taskDraft.status,
      blockerText: taskDraft.blockerText,
    });
    setWorkspace((current) => upsertTask(current, response));
    setTaskDraft(null);
    setActiveView('tasks');
  }

  async function handleAdvanceTask(task, status) {
    const response = await client.updateTask(task.id, toTaskPatch(task, status));
    setWorkspace((current) => upsertTask(current, response));
  }

  async function handleCreateMission() {
    if (!missionDraft) return;
    const response = await client.createMission(missionDraft);
    setWorkspace((current) => setMissionDetail(upsertMission(current, response), response));
    setMissionDraft(null);
    setSelectedId(response.conversationId);
  }

  async function handleSaveMission() {
    if (!currentMission) return;
    const response = await client.updateMission(currentMission.id, missionEditor);
    setWorkspace((current) => setMissionDetail(current, response));
  }

  async function handleAddMissionLink() {
    if (!currentMission || !newLink.label.trim() || !newLink.url.trim()) return;
    const response = await client.addMissionLink(currentMission.id, newLink);
    setWorkspace((current) => setMissionDetail(current, response));
    setNewLink({ label: '', url: '' });
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <Sidebar
        workspace={workspace}
        selectedId={selectedId}
        activeView={activeView}
        onSelect={(id) => {
          startTransition(() => {
            setSelectedId(id);
            setActiveView('chat');
          });
        }}
        onViewChange={setActiveView}
        onCreateMission={() => setMissionDraft({ title: '', summary: '', notes: '' })}
      />

      <main className="workspace">
        <ChatHeader selection={selection} workspace={workspace} streamReady={streamReady} />

        <div className="workspace-content">
          <div className="main-surface">
            {activeView === 'chat' ? (
              <ChatPane
                selection={selection}
                workspace={workspace}
                messages={messages}
                composerText={composerText}
                setComposerText={setComposerText}
                onSend={handleSendMessage}
                onConvert={(message) => setTaskDraft(createTaskDraft(message, selection, workspace))}
                sending={sending}
              />
            ) : (
              <>
                <TaskFilters filters={taskFilters} setFilters={setTaskFilters} agents={workspace.agents} missions={workspace.missions} />
                <TaskBoard tasks={visibleTasks} agents={workspace.agents} missions={workspace.missions} onAdvance={handleAdvanceTask} />
              </>
            )}
          </div>

          {selection?.type === 'mission' && currentMission ? (
            <MissionRail
              mission={currentMission}
              scopedTasks={scopedTasks}
              agents={workspace.agents}
              missionDraft={missionEditor}
              setMissionDraft={setMissionEditor}
              newLink={newLink}
              setNewLink={setNewLink}
              onSaveMission={handleSaveMission}
              onAddLink={handleAddMissionLink}
            />
          ) : (
            <AgentRail selection={selection} workspace={workspace} scopedTasks={scopedTasks} />
          )}
        </div>

        <footer className="workspace-footer">
          <span>{loadingWorkspace ? 'Loading workspace...' : loadingDetail ? 'Refreshing thread...' : 'Workspace ready'}</span>
          <span>{error || 'Chat-first control room with live streaming updates.'}</span>
        </footer>
      </main>

      <TaskModal
        draft={taskDraft}
        missions={workspace.missions}
        agents={workspace.agents}
        onChange={setTaskDraft}
        onClose={() => setTaskDraft(null)}
        onSubmit={handleConvertToTask}
      />

      <MissionModal draft={missionDraft} onChange={setMissionDraft} onClose={() => setMissionDraft(null)} onSubmit={handleCreateMission} />
    </div>
  );
}

export default MissionControlApp;
