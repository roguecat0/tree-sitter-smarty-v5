import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixtures, fullEngine, observations, parser, reference, snapshot} from './helpers.mjs';

const examples = fixtures('else-if-branches.txt');
const referenceExamples = fixtures('smarty-reference.txt').filter(({name}) => name === 'smarty-5.8.4-else-if-alias');
assert.equal(examples.length, 4);
assert.equal(referenceExamples.length, 1);

test('Spaced else if uses the elseif clause tree and matches pinned Smarty events', () => {
  for (const {name, source} of examples) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, `${name}: ${root.toString()}`);
    const smarty = reference(source);
    assert.equal(smarty.error, null, `${name}: ${smarty.error}`);
    assert.deepEqual(observations(root), smarty.events, name);
    assert.equal(fullEngine(source, {mode: 'compile'}).error, null, name);
  }

  const source = examples[0].source;
  const root = parser().parse(source).rootNode;
  const block = root.namedChild(0);
  const clause = block.namedChildren.find(child => child.type === 'elseif_clause');
  const tag = clause.namedChild(0);
  assert.equal(tag.text, '{else if $b}');
  assert.equal(tag.childForFieldName('condition').text, '$b');
  assert.equal(clause.namedChild(1).text, 'B');
  assert.equal(block.namedChildren.filter(child => child.type === 'elseif_clause').length, 1);
  assert.equal(block.namedChild(block.namedChildCount - 1).type, 'if_close_tag');

  const bracedSource = examples.find(example => example.name === 'Spaced else if with a braced condition').source;
  const bracedRoot = parser().parse(bracedSource).rootNode;
  const bracedClause = bracedRoot.namedChild(0).namedChildren.find(child => child.type === 'elseif_clause');
  const condition = bracedClause.namedChild(0).childForFieldName('condition');
  assert.equal(bracedClause.namedChild(0).text, '{else if {$b}}');
  assert.equal(condition.type, 'output');
  assert.equal(condition.childForFieldName('value').type, 'variable');
  assert.equal(bracedClause.namedChild(1).text, 'B');
});

test('Pinned Smarty distinguishes exact lowercase one-space else if spelling', () => {
  const probes = [
    ['{if $a}A{else if $b}B{/if}', 'elseif'],
    ['{if $a}A{elseif $b}B{/if}', 'elseif'],
    ['{if $a}A{else  if $b}B{/if}', 'else'],
    ['{if $a}A{else\tif $b}B{/if}', 'else'],
    ['{if $a}A{else\nif $b}B{/if}', 'else'],
    ['{if $a}A{Else if $b}B{/if}', 'Else if'],
  ];
  for (const [source, branchName] of probes) {
    const smarty = reference(source);
    assert.equal(smarty.error, null, `${JSON.stringify(source)}: ${smarty.error}`);
    assert.equal(smarty.events.find(event => event.kind === 'tag' && ['elseif', 'else', 'Else if'].includes(event.name))?.name,
      branchName, JSON.stringify(smarty.events));
    if (branchName !== 'elseif') {
      const root = parser().parse(source).rootNode;
      assert.equal(root.hasError, true, root.toString());
      assert.equal(root.descendantsOfType('elseif_clause').length, 0, root.toString());
      assert.ok(root.toString().includes('if_close_tag'), root.toString());
    }
  }
});

test('Pinned Smarty source fixture records the else-if alias tree and compiler behavior', () => {
  for (const {source} of referenceExamples) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    assert.deepEqual(observations(root), reference(source).events);
    assert.equal(fullEngine(source, {mode: 'compile'}).error, null);
  }
});

test('Malformed spaced branches report errors and keep later siblings or closers visible', () => {
  for (const source of [
    '{if $a}A{else if}B{/if}{$tail}',
    '{if $a}A{else if $b B{/if}{$tail}',
    '{if $a}A{else if $b}B{/foreach}{$tail}',
    '{if $a}A{else if $b}B',
  ]) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, true, root.toString());
    assert.ok(root.toString().includes('ERROR') || root.toString().includes('MISSING'), root.toString());
    assert.ok(root.toString().includes('if_close_tag') || root.toString().includes('$tail') || root.toString().includes('text'), root.toString());
  }
});

function position(source, index) {
  const lines = source.slice(0, index).split('\n');
  return {row: lines.length - 1, column: lines.at(-1).length};
}

test('Incremental edits across the branch spelling match fresh full trees', () => {
  const incremental = parser();
  let source = '{if $a}A{elseif $b}B{else}C{/if}{$tail}';
  let tree = incremental.parse(source);
  assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
  for (const [before, after, hasError] of [
    ['elseif $b', 'else if $b', false],
    ['$b', '', true],
    ['else if ', 'else if $fixed', false],
    ['else if $fixed', 'elseif $fixed', false],
  ]) {
    const startIndex = source.indexOf(before);
    assert.notEqual(startIndex, -1, before);
    const oldEndIndex = startIndex + before.length;
    const next = source.slice(0, startIndex) + after + source.slice(oldEndIndex);
    const newEndIndex = startIndex + after.length;
    tree.edit({startIndex, oldEndIndex, newEndIndex,
      startPosition: position(source, startIndex),
      oldEndPosition: position(source, oldEndIndex),
      newEndPosition: position(next, newEndIndex)});
    tree = incremental.parse(next, tree);
    const fresh = parser().parse(next);
    assert.equal(tree.rootNode.hasError, hasError, next);
    assert.deepEqual(snapshot(tree.rootNode), snapshot(fresh.rootNode), `${before} -> ${after}`);
    assert.equal(tree.rootNode.namedChildren.at(-1).text, '{$tail}', tree.rootNode.toString());
    source = next;
  }
});
