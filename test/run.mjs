import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = { ...process.env, XDG_CACHE_HOME: `${root}/build/test-cache` };
mkdirSync(env.XDG_CACHE_HOME, { recursive: true });
for (const [command, args, timeout] of [
  ['tree-sitter', ['test', '--show-fields'], 120_000],
  [process.execPath, ['--test', ...readdirSync(`${root}/test`).filter(name => name.endsWith('.test.mjs')).sort().map(name => `test/${name}`)], 120_000],
  // Each deliberate mutation regenerates and tests an isolated parser. As the
  // mutation set grows, give that sequence enough time to finish after the
  // full corpus and Node suites have already run.
  [process.execPath, ['test/mutations.mjs'], 240_000],
]) {
  try {
    execFileSync(command, args, { cwd: root, env, stdio: 'inherit', timeout });
  } catch (error) {
    process.exit(error.status || 1);
  }
}
