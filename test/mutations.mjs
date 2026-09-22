import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const original = readFileSync(join(root, 'grammar.js'), 'utf8');
const mutations = [
  { name: 'custom tag swallowed as text', fixture: 'Custom tag arguments',
    from: 'choice($.text, $.output, $.custom_tag,',
    to: 'choice($.text, $.output, alias($.custom_tag, $.text),' },
  { name: 'attribute value gets the wrong field', fixture: 'Custom tag arguments',
    from: 'attribute: $ => seq(field("name", $.identifier), "=", field("value", $._expression))',
    to: 'attribute: $ => seq(field("name", $.identifier), "=", field("argument", $._expression))' },
  { name: 'addition binds tighter than multiplication', fixture: 'Arithmetic precedence',
    from: '[[1, ["+", "-"]], [2, ["*", "/", "%"]]]',
    to: '[[2, ["+", "-"]], [1, ["*", "/", "%"]]]' },
];

console.log('\nChecking that deliberate grammar bugs are caught:');
for (const mutation of mutations) {
  const dir = mkdtempSync(join(tmpdir(), 'smarty-mutation-'));
  try {
    cpSync(join(root, 'tree-sitter.json'), join(dir, 'tree-sitter.json'));
    mkdirSync(join(dir, 'test'), { recursive: true });
    cpSync(join(root, 'test/corpus'), join(dir, 'test/corpus'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
    const options = { cwd: dir, encoding: 'utf8', timeout: 30_000, env: process.env };
    // Establish that this isolated setup works before attributing failure to a bug.
    writeFileSync(join(dir, 'grammar.js'), original);
    execFileSync('tree-sitter', ['generate'], options);
    execFileSync('tree-sitter', ['test', '--show-fields', '--include', mutation.fixture], options);
    assert.equal(original.split(mutation.from).length, 2, 'Mutation must match exactly once');
    writeFileSync(join(dir, 'grammar.js'), original.replace(mutation.from, mutation.to));
    execFileSync('tree-sitter', ['generate'], options);
    const result = spawnSync('tree-sitter', ['test', '--show-fields', '--include', mutation.fixture], options);
    assert.ifError(result.error);
    assert.equal(result.status, 1, `Bug escaped: ${mutation.name}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /1 failure:/, 'Must be a tree assertion failure, not a build/tool failure');
    console.log(`  CAUGHT: ${mutation.name} (${mutation.fixture})`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
