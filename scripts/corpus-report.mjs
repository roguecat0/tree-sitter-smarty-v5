import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Parser from 'tree-sitter';
import language from '../bindings/node/index.js';

// Lexical hints are deliberately independent of the incomplete grammar. They
// can match quoted/commented text; they are triage clues, not diagnosed causes.
const hints = {
  comments: /\{\*/,
  config_variables: /\{#[A-Za-z_][\w]*#/,
  object_members: /->/,
  dot_access: /\$[A-Za-z_]\w*\./,
  comparisons: /(?:===?|!==?|>=|<=|\s(?:eq|ne|gt|lt)\s)/,
  foreach: /\{foreach\b/,
  literal: /\{literal\}/,
  custom_switch: /\{switch\b/,
};

const separateUpstreamCorpora = new Set(['upstream-smarty-v5.8.4-core', 'upstream-smarty-v5.8.4-example']);

export function listTemplates(dir) {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .flatMap(entry => entry.isDirectory() && !separateUpstreamCorpora.has(entry.name) ? listTemplates(join(dir, entry.name))
      : entry.isFile() && entry.name.endsWith('.tpl') ? [join(dir, entry.name)] : []);
}

export function inspect(source, timeoutMicros = 2_000_000) {
  const parser = new Parser().setLanguage(language);
  parser.setTimeoutMicros(timeoutMicros);
  const tree = parser.parse(source);
  if (!tree) throw new Error('Parser timed out; report is incomplete');
  const errors = [];
  const stack = [tree.rootNode];
  while (stack.length) {
    const node = stack.pop();
    if (node.type === 'ERROR' || node.isMissing) {
      errors.push({ kind: node.isMissing ? `missing ${node.type}` : 'ERROR',
        startIndex: node.startIndex, endIndex: node.endIndex,
        line: node.startPosition.row + 1, column: node.startPosition.column + 1,
        snippet: source.slice(Math.max(0, node.startIndex - 35), Math.min(source.length, node.startIndex + 125)),
      });
    }
    stack.push(...node.children.reverse());
  }
  return { clean: !tree.rootNode.hasError, errors,
    hints: Object.entries(hints).filter(([, pattern]) => pattern.test(source)).map(([name]) => name) };
}

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const dir = resolve(process.argv[2] || join(root, 'corpus'));
  const output = resolve(process.argv[3] || join(root, 'build/corpus-report.json'));
  const paths = listTemplates(dir);
  if (!paths.length) throw new Error(`No .tpl files found in ${dir}; nothing was measured`);
  const files = paths.map(path => {
    const bytes = readFileSync(path);
    const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    return { path: relative(dir, path), sha256: createHash('sha256').update(bytes).digest('hex'), ...inspect(source) };
  });
  const groups = Object.keys(hints).map(name => ({ hint: name,
    failingFiles: files.filter(file => !file.clean && file.hints.includes(name)).length,
    examples: files.filter(file => !file.clean && file.hints.includes(name)).slice(0, 3).map(file => file.path),
  })).sort((a, b) => b.failingFiles - a.failingFiles);
  const clean = files.filter(file => file.clean).length;
  const report = { schemaVersion: 1, grammarSha256: createHash('sha256').update(readFileSync(join(root, 'src/parser.c'))).digest('hex'),
    coordinateUnits: 'Node binding UTF-16 code units; line/column are 1-based',
    total: files.length, clean, failing: files.length - clean, groups, files };
  mkdirSync(resolve(output, '..'), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`${files.length} templates: ${clean} without parse errors; ${files.length - clean} with errors.`);
  console.log('No-error files are candidates for review, not verified coverage.');
  console.log('\nHints in failing files (overlap; not confirmed error causes):');
  for (const group of groups) console.log(`  ${group.hint}: ${group.failingFiles} (${group.examples.join(', ')})`);
  console.log('\nFirst error in up to five files:');
  for (const file of files.filter(file => !file.clean).slice(0, 5)) {
    const error = file.errors[0];
    console.log(`  ${file.path}:${error.line}:${error.column} ${JSON.stringify(error.snippet)}`);
  }
  console.log(`\nFull local report: ${output}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
