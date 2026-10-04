import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = { ...process.env, XDG_CACHE_HOME: `${root}/build/test-cache` };
mkdirSync(env.XDG_CACHE_HOME, { recursive: true });
for (const [command, args, timeout] of [
  ['tree-sitter', ['test', '--show-fields'], 120_000],
  [process.execPath, ['--test', ...readdirSync(`${root}/test`).filter(name => name.endsWith('.test.mjs')).sort().map(name => `test/${name}`)], 120_000],
  // Each deliberate mutation regenerates and tests an isolated parser. The
  // expression grammar has grown enough that this phase can exceed four
  // minutes; keep a finite ten-minute bound so all mutations can finish after
  // the full corpus and Node suites have already run.
  [process.execPath, ['test/mutations.mjs'], 600_000],
]) {
  try {
    execFileSync(command, args, { cwd: root, env, stdio: 'inherit', timeout });
  } catch (error) {
    process.exit(error.status || 1);
  }
}
