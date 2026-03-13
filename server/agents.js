import OpenAI from 'openai';
import { AGENT_DEFINITIONS } from './constants.js';
import { truncate } from './utils.js';

function buildTranscript(history) {
  return history
    .slice(-12)
    .map((message) => `${message.authorId}: ${message.body}`)
    .join('\n');
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
        'Set OPENAI_API_KEY to upgrade this channel from local simulation to a real model-backed agent.',
      ],
      scout: [
        `Recon note: ${brief}`,
        'Best next research move is to compare 2-3 options, identify the hidden risk, and recommend the fastest safe choice.',
        'The fallback keeps the product usable before the provider key is configured.',
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
  const provider =
    process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()
      ? new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL })
      : new LocalFallbackAdapter();

  async function *streamAgent({ agentId, userPrompt, history, missionContext }) {
    const agent = definitions.get(agentId);
    if (!agent) throw new Error(`Unknown agent: ${agentId}`);
    for await (const event of provider.streamReply({ agent, userPrompt, history, missionContext })) {
      yield event;
    }
  }

  return {
    streamAgent,
  };
}
