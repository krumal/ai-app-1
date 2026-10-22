import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MAX_SOURCE_BYTES = 65536;

type Review = Readonly<{ fileName: string; code: string; sha256: string }>;
type ExecutionResult = { ok: boolean; stdout?: string; stderr?: string; error?: string };

async function confirmInTerminal(review: Review): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stderr.isTTY) return false;
  process.stderr.write('\nЗапрошен запуск кода, созданного моделью. Это НЕ песочница: код получит доступ к файлам и сети от вашего имени.\n');
  process.stderr.write(`Файл: ${review.fileName}. Ниже строки кода в JSON-кавычках; управляющие символы экранированы.\n`);
  for (const [index, line] of review.code.split('\n').entries()) {
    const visible = JSON.stringify(line).replace(/[\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu,
      character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
    process.stderr.write(`${index + 1}: ${visible}\n`);
  }
  const confirmation = `RUN ${review.sha256.slice(0, 12)}`;
  const terminal = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return (await terminal.question(`Запускайте только понятный вам код. Введите ${confirmation} или нажмите Enter для отказа: `)).trim() === confirmation;
  } finally { terminal.close(); }
}

/** Human review, not an isolation boundary. The model cannot approve its own call. */
export async function runReviewedNodeFile({
  workspace,
  fileName,
  confirm = confirmInTerminal,
}: {
  workspace: string;
  fileName: string;
  confirm?: (review: Review) => Promise<boolean>;
}): Promise<ExecutionResult> {
  try {
    if (!/^[a-zA-Z0-9._-]+\.(?:js|mjs)$/u.test(fileName)) {
      throw new Error('Use a plain .js or .mjs file name, not a path.');
    }
    const root = path.resolve(workspace);
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || await realpath(root) !== root) {
      throw new Error('The workspace must be an ordinary directory, not a link.');
    }
    const file = await open(path.join(root, fileName), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    let code: string;
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > MAX_SOURCE_BYTES) throw new Error('The reviewed script must be a regular file of at most 64 KiB.');
      const buffer = Buffer.alloc(MAX_SOURCE_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await file.read(buffer, length, buffer.length - length, length);
        if (bytesRead === 0) break;
        length += bytesRead;
      }
      if (length > MAX_SOURCE_BYTES) throw new Error('The reviewed script exceeds 64 KiB.');
      code = buffer.subarray(0, length).toString('utf8');
    } finally { await file.close(); }
    const review = Object.freeze({ fileName, code, sha256: createHash('sha256').update(code).digest('hex') });
    if (!await confirm(review)) {
      return { ok: false, error: 'Interactive human approval is required for every execution. No code was run.' };
    }
    // Send the exact reviewed snapshot to stdin; never reopen a mutable file
    // after approval, and do not pass API credentials or the parent environment.
    const pending = execFileAsync(process.execPath, ['--input-type=module', '-'], {
      cwd: root, env: { LANG: 'C.UTF-8' }, timeout: 5000, maxBuffer: 65536,
    });
    pending.child.stdin?.end(code);
    const { stdout, stderr } = await pending;
    return { ok: true, stdout, stderr };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
