import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { AGENT_DEFINITIONS, DEFAULT_MISSIONS, SPECIAL_CONVERSATIONS } from './constants.js';
import { nowIso } from './utils.js';

function createSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      accent TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      last_active_at TEXT,
      current_task_summary TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mission_links (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      mission_id TEXT REFERENCES missions(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      author_type TEXT NOT NULL,
      author_id TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      source_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      owner_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      mission_id TEXT REFERENCES missions(id) ON DELETE SET NULL,
      source_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
      blocker_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      started_at TEXT NOT NULL,
      ended_at TEXT
    );
  `);
}

function seedIfEmpty(db) {
  const agentCount = db.prepare('SELECT COUNT(*) AS count FROM agents').get().count;
  if (agentCount > 0) return;

  const insertAgent = db.prepare(`
    INSERT INTO agents (id, name, role, system_prompt, accent, status, last_active_at, current_task_summary)
    VALUES (@id, @name, @role, @systemPrompt, @accent, 'idle', @lastActiveAt, '')
  `);
  const insertConversation = db.prepare(`
    INSERT INTO conversations (id, type, agent_id, mission_id, title, created_at)
    VALUES (@id, @type, @agentId, @missionId, @title, @createdAt)
  `);
  const insertMessage = db.prepare(`
    INSERT INTO messages (id, conversation_id, author_type, author_id, body, created_at, source_message_id)
    VALUES (@id, @conversationId, @authorType, @authorId, @body, @createdAt, NULL)
  `);
  const insertMission = db.prepare(`
    INSERT INTO missions (id, title, summary, notes, archived, created_at, updated_at)
    VALUES (@id, @title, @summary, @notes, @archived, @createdAt, @updatedAt)
  `);
  const insertLink = db.prepare(`
    INSERT INTO mission_links (id, mission_id, label, url)
    VALUES (@id, @missionId, @label, @url)
  `);
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, title, description, status, owner_agent_id, mission_id, source_message_id, blocker_text, created_at, updated_at)
    VALUES (@id, @title, @description, @status, @ownerAgentId, @missionId, NULL, @blockerText, @createdAt, @updatedAt)
  `);

  const seedTime = nowIso();
  const seed = db.transaction(() => {
    for (const agent of AGENT_DEFINITIONS) {
      insertAgent.run({ ...agent, lastActiveAt: seedTime });
      insertConversation.run({
        id: `channel-${agent.id}`,
        type: 'agent',
        agentId: agent.id,
        missionId: null,
        title: agent.name,
        createdAt: seedTime,
      });
    }

    for (const conversation of SPECIAL_CONVERSATIONS) {
      insertConversation.run({
        id: conversation.id,
        type: conversation.type,
        agentId: conversation.agentId,
        missionId: conversation.missionId,
        title: conversation.title,
        createdAt: seedTime,
      });
    }

    for (const mission of DEFAULT_MISSIONS) {
      insertMission.run({
        id: mission.id,
        title: mission.title,
        summary: mission.summary,
        notes: mission.notes,
        archived: mission.archived,
        createdAt: seedTime,
        updatedAt: seedTime,
      });

      insertConversation.run({
        id: `mission-${mission.id}`,
        type: 'mission',
        agentId: null,
        missionId: mission.id,
        title: mission.title,
        createdAt: seedTime,
      });

      for (const link of mission.links) {
        insertLink.run({
          id: link.id,
          missionId: mission.id,
          label: link.label,
          url: link.url,
        });
      }

      for (const task of mission.tasks) {
        insertTask.run({
          ...task,
          missionId: mission.id,
          createdAt: seedTime,
          updatedAt: seedTime,
        });
      }

      for (const message of mission.messages) {
        insertMessage.run({
          ...message,
          conversationId: `mission-${mission.id}`,
        });
      }
    }

    insertMessage.run({
      id: 'msg-krabbe-seed',
      conversationId: 'channel-krabbe',
      authorType: 'agent',
      authorId: 'krabbe',
      body: 'Missioncontrol online. Bring me the thorniest decision and I will turn it into the next move.',
      createdAt: seedTime,
    });

    insertMessage.run({
      id: 'msg-programmer-seed',
      conversationId: 'channel-programmer',
      authorType: 'agent',
      authorId: 'programmer',
      body: 'Ready to design systems, structure tasks, and ship the implementation details.',
      createdAt: seedTime,
    });

    insertMessage.run({
      id: 'msg-scout-seed',
      conversationId: 'channel-scout',
      authorType: 'agent',
      authorId: 'scout',
      body: 'Scout online. I can map the field, compare options, and surface the fastest safe route.',
      createdAt: seedTime,
    });
  });

  seed();
}

export function createDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  createSchema(db);
  seedIfEmpty(db);
  return db;
}
