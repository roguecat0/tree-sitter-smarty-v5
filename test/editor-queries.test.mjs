import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import Parser from 'tree-sitter';
import language from '../bindings/node/index.js';
import { parser, snapshot } from './helpers.mjs';
const query = name => new Parser.Query(language, readFileSync(new URL(`../queries/${name}.scm`, import.meta.url), 'utf8'));
const captures = (q, source) => q.captures(parser().parse(source).rootNode).map(c => [c.name, c.node.text]);

test('editor queries compile and highlight fields rather than all identifiers', () => {
  const q = query('highlights');
  const source = '{widget key=$user->name}{$user|escape}{Foo::run($user)}{#title#}{if $ok}yes{/if}';
  assert.equal(parser().parse(source).rootNode.hasError, false);
  const actual = captures(q, source);
  for (const expected of [['tag','widget'], ['tag.attribute','key'], ['variable','$user'],
    ['variable.member','name'], ['function.call','escape'], ['type','Foo'],
    ['function.method.call','run'], ['constant','title'], ['keyword.conditional','if']]) {
    assert.ok(actual.some(c => c[0] === expected[0] && c[1] === expected[1]), JSON.stringify(expected));
  }
  assert.ok(!actual.some(c => c[0] === 'variable' && c[1] === 'key'));
});

test('script output tree remains explicit; injection combines text and literal bodies only', () => {
  const source = '<script>const x = {$value};</script>';
  assert.equal(parser().parse(source).rootNode.toString(), '(source_file (text) (output value: (variable name: (identifier))) (text))');
  const q = query('injections');
  assert.deepEqual(captures(q, source), [['injection.content','<script>const x = '], ['injection.content',';</script>']]);
  const composed = '<div class="{$class}">{if $ok}{literal}<b>{$opaque}</b>{/literal}{/if}</div>{* comment *}';
  assert.deepEqual(captures(q, composed), [['injection.content','<div class="'], ['injection.content','">'], ['injection.content','<b>{$opaque}</b>'], ['injection.content','</div>']]);
  assert.match(readFileSync(new URL('../queries/injections.scm', import.meta.url),'utf8'), /injection\.combined/);
});

test('folds select recognized blocks and leave generic tag pairs independent', () => {
  const actual = captures(query('folds'), '{if $ok}\n{foreach $xs as $x}{$x}{/foreach}\n{/if}{widget}x{/widget}');
  assert.equal(actual.length, 2);
  assert.ok(actual.every(c => c[0] === 'fold' && !c[1].includes('widget')));
});

test('interpolation keeps variable highlighting and script boundary edits match fresh trees', () => {
  assert.ok(captures(query('highlights'), '{$x|default:"hello {$name}"}').some(c => c[0] === 'variable' && c[1] === '$name'));
  const p = parser();
  let source = '<script>const x = {$value}; const y = 1;</script>';
  let tree = p.parse(source);
  for (const replacement of ['', 'value']) {
    const startIndex = source.indexOf('{$') + 2;
    const oldEndIndex = source.indexOf('}', startIndex);
    tree.edit({ startIndex, oldEndIndex, newEndIndex: startIndex + replacement.length,
      startPosition: {row:0,column:startIndex}, oldEndPosition:{row:0,column:oldEndIndex}, newEndPosition:{row:0,column:startIndex+replacement.length} });
    source = source.slice(0,startIndex) + replacement + source.slice(oldEndIndex);
    tree = p.parse(source,tree);
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(source).rootNode));
  }
  assert.equal(tree.rootNode.hasError,false);
});


test('runtime queries match canonical queries and all Smarty highlights outrank hosts', () => {
  for (const name of ['highlights', 'injections', 'folds']) {
    assert.equal(readFileSync(new URL(`../queries/smarty2/${name}.scm`, import.meta.url), 'utf8'),
      readFileSync(new URL(`../queries/${name}.scm`, import.meta.url), 'utf8'));
  }
  const q = query('highlights');
  const root = parser().parse('<script>const x = "{$value}"; {if $ok}run();{/if}</script>').rootNode;
  for (const match of q.matches(root)) assert.equal(match.setProperties.priority, '110');
  assert.equal(language.HIGHLIGHTS_QUERY, readFileSync(new URL('../queries/highlights.scm', import.meta.url), 'utf8'));
  assert.equal(language.INJECTIONS_QUERY, readFileSync(new URL('../queries/injections.scm', import.meta.url), 'utf8'));
});
