import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, observations, parser, reference, snapshot } from './helpers.mjs';

for (const { name, source } of fixtures('loop-metadata.txt')) {
  test(`Loop metadata reference: ${name}`, () => {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, `${name}: ${root.toString()}`);
    const expected = reference(source);
    assert.equal(expected.error, null, `${name}: Smarty rejected fixture`);
    assert.deepEqual(observations(root), expected.events, `${name}: surrounding Smarty event projection`);
  });
}

test('Loop metadata preserves all standard property names, fields, token and ranges', () => {
  const names = ['first', 'last', 'index', 'iteration', 'show', 'total', 'key'];
  const source = `{foreach $items as $item}${names.map(name => `{$item@${name}}`).join('')}{/foreach}`;
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expressions = root.descendantsOfType('loop_metadata_expression');
  assert.equal(expressions.length, names.length);
  for (let i = 0; i < names.length; i++) {
    const node = expressions[i];
    const item = node.childForFieldName('item');
    const property = node.childForFieldName('property');
    const propertyStart = source.indexOf(`@${names[i]}`, node.startIndex) + 1;
    assert.equal(item.type, 'variable');
    assert.equal(item.text, '$item');
    assert.equal(property.type, 'identifier');
    assert.equal(property.text, names[i]);
    assert.deepEqual([property.startIndex, property.endIndex], [propertyStart, propertyStart + names[i].length]);
    assert.deepEqual(node.children.filter(child => !child.isNamed).map(child => child.text), ['@']);
  }
});

test('Unknown metadata suffix retains the item and exact property spelling', () => {
  const source = '{foreach $items as $item}{$item@madeup}{/foreach}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const node = root.descendantsOfType('loop_metadata_expression')[0];
  assert.ok(node);
  assert.equal(node.childForFieldName('item').text, '$item');
  assert.equal(node.childForFieldName('property').type, 'identifier');
  assert.equal(node.childForFieldName('property').text, 'madeup');
  assert.equal(reference(source).error, null);
});

test('Metadata composes with existing comparison and boolean operators', () => {
  const root = parser().parse('{if $item@first || $item@index > 1}yes{/if}').rootNode;
  assert.equal(root.hasError, false, root.toString());
  const condition = root.descendantsOfType('if_tag')[0].childForFieldName('condition');
  assert.equal(condition.childForFieldName('operator').text, '||');
  assert.equal(condition.childForFieldName('left').type, 'loop_metadata_expression');
  const comparison = condition.childForFieldName('right');
  assert.equal(comparison.childForFieldName('operator').text, '>');
  assert.equal(comparison.childForFieldName('left').type, 'loop_metadata_expression');
  assert.equal(comparison.childForFieldName('right').text, '1');
});

test('Metadata composes with arithmetic and retains operator and operands', () => {
  const root = parser().parse('{foreach $items as $item}{$item@index + 1}{/foreach}').rootNode;
  assert.equal(root.hasError, false, root.toString());
  const value = root.descendantsOfType('output')[0].childForFieldName('value');
  assert.equal(value.type, 'binary_expression');
  assert.equal(value.childForFieldName('left').type, 'loop_metadata_expression');
  assert.equal(value.childForFieldName('left').childForFieldName('property').text, 'index');
  assert.equal(value.childForFieldName('operator').text, '+');
  assert.equal(value.childForFieldName('right').text, '1');
});

test('Missing or separated metadata suffix rejects and recovers around valid neighbors', () => {
  for (const malformed of ['{$item@}', '{$item @index}']) {
    const source = `{foreach $items as $item}{$before}${malformed}{$after}{/foreach}`;
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, true, root.toString());
    assert.match(reference(malformed).error, /Syntax error/);
    assert.equal(root.descendantsOfType('foreach_close_tag').length, 1, root.toString());
    assert.equal(root.descendantsOfType('variable').some(node => node.text === '$before'), true, root.toString());
    assert.equal(root.descendantsOfType('variable').some(node => node.text === '$after'), true, root.toString());
  }
});

test('Metadata suffix edits break and repair incrementally like a fresh parse', () => {
  const p = parser();
  let source = '{foreach $items as $item}{$before}{$item@index}{$after}{/foreach}';
  let tree = p.parse(source);
  for (const [before, after, error] of [['index', '', true], ['', 'index', false]]) {
    const index = source.indexOf('$item@') + '$item@'.length;
    const endIndex = index + before.length;
    const next = source.slice(0, index) + after + source.slice(endIndex);
    tree.edit({ startIndex: index, oldEndIndex: endIndex, newEndIndex: index + after.length,
      startPosition: { row: 0, column: index }, oldEndPosition: { row: 0, column: endIndex }, newEndPosition: { row: 0, column: index + after.length } });
    tree = p.parse(next, tree);
    assert.equal(tree.rootNode.hasError, error, tree.rootNode.toString());
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode));
    assert.equal(tree.rootNode.descendantsOfType('foreach_close_tag').length, 1, tree.rootNode.toString());
    source = next;
  }
});
