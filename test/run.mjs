import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = { ...process.env, XDG_CACHE_HOME: `${root}/build/test-cache` };
mkdirSync(env.XDG_CACHE_HOME, { recursive: true });
for (const [command, args] of [
  ['tree-sitter', ['test', '--show-fields']],
  [process.execPath, ['--test', ...readdirSync(`${root}/test`).filter(name => name.endsWith('.test.mjs')).sort().map(name => `test/${name}`)]],
  [process.execPath, ['test/mutations.mjs']],
]) {
  try {
    execFileSync(command, args, { cwd: root, env, stdio: 'inherit', timeout: 120_000 });
  } catch (error) {
    process.exit(error.status || 1);
  }
}
