import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('ternary-expressions.txt');
assert.equal(examples.length, 16);
for (const { name, source } of examples) test(`Ternary tree and Smarty reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expressions = root.descendantsOfType('ternary_expression');
  assert.ok(expressions.length, root.toString());
  for (const expression of expressions) {
    for (const field of ['condition', 'consequence', 'alternative']) {
      assert.ok(expression.childForFieldName(field), `${field}: ${expression.toString()}`);
    }
  }
  const expected = reference(source);
  assert.equal(expected.error, null, name);
  assert.deepEqual(observations(root), expected.events);
});

test('Ternary fields preserve full operands, explicit parentheses, and operator ranges', () => {
  const cases = [
    { source: '{$group_id == -1 ? $main_group_id : $group_id}', path: root => root.firstNamedChild.childForFieldName('value'), condition: 'binary_expression' },
    { source: '{$a + $b ? $yes : $no}', path: root => root.firstNamedChild.childForFieldName('value'), condition: 'binary_expression' },
    { source: '{$flag ? $a + $b : $no}', path: root => root.firstNamedChild.childForFieldName('value'), consequence: 'binary_expression' },
    { source: '{($a ? $b : $c) ? $d : $e}', path: root => root.firstNamedChild.childForFieldName('value'), condition: 'parenthesized_expression' },
    { source: '{$a ? $b : ($c ? $d : $e)}', path: root => root.firstNamedChild.childForFieldName('value'), alternative: 'parenthesized_expression' },
  ];
  for (const entry of cases) {
    const root = parser().parse(entry.source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const ternary = entry.path(root);
    assert.equal(ternary.type, 'ternary_expression');
    for (const field of ['condition', 'consequence', 'alternative']) assert.ok(ternary.childForFieldName(field));
    for (const [field, type] of Object.entries(entry).filter(([key]) => !['source', 'path'].includes(key))) {
      assert.equal(ternary.childForFieldName(field).type, type);
    }
  }

  const source = '{($a > 0 and $b) ? ($yes|escape) : $no}';
  const root = parser().parse(source).rootNode;
  const condition = root.descendantsOfType('ternary_expression')[0].childForFieldName('condition').namedChild(0);
  assert.equal(condition.type, 'binary_expression');
  assert.equal(condition.childForFieldName('operator').text.toLowerCase(), 'and');
  assert.equal(source.slice(condition.childForFieldName('operator').startIndex, condition.childForFieldName('operator').endIndex), 'and');
  assert.equal(root.descendantsOfType('modifier_expression')[0].text, '$yes|escape');
  assert.equal(root.descendantsOfType('ternary_expression')[0].childForFieldName('consequence').type,
    'parenthesized_expression');
});

test('Ternary ownership composes through tags, calls, modifiers, indices, and arrays', () => {
  const sources = [
    '{$x = $a ? $b : $c}', '{if $a ? $b : $c}Y{/if}',
    '{unknown value=$a ? $b : $c}', '{call($a ? $b : $c)}',
    '{$object->call($a ? $b : $c)}', '{$x|cat:($a ? $b : $c)}',
    '{$x|cat:$a ? $b : $c}', '{$items[$a ? $b : $c]}',
    '{array($a ? $b : $c, ($a ? $b : $c)=>$value)}',
  ];
  for (const source of sources) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, `${source}\n${root.toString()}`);
    assert.ok(root.descendantsOfType('ternary_expression').length, root.toString());
  }
});

test('Smarty compiler accepts nested forms; PHP 8 render limit stays separate', () => {
  const controlled = fullEngine('{$a + $b ? $yes : $no}|{$flag ? $a + $b : $no}' +
    '|{($a ? $b : $c) ? $d : $e}|{$a ? $b : ($c ? $d : $e)}', {
      values: { a: 0, b: 1, c: 1, d: 'D', e: 'E', yes: 'Y', no: 'N', flag: 1 },
    });
  assert.equal(controlled.error, null);
  assert.equal(controlled.result, 'Y|1|D|D');
  const hdb = fullEngine('{$group_id == -1 ? $main_group_id : $group_id}', {
    values: { group_id: -1, main_group_id: 42 },
  });
  assert.equal(hdb.error, null);
  assert.equal(hdb.result, '42');

  const source = '{$a ? $b : $c ? $d : $e}';
  const compiled = fullEngine(source, { mode: 'compile' });
  assert.equal(compiled.error, null);
  assert.equal(compiled.result, 'compiled');
  assert.equal(reference(source).error, null);
});

test('Smarty grouping places an unparenthesized modifier before the ternary', () => {
  const direct = '{$x|cat:$a ? $b : $c}';
  const directTree = parser().parse(direct).rootNode;
  const directTernary = directTree.descendantsOfType('ternary_expression')[0];
  assert.equal(directTernary.childForFieldName('condition').type, 'modifier_expression');
  assert.equal(directTernary.childForFieldName('condition').childForFieldName('argument').text, '$a');
  assert.equal(reference(direct).error, null);
  assert.equal(fullEngine(direct, { values: { x: '', a: 0, b: 'B', c: 'C' } }).result, 'C');
  assert.equal(fullEngine(direct, { values: { x: 'X', a: 0, b: 'B', c: 'C' } }).result, 'B');

  const grouped = '{$x|cat:($a ? $b : $c)}';
  const groupedTree = parser().parse(grouped).rootNode;
  const modifier = groupedTree.descendantsOfType('modifier_expression')[0];
  assert.equal(modifier.childForFieldName('argument').type, 'parenthesized_expression');
  assert.equal(fullEngine(grouped, { values: { x: 'X', a: 0, b: 'B', c: 'C' } }).result, 'XC');
});

test('Malformed ternary delimiters retain later output and surrounding block structure', () => {
  for (const source of [
    '{$before}{? $b : $c}{$after}',
    '{$before}{$a ? : $c}{$after}', '{$before}{$a ? $b}{$after}',
    '{$before}{$a ? $b :}{$after}', '{$before}{$a ? $b : ($c ? $d}{$after}',
    '{if ? $b : $c}{*keep*}{$inside}{/if}{$after}',
    '{if $a ? : $c}{*keep*}{$inside}{/if}{$after}',
    '{if $a ? $b}{*keep*}{$inside}{/if}{$after}',
    '{if $a ? $b : }{*keep*}{$inside}{/if}{$after}',
  ]) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, true, `${source}\n${root.toString()}`);
    assert.ok(root.descendantsOfType('output').length >= 2, root.toString());
    if (source.startsWith('{if ')) {
      assert.ok(root.descendantsOfType('if_close_tag').length, root.toString());
      assert.ok(root.descendantsOfType('comment').length, root.toString());
    }
  }
});

test('Changing a comparison output into a ternary and restoring it matches fresh snapshots', () => {
  const p = parser();
  const simple = '{$a > 0}';
  const ternary = '{$a > 0 ? $yes : $no}';
  let tree = p.parse(simple);
  const at = simple.indexOf('}');
  tree.edit({ startIndex: at, oldEndIndex: at, newEndIndex: at + ' ? $yes : $no'.length,
    startPosition: { row: 0, column: at }, oldEndPosition: { row: 0, column: at },
    newEndPosition: { row: 0, column: at + ' ? $yes : $no'.length } });
  tree = p.parse(ternary, tree);
  assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
  assert.deepEqual(snapshot(tree.rootNode), snapshot(p.parse(ternary).rootNode));

  const restored = simple;
  tree.edit({ startIndex: at, oldEndIndex: at + ' ? $yes : $no'.length, newEndIndex: at,
    startPosition: { row: 0, column: at }, oldEndPosition: { row: 0, column: at + ' ? $yes : $no'.length },
    newEndPosition: { row: 0, column: at } });
  tree = p.parse(restored, tree);
  assert.deepEqual(snapshot(tree.rootNode), snapshot(p.parse(restored).rootNode));
});

test('Deleting and restoring each ternary delimiter matches fresh snapshots', () => {
  const p = parser();
  let source = '{$a ? $b : $c}';
  let tree = p.parse(source);
  const edit = (start, from, to) => {
    assert.equal(source.slice(start, start + from.length), from, `unexpected source at ${start}: ${source}`);
    const end = start + from.length;
    tree.edit({ startIndex: start, oldEndIndex: end, newEndIndex: start + to.length,
      startPosition: { row: 0, column: start }, oldEndPosition: { row: 0, column: end },
      newEndPosition: { row: 0, column: start + to.length } });
    source = source.slice(0, start) + to + source.slice(end);
    tree = p.parse(source, tree);
    assert.deepEqual(snapshot(tree.rootNode), snapshot(p.parse(source).rootNode), source);
    assert.equal(tree.rootNode.hasError, source !== '{$a ? $b : $c}', source);
  };

  edit(4, '?', '');
  edit(4, '', '?');
  edit(9, ':', '');
  edit(9, '', ':');
});
