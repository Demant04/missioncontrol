import path from 'node:path';
import crypto from 'node:crypto';
import { createDatabase } from './db.js';
import { RUN_STATUSES, TASK_STATUSES } from './constants.js';
import { isValidUrl, messageToTaskTitle, nowIso, truncate } from './utils.js';

function mapAgent(row) {
  return row
    ? {
        id: row.id,
        name: row.name,
        role: row.role,
        accent: row.accent,
        status: row.status,
        lastActiveAt: row.last_active_at,
        currentTaskSummary: row.current_task_summary,
      }
    : null;
}

function mapConversation(row) {
  return row
    ? {
        id: row.id,
        type: row.type,
        agentId: row.agent_id,
        missionId: row.mission_id,
        title: row.title,
        createdAt: row.created_at,
        unreadCount: 0,
      }
    : null;
}

function mapMessage(row) {
  return row
    ? {
        id: row.id,
        conversationId: row.conversation_id,
        authorType: row.author_type,
        authorId: row.author_id,
        body: row.body,
        createdAt: row.created_at,
        sourceMessageId: row.source_message_id,
      }
    : null;
}

function mapTask(row) {
  return row
    ? {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        ownerAgentId: row.owner_agent_id,
        missionId: row.mission_id,
        sourceMessageId: row.source_message_id,
        blockerText: row.blocker_text,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;
}

function mapMission(row) {
  return row
    ? {
        id: row.id,
        title: row.title,
        summary: row.summary,
        notes: row.notes,
        archived: Boolean(row.archived),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;
}

export function createStore(options = {}) {
  const dbPath = options.dbPath || path.join(process.cwd(), 'data', 'missioncontrol.sqlite');
  const db = options.db || createDatabase(dbPath);

  const statements = {
    getAgents: db.prepare('SELECT * FROM agents ORDER BY name'),
    getAgent: db.prepare('SELECT * FROM agents WHERE id = ?'),
    getConversations: db.prepare('SELECT * FROM conversations ORDER BY CASE type WHEN \'agent\' THEN 0 ELSE 1 END, title'),
    getConversation: db.prepare('SELECT * FROM conversations WHERE id = ?'),
    getMessagesByConversation: db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at'),
    getMessage: db.prepare('SELECT * FROM messages WHERE id = ?'),
    getMission: db.prepare('SELECT * FROM missions WHERE id = ?'),
    getMissionLinks: db.prepare('SELECT * FROM mission_links WHERE mission_id = ? ORDER BY label'),
    getAllMissions: db.prepare('SELECT * FROM missions ORDER BY archived ASC, updated_at DESC, title'),
    getTask: db.prepare('SELECT * FROM tasks WHERE id = ?'),
    getTasks: db.prepare(
      'SELECT * FROM tasks ORDER BY CASE status WHEN \'doing\' THEN 0 WHEN \'review\' THEN 1 WHEN \'todo\' THEN 2 ELSE 3 END, updated_at DESC',
    ),
    getTasksForMission: db.prepare('SELECT * FROM tasks WHERE mission_id = ? ORDER BY updated_at DESC'),
    getConversationByMission: db.prepare('SELECT * FROM conversations WHERE mission_id = ?'),
    insertMission: db.prepare(`
      INSERT INTO missions (id, title, summary, notes, archived, created_at, updated_at)
      VALUES (@id, @title, @summary, @notes, @archived, @createdAt, @updatedAt)
    `),
    updateMission: db.prepare(`
      UPDATE missions
      SET title = @title, summary = @summary, notes = @notes, archived = @archived, updated_at = @updatedAt
      WHERE id = @id
    `),
    insertConversation: db.prepare(`
      INSERT INTO conversations (id, type, agent_id, mission_id, title, created_at)
      VALUES (@id, @type, @agentId, @missionId, @title, @createdAt)
    `),
    insertMessage: db.prepare(`
      INSERT INTO messages (id, conversation_id, author_type, author_id, body, created_at, source_message_id)
      VALUES (@id, @conversationId, @authorType, @authorId, @body, @createdAt, @sourceMessageId)
    `),
    updateMessageBody: db.prepare('UPDATE messages SET body = @body WHERE id = @id'),
    insertTask: db.prepare(`
      INSERT INTO tasks (id, title, description, status, owner_agent_id, mission_id, source_message_id, blocker_text, created_at, updated_at)
      VALUES (@id, @title, @description, @status, @ownerAgentId, @missionId, @sourceMessageId, @blockerText, @createdAt, @updatedAt)
    `),
    updateTask: db.prepare(`
      UPDATE tasks
      SET title = @title,
          description = @description,
          status = @status,
          owner_agent_id = @ownerAgentId,
          mission_id = @missionId,
          blocker_text = @blockerText,
          updated_at = @updatedAt
      WHERE id = @id
    `),
    insertMissionLink: db.prepare(`
      INSERT INTO mission_links (id, mission_id, label, url)
      VALUES (@id, @missionId, @label, @url)
    `),
    insertRun: db.prepare(`
      INSERT INTO agent_runs (id, agent_id, conversation_id, user_message_id, status, summary, started_at, ended_at)
      VALUES (@id, @agentId, @conversationId, @userMessageId, @status, @summary, @startedAt, NULL)
    `),
    getRun: db.prepare('SELECT * FROM agent_runs WHERE id = ?'),
    updateRun: db.prepare(`
      UPDATE agent_runs
      SET status = @status, summary = @summary, ended_at = @endedAt
      WHERE id = @id
    `),
    updateAgentStatus: db.prepare(`
      UPDATE agents
      SET status = @status,
          last_active_at = @lastActiveAt,
          current_task_summary = @currentTaskSummary
      WHERE id = @id
    `),
  };

  function listAgents() {
    return statements.getAgents.all().map(mapAgent);
  }

  function listConversations() {
    return statements.getConversations.all().map(mapConversation);
  }

  function listMissions() {
    return statements.getAllMissions.all().map((missionRow) => ({
      ...mapMission(missionRow),
      conversationId: statements.getConversationByMission.get(missionRow.id)?.id ?? null,
      links: statements.getMissionLinks.all(missionRow.id).map((row) => ({
        id: row.id,
        missionId: row.mission_id,
        label: row.label,
        url: row.url,
      })),
    }));
  }

  function listTasks(filters = {}) {
    let tasks = statements.getTasks.all().map(mapTask);
    if (filters.status) tasks = tasks.filter((task) => task.status === filters.status);
    if (filters.ownerAgentId) tasks = tasks.filter((task) => task.ownerAgentId === filters.ownerAgentId);
    if (filters.missionId) tasks = tasks.filter((task) => task.missionId === filters.missionId);
    return tasks;
  }

  function getWorkspace() {
    const conversations = listConversations();
    const messagesByConversation = Object.fromEntries(
      conversations.map((conversation) => [
        conversation.id,
        statements.getMessagesByConversation.all(conversation.id).map(mapMessage),
      ]),
    );

    return {
      agents: listAgents(),
      conversations,
      missions: listMissions(),
      tasks: listTasks(),
      messagesByConversation,
    };
  }

  function getConversation(conversationId) {
    const conversation = statements.getConversation.get(conversationId);
    if (!conversation) return null;
    return {
      ...mapConversation(conversation),
      messages: statements.getMessagesByConversation.all(conversationId).map(mapMessage),
    };
  }

  function getMissionDetail(missionId) {
    const mission = statements.getMission.get(missionId);
    if (!mission) return null;
    const conversation = statements.getConversationByMission.get(missionId);
    return {
      ...mapMission(mission),
      conversationId: conversation?.id ?? null,
      links: statements.getMissionLinks.all(missionId).map((row) => ({
        id: row.id,
        missionId: row.mission_id,
        label: row.label,
        url: row.url,
      })),
      tasks: statements.getTasksForMission.all(missionId).map(mapTask),
      messages: conversation ? statements.getMessagesByConversation.all(conversation.id).map(mapMessage) : [],
    };
  }

  function createMission(input) {
    const createdAt = nowIso();
    const mission = {
      id: input.id || crypto.randomUUID(),
      title: input.title?.trim() || 'Untitled mission',
      summary: input.summary?.trim() || '',
      notes: input.notes?.trim() || '',
      archived: input.archived ? 1 : 0,
      createdAt,
      updatedAt: createdAt,
    };

    const conversation = {
      id: `mission-${mission.id}`,
      type: 'mission',
      agentId: null,
      missionId: mission.id,
      title: mission.title,
      createdAt,
    };

    db.transaction(() => {
      statements.insertMission.run(mission);
      statements.insertConversation.run(conversation);
    })();

    return getMissionDetail(mission.id);
  }

  function updateMission(missionId, input) {
    const current = statements.getMission.get(missionId);
    if (!current) return null;

    const payload = {
      id: missionId,
      title: input.title?.trim() || current.title,
      summary: input.summary?.trim() ?? current.summary,
      notes: input.notes?.trim() ?? current.notes,
      archived: typeof input.archived === 'boolean' ? Number(input.archived) : current.archived,
      updatedAt: nowIso(),
    };

    db.transaction(() => {
      statements.updateMission.run(payload);
      if (payload.title !== current.title) {
        db.prepare('UPDATE conversations SET title = ? WHERE mission_id = ?').run(payload.title, missionId);
      }
    })();

    return getMissionDetail(missionId);
  }

  function addMissionLink(missionId, input) {
    if (!statements.getMission.get(missionId)) return null;
    if (!input.label?.trim() || !isValidUrl(input.url)) return null;

    statements.insertMissionLink.run({
      id: crypto.randomUUID(),
      missionId,
      label: input.label.trim(),
      url: input.url.trim(),
    });

    return getMissionDetail(missionId);
  }

  function createMessage(input) {
    if (!statements.getConversation.get(input.conversationId)) return null;
    const message = {
      id: input.id || crypto.randomUUID(),
      conversationId: input.conversationId,
      authorType: input.authorType,
      authorId: input.authorId,
      body: input.body ?? '',
      createdAt: input.createdAt || nowIso(),
      sourceMessageId: input.sourceMessageId || null,
    };
    statements.insertMessage.run(message);
    return mapMessage(statements.getMessage.get(message.id));
  }

  function appendMessageText(messageId, delta) {
    const message = statements.getMessage.get(messageId);
    if (!message) return null;
    const body = `${message.body}${delta}`;
    statements.updateMessageBody.run({ id: messageId, body });
    return mapMessage({ ...message, body });
  }

  function createTask(input) {
    const status = input.status || 'todo';
    if (!TASK_STATUSES.includes(status)) return null;
    const timestamp = nowIso();
    const task = {
      id: input.id || crypto.randomUUID(),
      title: input.title?.trim() || 'Untitled task',
      description: input.description?.trim() || '',
      status,
      ownerAgentId: input.ownerAgentId || null,
      missionId: input.missionId || null,
      sourceMessageId: input.sourceMessageId || null,
      blockerText: input.blockerText?.trim() || '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    statements.insertTask.run(task);
    return mapTask(statements.getTask.get(task.id));
  }

  function updateTask(taskId, input) {
    const current = statements.getTask.get(taskId);
    if (!current) return null;
    const nextStatus = input.status || current.status;
    if (!TASK_STATUSES.includes(nextStatus)) return null;

    const payload = {
      id: taskId,
      title: input.title?.trim() || current.title,
      description: input.description?.trim() ?? current.description,
      status: nextStatus,
      ownerAgentId: input.ownerAgentId === undefined ? current.owner_agent_id : input.ownerAgentId,
      missionId: input.missionId === undefined ? current.mission_id : input.missionId,
      blockerText: input.blockerText?.trim() ?? current.blocker_text,
      updatedAt: nowIso(),
    };

    statements.updateTask.run(payload);
    return mapTask(statements.getTask.get(taskId));
  }

  function createTaskFromMessage(messageId, input = {}) {
    const message = statements.getMessage.get(messageId);
    if (!message) return null;
    const conversation = statements.getConversation.get(message.conversation_id);
    const missionId = input.missionId ?? conversation?.mission_id ?? null;
    const ownerAgentId =
      input.ownerAgentId !== undefined
        ? input.ownerAgentId
        : message.author_type === 'agent' && statements.getAgent.get(message.author_id)
          ? message.author_id
          : null;

    return createTask({
      title: input.title || messageToTaskTitle(message.body),
      description: input.description || message.body,
      status: input.status || 'todo',
      ownerAgentId,
      missionId,
      sourceMessageId: message.id,
      blockerText: input.blockerText || '',
    });
  }

  function startAgentRun({ agentId, conversationId, userMessageId, summary }) {
    const startedAt = nowIso();
    const run = {
      id: crypto.randomUUID(),
      agentId,
      conversationId,
      userMessageId: userMessageId || null,
      status: 'working',
      summary: truncate(summary, 140),
      startedAt,
    };
    statements.insertRun.run(run);
    statements.updateAgentStatus.run({
      id: agentId,
      status: 'working',
      lastActiveAt: startedAt,
      currentTaskSummary: run.summary,
    });
    return { ...run, endedAt: null };
  }

  function finishAgentRun(runId, status, summary = '') {
    if (!RUN_STATUSES.includes(status)) return null;
    const run = statements.getRun.get(runId);
    if (!run) return null;
    const endedAt = nowIso();
    statements.updateRun.run({ id: runId, status, summary, endedAt });
    statements.updateAgentStatus.run({
      id: run.agent_id,
      status,
      lastActiveAt: endedAt,
      currentTaskSummary: truncate(summary, 140),
    });
    return {
      id: run.id,
      agentId: run.agent_id,
      conversationId: run.conversation_id,
      userMessageId: run.user_message_id,
      status,
      summary,
      startedAt: run.started_at,
      endedAt,
    };
  }

  return {
    db,
    getWorkspace,
    listAgents,
    listTasks,
    getConversation,
    getMissionDetail,
    createMission,
    updateMission,
    addMissionLink,
    createMessage,
    appendMessageText,
    createTask,
    updateTask,
    createTaskFromMessage,
    startAgentRun,
    finishAgentRun,
    getAgent: (agentId) => mapAgent(statements.getAgent.get(agentId)),
  };
}
