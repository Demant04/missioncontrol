import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import OpenAI from 'openai';
import { AGENT_DEFINITIONS } from './constants.js';
import { truncate } from './utils.js';

const execFileAsync = promisify(execFile);

function buildTranscript(history) {
  return history
    .slice(-12)
    .map((message) => `${message.authorId}: ${message.body}`)
    .join('\n');
}

function buildMissionPrompt({ userPrompt, missionContext }) {
  const blocks = [];
  if (missionContext) {
    blocks.push(`Mission context:\n${missionContext}`);
  }
  blocks.push(userPrompt.trim());
  return blocks.join('\n\n');
}

function buildOpenClawSessionId({ conversationId, agentId }) {
  return `missioncontrol-${conversationId}-${agentId}`.replace(/[^a-zA-Z0-9:_-]/g, '-');
}

function stripReplyTag(text) {
  return text.replace(/^\[\[[^\]]+\]\]\s*/u, '').trim();
}

function chunkText(text) {
  const clean = stripReplyTag(text).trim();
  if (!clean) return ['(empty reply)'];
  const paragraphs = clean.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return paragraphs.length ? paragraphs.map((part) => `${part}\n\n`) : [`${clean}\n\n`];
}

function detectOpenClawCli() {
  const result = spawnSync('openclaw', ['--version'], { stdio: 'pipe', encoding: 'utf8' });
  return result.status === 0;
}

function resolveAgentMapping() {
  return {
    krabbe: process.env.MISSIONCONTROL_KRABBE_AGENT || 'main',
    programmer: process.env.MISSIONCONTROL_PROGRAMMER_AGENT || 'hummer',
    scout: process.env.MISSIONCONTROL_SCOUT_AGENT || 'scout',
  };
}

class OpenClawAdapter {
  constructor() {
    this.agentMap = resolveAgentMapping();
    this.timeoutMs = Number(process.env.MISSIONCONTROL_OPENCLAW_TIMEOUT_MS || 600000);
    this.thinking = process.env.MISSIONCONTROL_OPENCLAW_THINKING?.trim();
  }

  async *streamReply({ agent, userPrompt, missionContext, conversationId }) {
    const mappedAgent = this.agentMap[agent.id];
    if (!mappedAgent) {
      throw new Error(`No OpenClaw agent mapping configured for ${agent.id}.`);
    }

    const args = [
      'agent',
      '--agent',
      mappedAgent,
      '--session-id',
      buildOpenClawSessionId({ conversationId, agentId: agent.id }),
      '--message',
      buildMissionPrompt({ userPrompt, missionContext }),
      '--json',
    ];

    if (this.thinking) {
      args.push('--thinking', this.thinking);
    }

    const { stdout } = await execFileAsync('openclaw', args, {
      timeout: this.timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      cwd: process.cwd(),
      env: process.env,
    });

    const payload = JSON.parse(stdout);
    const text = (payload.result?.payloads || [])
      .map((item) => item.text || '')
      .join('\n\n')
      .trim();

    for (const chunk of chunkText(text)) {
      yield { type: 'delta', delta: chunk };
    }
  }
}

class OpenAIAdapter {
  constructor({ apiKey, model }) {
    this.client = new OpenAI({ apiKey });
    this.model = model || process.env.OPENAI_MODEL || 'gpt-5.2';
  }

  async *streamReply({ agent, userPrompt, history, missionContext }) {
    const stream = await this.client.responses.create({
      model: this.model,
      input: [
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text: `${agent.systemPrompt}\n\nKeep replies concise, operational, and grounded in the Missioncontrol workspace.`,
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                `Mission context: ${missionContext || 'General agent channel'}`,
                '',
                'Recent thread:',
                buildTranscript(history) || '(empty)',
                '',
                `Latest user message: ${userPrompt}`,
              ].join('\n'),
            },
          ],
        },
      ],
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'response.output_text.delta' && event.delta) {
        yield { type: 'delta', delta: event.delta };
      }
      if (event.type === 'response.failed') {
        throw new Error(event.response?.error?.message || 'Agent response failed.');
      }
    }
  }
}

class LocalFallbackAdapter {
  async *streamReply({ agent, userPrompt, missionContext }) {
    const brief = truncate(userPrompt, 160);
    const blocks = {
      krabbe: [
        `Current read: ${brief}`,
        'Next move: turn the ask into one decisive step, one supporting step, and one thing we explicitly ignore for now.',
        missionContext ? `Mission lens: ${truncate(missionContext, 120)}` : 'Mission lens: focus on the smallest valuable slice.',
      ],
      programmer: [
        `Implementation take: ${brief}`,
        'I would translate this into one backend flow, one UI flow, and one verification path before expanding scope.',
        'Set Missioncontrol to OpenClaw mode to route this channel into the real agents.',
      ],
      scout: [
        `Recon note: ${brief}`,
        'Best next research move is to compare 2-3 options, identify the hidden risk, and recommend the fastest safe choice.',
        'Create a real scout agent or map this channel to an OpenClaw agent to upgrade from fallback.',
      ],
    };

    for (const line of blocks[agent.id] || [`Working note: ${brief}`]) {
      yield { type: 'delta', delta: `${line}\n\n` };
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
}

export function createAgentService() {
  const definitions = new Map(AGENT_DEFINITIONS.map((agent) => [agent.id, agent]));
  const mode = (process.env.MISSIONCONTROL_AGENT_MODE || 'auto').trim().toLowerCase();
  const hasOpenClawCli = detectOpenClawCli();
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
  const localFallback = new LocalFallbackAdapter();

  const provider =
    mode === 'openclaw'
      ? new OpenClawAdapter()
      : mode === 'openai'
        ? new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL })
        : mode === 'local'
          ? localFallback
          : hasOpenClawCli
            ? new OpenClawAdapter()
            : openaiConfigured
              ? new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL })
              : localFallback;

  async function *streamAgent({ agentId, userPrompt, history, missionContext, conversationId }) {
    const agent = definitions.get(agentId);
    if (!agent) throw new Error(`Unknown agent: ${agentId}`);

    try {
      for await (const event of provider.streamReply({
        agent,
        userPrompt,
        history,
        missionContext,
        conversationId,
      })) {
        yield event;
      }
    } catch (error) {
      const shouldFallback = provider instanceof OpenClawAdapter;
      if (!shouldFallback) throw error;

      for await (const event of localFallback.streamReply({
        agent,
        userPrompt,
        history,
        missionContext,
        conversationId,
      })) {
        yield event;
      }
    }
  }

  return {
    streamAgent,
  };
}

export { buildOpenClawSessionId };
