import 'dotenv/config';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { zodFunction } from 'openai/helpers/zod';
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';
import { z } from 'zod';
import { runReviewedNodeFile } from './reviewed-execution.js';

const apiKey = process.env.OPENAI_API_KEY;
const baseURL = process.env.OPENAI_API_BASE_URL ?? 'https://api.openai.com/v1';
const model = process.env.OPENAI_MODEL ?? 'gpt-5.4-mini';

if (!apiKey) {
  console.error([
    'Missing OPENAI_API_KEY.',
    'Create .env from .env.example and run again:',
    '',
    '  cp .env.example .env',
    '  bun run dev',
  ].join('\n'));
  process.exit(1);
}

const client = new OpenAI({
  apiKey,
  baseURL,
});

async function conversation() {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: 'Ты помогаешь планировать бытовые задачи. Отвечай кратко, по-русски и учитывай весь предыдущий диалог.',
    },
    {
      role: 'user',
      content: 'Помоги выбрать, что приготовить на ужин. Нужно что-то быстрое после работы.',
    },
    {
      role: 'assistant',
      content: 'Я бы выбрал котлеты с пюрешку',
    },
    {
      role: 'user',
      content: 'Теперь составь короткий список покупок для гарнира.',
    },
  ];

  const response = await client.chat.completions.create({
    model,
    messages,
  });

  console.log(response.choices[0]?.message.content);
}

const agentWorkspace = path.join(process.cwd(), 'agent-workspace');

const fileNameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9._-]+$/, 'Use only a plain file name, not a path.');

function createDemoTool<Schema extends z.ZodType>(options: {
  name: string;
  description: string;
  parameters: Schema;
  execute: (args: z.infer<Schema>) => Promise<unknown>;
}): {
  name: string;
  tool: ReturnType<typeof zodFunction<Schema>>;
  parse: (rawArguments: string) => z.infer<Schema>;
  execute: (args: unknown) => Promise<unknown>;
} {
  return {
    name: options.name,
    tool: zodFunction({
      name: options.name,
      description: options.description,
      parameters: options.parameters,
    }),
    parse(rawArguments: string) {
      return options.parameters.parse(JSON.parse(rawArguments));
    },
    execute: (args: unknown) => options.execute(args as z.infer<Schema>),
  };
}

function resolveWorkspaceFile(fileName: string) {
  return path.join(agentWorkspace, fileName);
}

async function toolUseAgentWithZodSchema() {
  await fs.mkdir(agentWorkspace, { recursive: true });

  const listDirectory = createDemoTool({
    name: 'list_directory',
    description: 'List files in the agent-workspace directory.',
    parameters: z.object({}),
    async execute() {
      const entries = await fs.readdir(agentWorkspace, { withFileTypes: true });

      return {
        directory: agentWorkspace,
        files: entries.map((entry) => ({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
        })),
      };
    },
  });

  const readTextFile = createDemoTool({
    name: 'read_text_file',
    description: 'Read a text file from the agent-workspace directory.',
    parameters: z.object({
      fileName: fileNameSchema,
    }),
    async execute(args) {
      const filePath = resolveWorkspaceFile(args.fileName);
      const content = await fs.readFile(filePath, 'utf8');

      return {
        fileName: args.fileName,
        content,
      };
    },
  });

  const writeTextFile = createDemoTool({
    name: 'write_text_file',
    description: 'Create or fully overwrite a text file in the agent-workspace directory.',
    parameters: z.object({
      fileName: fileNameSchema,
      content: z.string(),
    }),
    async execute(args) {
      const filePath = resolveWorkspaceFile(args.fileName);
      await fs.writeFile(filePath, args.content, 'utf8');

      return {
        fileName: args.fileName,
        bytes: Buffer.byteLength(args.content, 'utf8'),
      };
    },
  });

  const runNodeFile = createDemoTool({
    name: 'run_node_file',
    description: 'Request execution of a .js or .mjs file from agent-workspace. A human must inspect and approve the exact code in an interactive terminal for every call. Refused in unattended runs; approval is not a sandbox.',
    parameters: z.object({
      fileName: fileNameSchema,
    }),
    async execute(args) {
      return runReviewedNodeFile({ workspace: agentWorkspace, fileName: args.fileName });
    },
  });

  const toolRegistry = [listDirectory, readTextFile, writeTextFile, runNodeFile];
  const tools = toolRegistry.map((entry) => entry.tool);

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `Ты coding agent и твоя задача выполнить запрос пользователя используя предоставленные инструменты. Контекст проекта: в package.json используется "type": "module", поэтому .js файлы исполняются как ES modules.`,
    },
    {
      role: 'user',
      content: 'Напиши Hello World функцию на Node.js в файле hello-world.js.',
    },
  ];

  for (let step = 1; step <= 10; step += 1) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: 'auto',
    });

    const assistantMessage = response.choices[0]?.message;

    if (!assistantMessage) {
      throw new Error('Model returned an empty response.');
    }

    messages.push(assistantMessage as ChatCompletionAssistantMessageParam);

    if (!assistantMessage.tool_calls?.length) {
      console.log(assistantMessage.content);
      return;
    }

    for (const toolCall of assistantMessage.tool_calls) {
      if (toolCall.type !== 'function') {
        throw new Error(`Unsupported tool call type: ${toolCall.type}`);
      }

      const tool = toolRegistry.find((entry) => entry.name === toolCall.function.name);

      if (!tool) {
        throw new Error(`Unknown tool call: ${toolCall.function.name}`);
      }

      const args = tool.parse(toolCall.function.arguments);
      const toolResult = await tool.execute(args);

      console.log(`Tool call ${step}:`, {
        name: toolCall.function.name,
        arguments: args,
        output: toolResult,
      });

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }
  }

  throw new Error('Agent reached the maximum number of tool-use steps.');
}

async function main() {
  // await conversation();
  await toolUseAgentWithZodSchema();
}

main().catch((error: unknown) => {
  console.error('\nDemo failed:');
  console.error(error);
  process.exit(1);
});
