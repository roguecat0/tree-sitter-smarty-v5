import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, parser, reference, observations, snapshot } from './helpers.mjs';

const treeCases = fixtures('braced-bracket-indices.txt');
const refCases = fixtures('smarty-reference-braced-bracket-indices.txt');

for (const { name, source } of refCases) {
  test(`Braced bracket index Smarty reference: ${name}`, () => {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const expected = reference(source);
    assert.equal(expected.error, null, source);
    assert.deepEqual(observations(root), expected.events);
  });
}

for (const { name, source } of treeCases) {
  test(`Braced bracket index manual tree: ${name}`, () => {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
  });
}

test('Braced and outer-spaced index wrapper fields and exact ranges', () => {
  const source = '{$a[{$x}]}{$a[ {$x} ]}{$a[$x]}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  assert.equal(root.namedChildren.length, 3);
  const [plainBraced, spacedBraced, direct] = root.namedChildren;
  assert.deepEqual([plainBraced.startIndex, plainBraced.endIndex], [0, 10]);
  const firstIndex = plainBraced.childForFieldName('value');
  assert.deepEqual([firstIndex.type, firstIndex.startIndex, firstIndex.endIndex], ['index_expression', 1, 9]);
  assert.deepEqual([firstIndex.childForFieldName('object').startIndex, firstIndex.childForFieldName('object').endIndex], [1, 3]);
  const firstWrapper = firstIndex.childForFieldName('index');
  assert.deepEqual([firstWrapper.type, firstWrapper.startIndex, firstWrapper.endIndex], ['output', 4, 8]);
  const firstValue = firstWrapper.childForFieldName('value');
  assert.deepEqual([firstValue.type, firstValue.text, firstValue.startIndex, firstValue.endIndex], ['variable', '$x', 5, 7]);
  assert.deepEqual([spacedBraced.startIndex, spacedBraced.endIndex], [10, 22]);
  const spacedIndex = spacedBraced.childForFieldName('value');
  assert.deepEqual([spacedIndex.type, spacedIndex.startIndex, spacedIndex.endIndex], ['index_expression', 11, 21]);
  const spacedReceiver = spacedIndex.childForFieldName('object');
  assert.deepEqual([spacedReceiver.startIndex, spacedReceiver.endIndex], [11, 13]);
  const spacedWrapper = spacedIndex.childForFieldName('index');
  assert.deepEqual([spacedWrapper.type, spacedWrapper.startIndex, spacedWrapper.endIndex], ['output', 15, 19]);
  assert.deepEqual([spacedWrapper.childForFieldName('value').startIndex, spacedWrapper.childForFieldName('value').endIndex], [16, 18]);
  assert.deepEqual([source.slice(spacedReceiver.startIndex, spacedReceiver.endIndex), spacedReceiver.text], ['$a', '$a']);
  const directIndex = direct.childForFieldName('value');
  assert.deepEqual([direct.startIndex, direct.endIndex], [22, 30]);
  assert.deepEqual([directIndex.type, directIndex.startIndex, directIndex.endIndex], ['index_expression', 23, 29]);
  const directReceiver = directIndex.childForFieldName('object');
  assert.deepEqual([directReceiver.startIndex, directReceiver.endIndex], [23, 25]);
  const directValue = directIndex.childForFieldName('value');
  assert.equal(directValue, null);
  const directIndexValue = directIndex.childForFieldName('index');
  assert.deepEqual([directIndexValue.type, directIndexValue.startIndex, directIndexValue.endIndex, directIndexValue.text], ['variable', 26, 28, '$x']);
  assert.deepEqual([source.slice(direct.startIndex, direct.endIndex), source.slice(directIndex.startIndex, directIndex.endIndex), source.slice(directReceiver.startIndex, directReceiver.endIndex), source.slice(directIndexValue.startIndex, directIndexValue.endIndex)], [direct.text, directIndex.text, '$a', '$x']);
  assert.equal(root.descendantsOfType('output').length, 5);
  for (const node of [plainBraced, firstIndex, firstWrapper, firstValue, spacedBraced, spacedIndex, spacedReceiver, spacedWrapper, direct, directIndex, directReceiver, directIndexValue]) {
    assert.equal(source.slice(node.startIndex, node.endIndex), node.text);
  }
});

test('Application-shaped composed indices preserve receiver chain, expressions, and modifier', () => {
  const source = '{$rows[$row->get_id()][{$smarty.const.FB_FOLLOW_UP_REPAIR}]|escape}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const modifier = root.firstNamedChild.childForFieldName('value');
  assert.equal(modifier.type, 'modifier_expression');
  const second = modifier.childForFieldName('value');
  const first = second.childForFieldName('object');
  assert.equal(first.type, 'index_expression');
  assert.equal(first.childForFieldName('object').text, '$rows');
  assert.equal(first.childForFieldName('index').type, 'method_call_expression');
  const wrapped = second.childForFieldName('index');
  assert.equal(wrapped.type, 'output');
  const config = wrapped.childForFieldName('value');
  assert.equal(config.type, 'index_expression');
  assert.equal(config.childForFieldName('object').type, 'index_expression');
  assert.equal(config.childForFieldName('object').childForFieldName('object').text, '$smarty');
  assert.equal(config.childForFieldName('object').childForFieldName('index').text, 'const');
  assert.equal(config.childForFieldName('index').text, 'FB_FOLLOW_UP_REPAIR');
  assert.equal(modifier.childForFieldName('name').text, 'escape');
  assert.equal(second.startIndex < first.endIndex && first.endIndex < wrapped.startIndex, true);
});

test('Braced index expressions keep arithmetic precedence and nested index ownership', () => {
  const arithmetic = parser().parse('{$rows[{$i + 1 * 2}]}').rootNode.firstNamedChild.childForFieldName('value');
  const expression = arithmetic.childForFieldName('index').childForFieldName('value');
  assert.equal(expression.type, 'binary_expression');
  assert.equal(expression.childForFieldName('operator').text, '+');
  const product = expression.childForFieldName('right');
  assert.equal(product.type, 'binary_expression');
  assert.equal(product.childForFieldName('operator').text, '*');
  assert.deepEqual([expression.childForFieldName('left').text, product.childForFieldName('left').text, product.childForFieldName('right').text], ['$i', '1', '2']);

  const nestedSource = '{$matrix[{$rows[{$i}]}]}';
  const nestedRoot = parser().parse(nestedSource).rootNode;
  assert.equal(nestedRoot.hasError, false, nestedRoot.toString());
  const outer = nestedRoot.firstNamedChild.childForFieldName('value');
  const outerWrap = outer.childForFieldName('index');
  const innerIndex = outerWrap.childForFieldName('value');
  assert.equal(outer.childForFieldName('object').text, '$matrix');
  assert.equal(outerWrap.type, 'output');
  assert.equal(innerIndex.type, 'index_expression');
  assert.equal(innerIndex.childForFieldName('object').text, '$rows');
  assert.equal(innerIndex.childForFieldName('index').type, 'output');
  assert.equal(innerIndex.childForFieldName('index').childForFieldName('value').text, '$i');
  assert.deepEqual([outer.startIndex, outer.endIndex], [1, nestedSource.length - 1]);
});

test('Unknown-tag attribute composition keeps bracket index and independent sibling', () => {
  const source = '{widget value=$rows[{$row->get_id()}]}{$after}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  assert.deepEqual(observations(root), reference(source).events);
  const [tag, after] = root.namedChildren;
  assert.equal(tag.type, 'custom_tag');
  const attribute = tag.namedChildren.find(child => child.type === 'attribute');
  assert.equal(attribute.childForFieldName('name').text, 'value');
  const index = attribute.childForFieldName('value');
  assert.equal(index.type, 'index_expression');
  assert.equal(index.childForFieldName('object').text, '$rows');
  assert.equal(index.childForFieldName('index').type, 'output');
  assert.equal(index.childForFieldName('index').childForFieldName('value').type, 'method_call_expression');
  assert.deepEqual([after.type, after.text, after.hasError], ['output', '{$after}', false]);
});

test('Malformed inner brace rejection preserves missing marker and following output', () => {
  const source = '{$a[{$x]}{$after}';
  assert.ok(reference(source).error);
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.equal(root.namedChildren[0].type, 'output');
  const index = root.namedChildren[0].childForFieldName('value');
  assert.equal(index.type, 'index_expression');
  assert.equal(index.childForFieldName('index').type, 'output');
  assert.ok(index.childForFieldName('index').children.some(child => child.isMissing && child.type === '}'), root.toString());
  assert.deepEqual([root.namedChildren.at(-1).type, root.namedChildren.at(-1).text, root.namedChildren.at(-1).hasError], ['output', '{$after}', false]);
});

test('Malformed missing bracket localizes an ERROR and preserves following output', () => {
  const source = '{$a[{$x}}{$after}';
  assert.ok(reference(source).error);
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  const malformed = root.namedChildren[0];
  assert.equal(malformed.type, 'ERROR');
  assert.equal(malformed.text, '{$a[{$x}}');
  assert.deepEqual(malformed.namedChildren.map(child => child.type), ['variable', 'output']);
  assert.equal(malformed.namedChildren[0].text, '$a');
  assert.equal(malformed.namedChildren[1].text, '{$x}');
  assert.equal(malformed.namedChildren[1].childForFieldName('value').text, '$x');
  assert.deepEqual([root.namedChildren[1].type, root.namedChildren[1].text, root.namedChildren[1].hasError], ['output', '{$after}', false]);
});

test('Combined missing bracket and outer brace keeps block closer and root sibling', () => {
  const source = '{if true}{$a[{$x}{/if}{$after}';
  assert.ok(reference(source).error);
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  const block = root.namedChildren[0];
  assert.equal(block.type, 'if_block');
  assert.deepEqual(block.namedChildren.map(child => child.type), ['if_tag', 'ERROR', 'if_close_tag']);
  const malformed = block.namedChildren[1];
  assert.equal(malformed.text, '{$a[{$x}');
  assert.deepEqual(malformed.namedChildren.map(child => child.type), ['variable', 'output']);
  assert.equal(malformed.namedChildren[0].text, '$a');
  assert.equal(malformed.namedChildren[1].text, '{$x}');
  assert.deepEqual([block.namedChildren[2].type, block.namedChildren[2].text], ['if_close_tag', '{/if}']);
  assert.deepEqual([root.namedChildren[1].type, root.namedChildren[1].text, root.namedChildren[1].hasError], ['output', '{$after}', false]);
});

test('Rejected inner-leading whitespace preserves independent output', () => {
  const source = '{$a[{ $x}]}{$after}';
  assert.ok(reference(source).error);
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.deepEqual([root.namedChildren.at(-1).type, root.namedChildren.at(-1).text, root.namedChildren.at(-1).hasError], ['output', '{$after}', false]);
});

test('Incremental edits crossing index braces, expression body, and bracket match fresh parses', () => {
  const p = parser();
  let source = '{$before}{$a[$x]}{$after}';
  let tree = p.parse(source);
  const edits = [
    ['[$x]', '[{$x}]'],
    ['{$x}', '{$row->get_id()}'],
    ['[{$row->get_id()}]', '[{$row->get_id()}'],
    ['[{$row->get_id()}', '[{$row->get_id()}]'],
    ['{$row->get_id()}', '{ $row->get_id()}'],
    ['{ $row->get_id()}', '{$smarty.const.REPAIR}'],
    ['[{$smarty.const.REPAIR}]', '[$smarty.const.REPAIR]'],
  ];
  for (const [before, after] of edits) {
    const start = source.indexOf(before, source.indexOf('}{$a[') + 1);
    assert.notEqual(start, -1, before);
    const next = source.slice(0, start) + after + source.slice(start + before.length);
    tree.edit({startIndex: start, oldEndIndex: start + before.length, newEndIndex: start + after.length,
      startPosition: {row: 0, column: start}, oldEndPosition: {row: 0, column: start + before.length}, newEndPosition: {row: 0, column: start + after.length}});
    tree = p.parse(next, tree);
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode), next);
    assert.equal(tree.rootNode.firstNamedChild.text, '{$before}');
    assert.equal(tree.rootNode.lastNamedChild.text, '{$after}');
    source = next;
  }
});
