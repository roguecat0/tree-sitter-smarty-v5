import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const original = readFileSync(join(root, 'grammar.js'), 'utf8');
const mutations = [
  { name: 'class constant name loses its field', fixture: 'Class constant output',
    from: 'field("constant", alias(token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/), $.identifier))',
    to: 'field("value", alias(token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/), $.identifier))' },
  { name: 'index key loses its field', fixture: 'Mixed indices preserve receiver',
    from: 'seq("[", field("index", $._index_value), "]")',
    to: 'seq("[", field("value", $._index_value), "]")' },
  { name: 'foreach source gets the wrong field', fixture: 'Simple foreach',
    from: 'field("source", $._expression)',
    to: 'field("value", $._expression)' },
  { name: 'boolean operator levels are swapped', fixture: 'Boolean precedence',
    from: 'field("operator", "||"), field("right", $._logical_and)',
    to: 'field("operator", "&&"), field("right", $._logical_and)',
    alsoFrom: 'field("operator", "&&"), field("right", $._equality)',
    alsoTo: 'field("operator", "||"), field("right", $._equality)' },
  { name: 'method arguments lose their field', fixture: 'Method arguments preserve order',
    from: 'method_call_expression: $ => prec.left(6, seq(\n      field("object", choice($.variable, $.member_expression, $.method_call_expression, $.index_expression)),\n      "->", field("method", reserved("property", $.identifier)), "(",\n      optional(seq(field("argument", $._expression), repeat(seq(",", field("argument", $._expression))))), ")",\n    ))',
    to: 'method_call_expression: $ => prec.left(6, seq(\n      field("object", choice($.variable, $.member_expression, $.method_call_expression, $.index_expression)),\n      "->", field("method", reserved("property", $.identifier)), "(",\n      optional(seq(field("value", $._expression), repeat(seq(",", field("value", $._expression))))), ")",\n    ))' },
  { name: 'standalone function arguments lose their field', fixture: 'Function output',
    from: 'function_call_expression: $ => prec.left(8, seq(\n      field("name", $.identifier), "(",\n      optional(seq(field("argument", $._expression), repeat(seq(",", field("argument", $._expression))))), ")",\n    ))',
    to: 'function_call_expression: $ => prec.left(8, seq(\n      field("name", $.identifier), "(",\n      optional(seq(field("value", $._expression), repeat(seq(",", field("value", $._expression))))), ")",\n    ))' },
  { name: 'static class method arguments lose their field', fixture: 'Multiple ordinary arguments',
    from: 'static_method_call_expression: $ => prec(9, seq(\n      field("class", choice(\n        reserved("class", $.identifier), alias(choice(...controlWords), $.identifier),\n        alias($.boolean, $.identifier), alias($.null, $.identifier),\n      )), token.immediate("::"),\n      field("method", reserved("property", alias(token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/), $.identifier))), "(",\n      optional(seq(field("argument", $._expression), repeat(seq(",", field("argument", $._expression))))), ")",\n    ))',
    to: 'static_method_call_expression: $ => prec(9, seq(\n      field("class", choice(\n        reserved("class", $.identifier), alias(choice(...controlWords), $.identifier),\n        alias($.boolean, $.identifier), alias($.null, $.identifier),\n      )), token.immediate("::"),\n      field("method", reserved("property", alias(token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/), $.identifier))), "(",\n      optional(seq(field("value", $._expression), repeat(seq(",", field("value", $._expression))))), ")",\n    ))' },
  { name: 'property chain receiver gets the wrong field', fixture: 'Left associated property chain',
    from: 'member_expression: $ => prec.left(5, seq(\n      field("object", choice($.variable, $.member_expression, $.method_call_expression, $.index_expression))',
    to: 'member_expression: $ => prec.left(5, seq(\n      field("value", choice($.variable, $.member_expression, $.method_call_expression, $.index_expression))' },
  { name: 'comment swallowed as text', fixture: 'Comment hides tags and quotes',
    from: '$.if_block, $.comment, $.foreach_block)',
    to: '$.if_block, alias($.comment, $.text), $.foreach_block)' },
  { name: 'custom tag swallowed as text', fixture: 'Custom tag arguments',
    from: 'choice($.text, $.output, $.custom_tag,',
    to: 'choice($.text, $.output, alias($.custom_tag, $.text),' },
  { name: 'attribute value gets the wrong field', fixture: 'Custom tag arguments',
    from: 'attribute: $ => seq(field("name", $._attribute_name), "=", field("value", $._tag_attribute_value))',
    to: 'attribute: $ => seq(field("name", $._attribute_name), "=", field("argument", $._tag_attribute_value))' },
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
    mkdirSync(join(dir, 'src'), { recursive: true });
    cpSync(join(root, 'src/tree_sitter'), join(dir, 'src/tree_sitter'), { recursive: true });
    cpSync(join(root, 'src/scanner.c'), join(dir, 'src/scanner.c'));
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
    const options = { cwd: dir, encoding: 'utf8', timeout: 30_000, env: process.env };
    // Establish that this isolated setup works before attributing failure to a bug.
    writeFileSync(join(dir, 'grammar.js'), original);
    execFileSync('tree-sitter', ['generate'], options);
    execFileSync('tree-sitter', ['test', '--show-fields', '--include', mutation.fixture], options);
    assert.equal(original.split(mutation.from).length, 2, 'Mutation must match exactly once');
    let modified = original.replace(mutation.from, mutation.to);
    if (mutation.alsoFrom) {
      assert.equal(original.split(mutation.alsoFrom).length, 2, 'Second mutation anchor must match once');
      modified = modified.replace(mutation.alsoFrom, mutation.alsoTo);
    }
    writeFileSync(join(dir, 'grammar.js'), modified);
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
