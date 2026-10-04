import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = { ...process.env, XDG_CACHE_HOME: `${root}/build/test-cache` };
mkdirSync(env.XDG_CACHE_HOME, { recursive: true });
for (const [command, args, timeout] of [
  ['tree-sitter', ['test', '--show-fields'], 120_000],
  [process.execPath, ['--test', ...readdirSync(`${root}/test`).filter(name => name.endsWith('.test.mjs')).sort().map(name => `test/${name}`)], 120_000],
  // A prior full mutation phase took about 241s. Give it a finite 15-minute
  // ceiling (~3.7x that runtime) for load variation; each isolated generation
  // and focused parse also has its own shorter timeout in mutations.mjs.
  [process.execPath, ['test/mutations.mjs'], 900_000],
]) {
  try {
    execFileSync(command, args, { cwd: root, env, stdio: 'inherit', timeout });
  } catch (error) {
    process.exit(error.status || 1);
  }
}
