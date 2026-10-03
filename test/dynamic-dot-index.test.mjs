import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, parser, reference, observations, snapshot } from './helpers.mjs';

for (const { name, source } of fixtures('dynamic-dot-index.txt')) {
  if (name.includes('Missing outer brace') || name.includes('Whitespace after dot')) continue;
  test(`Dynamic dot index reference: ${name}`, () => {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const expected = reference(source);
    assert.equal(expected.error, null, source);
    assert.deepEqual(observations(root), expected.events);
  });
}

test('Dynamic dot index fields, ranges, precedence, and no nested output', () => {
  const source = '{$map.{$Key + 1 * 2}}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  assert.equal(root.descendantsOfType('output').length, 1);
  const outer = root.firstNamedChild.childForFieldName('value');
  assert.equal(outer.type, 'index_expression');
  assert.deepEqual([outer.childForFieldName('object').text, outer.childForFieldName('index').text], ['$map', '$Key + 1 * 2']);
  const index = outer.childForFieldName('index');
  assert.deepEqual([index.type, index.childForFieldName('operator').text], ['binary_expression', '+']);
  const multiply = index.childForFieldName('right');
  assert.deepEqual([multiply.type, multiply.childForFieldName('operator').text], ['binary_expression', '*']);
  assert.deepEqual([index.startIndex, index.endIndex], [7, 19]);
  assert.deepEqual([index.childForFieldName('operator').startIndex, index.childForFieldName('operator').endIndex], [12, 13]);
  assert.deepEqual([multiply.childForFieldName('operator').startIndex, multiply.childForFieldName('operator').endIndex], [16, 17]);
  assert.deepEqual(outer.namedChildren.map(child => child.type), ['variable', 'binary_expression']);
  assert.equal(outer.text, '$map.{$Key + 1 * 2}');
});

test('Dynamic dot composition keeps full index expressions in each context', () => {
  for (const source of [
    '{$map.{$printer->get_id()}}', '{$map.{$key|escape}}', '{$map.{$key}.label[2]}',
    '{widget value=$map.{$printer->get_id()} other=$map.{$key}}',
    '{helper($map.{$key})}', '{html_options selected=$labels.{$printer->get_id()}}',
  ]) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    assert.equal(root.descendantsOfType('index_expression').length > 0, true, source);
    assert.equal(root.descendantsOfType('output').some(output => output.text !== source && output.text.includes('{$')), false, source);
    assert.equal(reference(source).error, null, source);
  }
  const tree = parser().parse('{$map.{$key}.label[2]}').rootNode.firstNamedChild.childForFieldName('value');
  assert.equal(tree.type, 'index_expression');
  const dot = tree.childForFieldName('object');
  const dynamic = dot.childForFieldName('object');
  assert.deepEqual([dynamic.type, dynamic.childForFieldName('index').text, dot.childForFieldName('index').text, tree.childForFieldName('index').text],
    ['index_expression', '$key', 'label', '2']);
});

test('Dot and opening brace must be adjacent; following output survives', () => {
  const source = '{$map. {$key}}{$after}';
  assert.ok(reference(source).error);
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.equal(root.descendantsOfType('index_expression').length, 0);
  assert.equal(root.lastNamedChild.type, 'output');
  assert.equal(root.lastNamedChild.text, '{$after}');
});

test('Dynamic dot incomplete and missing-outer-close recovery', () => {
  const incomplete = parser().parse('{$map.{').rootNode;
  assert.equal(incomplete.hasError, true, incomplete.toString());
  const source = '{$map.{$key}{$after}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  const first = root.namedChildren[0];
  assert.equal(first.type, 'output');
  assert.equal(first.childForFieldName('value').type, 'index_expression');
  assert.equal(first.children.some(child => child.isMissing && child.type === '}'), true);
  assert.equal(root.namedChildren[1].text, '{$after}');
  assert.equal(root.namedChildren[1].hasError, false);
});

test('Dynamic dot incremental boundary edits match fresh parses', () => {
  const initial = '{$before}{$map.{$key}}{$after}';
  const p = parser();
  let source = initial;
  let tree = p.parse(source);
  const base = source.indexOf('.{$key}');
  const edits = [
    ['.{$key}', '.{$'], ['.{$', '.{$key}'],
    ['}', ''], ['', '}'],
  ];
  let cursor = base;
  for (const [removed, added] of edits) {
    const start = removed === '}' ? source.indexOf('}}', base) + 1 : cursor;
    const next = source.slice(0, start) + added + source.slice(start + removed.length);
    tree.edit({ startIndex: start, oldEndIndex: start + removed.length, newEndIndex: start + added.length,
      startPosition: { row: 0, column: start }, oldEndPosition: { row: 0, column: start + removed.length },
      newEndPosition: { row: 0, column: start + added.length } });
    tree = p.parse(next, tree);
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode), next);
    assert.equal(tree.rootNode.firstNamedChild.text, '{$before}');
    assert.equal(tree.rootNode.lastNamedChild.text, '{$after}');
    source = next;
    cursor = start;
  }
});
