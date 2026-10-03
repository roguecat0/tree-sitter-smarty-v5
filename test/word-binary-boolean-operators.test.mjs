import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('word-binary-boolean-operators.txt');
assert.equal(examples.length, 15);
for (const { name, source } of examples) test(`Word binary operator tree and reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expected = reference(source);
  assert.equal(expected.error, null, name);
  assert.deepEqual(observations(root), expected.events);
});

test('Word precedence trees preserve exact operator spelling and ranges', () => {
  const cases = [
    { source: '{$a and $b OR $c}', outer: 'OR', inner: 'and', innerField: 'left',
      sourceWords: ['and', 'OR'] },
    { source: '{$a XoR $b or $c}', outer: 'XoR', inner: 'or', innerField: 'right',
      sourceWords: ['XoR', 'or'] },
  ];

  for (const { source, outer, inner, innerField, sourceWords } of cases) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const expression = root.descendantsOfType('binary_expression')[0];
    const outerOperator = expression.childForFieldName('operator');
    const nested = expression.childForFieldName(innerField);
    const innerOperator = nested.childForFieldName('operator');
    const operators = root.descendantsOfType('word_operator');

    assert.equal(outerOperator.text, outer);
    assert.equal(innerOperator.text, inner);
    assert.equal(nested.type, 'binary_expression');
    assert.equal(expression.childForFieldName(innerField), nested);
    assert.deepEqual(operators.map(node => node.text), sourceWords);
    assert.deepEqual(operators.map(node => [node.startIndex, node.endIndex]),
      sourceWords.map(word => [source.indexOf(word), source.indexOf(word) + word.length]));
  }
});

test('Word binary operators compose in elseif conditions with explicit precedence fields', () => {
  const source = '{if $a or $b}A{elseif $c XoR $d and $e}B{/if}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());

  const clause = root.descendantsOfType('elseif_clause')[0];
  const condition = clause.descendantsOfType('binary_expression')[0];
  const outerOperator = condition.childForFieldName('operator');
  const right = condition.childForFieldName('right');
  const innerOperator = right.childForFieldName('operator');
  const operators = root.descendantsOfType('word_operator');

  assert.equal(condition.type, 'binary_expression');
  assert.equal(outerOperator.text, 'XoR');
  assert.equal(right.type, 'binary_expression');
  assert.equal(innerOperator.text, 'and');
  assert.equal(condition.childForFieldName('left').text, '$c');
  assert.equal(right.childForFieldName('left').text, '$d');
  assert.equal(right.childForFieldName('right').text, '$e');
  assert.deepEqual(operators.map(node => node.text), ['or', 'XoR', 'and']);
  assert.deepEqual(operators.map(node => [node.startIndex, node.endIndex]),
    ['or', 'XoR', 'and'].map(word => [source.indexOf(word), source.indexOf(word) + word.length]));
});

test('Word aliases respect identifier, string, comment, and spacing boundaries', () => {
  for (const source of ['{$and}{$or}{$xor}', '{"and or xor"}{* and or xor *}',
    '{if $a\r\nand\r\n$b}Y{/if}', '{$a AND $b}', '{$a oR $b}', '{$a XoR $b}',
    '{$aand}',
    '{and($value)}{or($value)}{xor($value)}',
    '{widget and}{widget value=or}{widget xor=value}']) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    assert.equal(reference(source).error, null, source);
  }
  for (const source of ['{$a and$b}', '{$a or$b}', '{$a xor$b}']) {
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
    assert.notEqual(reference(source).error, null, source);
  }

  const literalThenExpression = '{literal}{$a and $b}{/literal}{$c xor $d}';
  const literalRoot = parser().parse(literalThenExpression).rootNode;
  assert.equal(literalRoot.hasError, false, literalRoot.toString());
  assert.equal(literalRoot.descendantsOfType('literal_content')[0].text, '{$a and $b}');
  assert.deepEqual(literalRoot.descendantsOfType('word_operator').map(node => node.text), ['xor']);
});

test('Smarty engine distinguishes and/or/xor precedence and parenthesized overrides', () => {
  const source = '{if true or false and false}T{else}F{/if}' +
    '{if 1 xor 0 or 1}T{else}F{/if}' +
    '{if (1 xor 0) or 1}T{else}F{/if}' +
    '{if 0 and 0 xor 1}T{else}F{/if}';
  const result = fullEngine(source);
  assert.equal(result.error, null);
  assert.equal(result.result, 'TFTT');
});

test('Malformed right operands retain comments, output, and block closer', () => {
  const source = '{if $a and }{*keep*}{$after}{/if}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.ok(root.descendantsOfType('comment').length, root.toString());
  assert.ok(root.descendantsOfType('output').length, root.toString());
  assert.ok(root.descendantsOfType('if_close_tag').length, root.toString());
});

test('Changing a word operator to a symbolic operator and back matches fresh snapshots', () => {
  const p = parser();
  let source = '{if $a and ($b or $c)}Y{/if}';
  let tree = p.parse(source);
  const start = source.indexOf('and');
  const symbolic = '{if $a && ($b or $c)}Y{/if}';
  tree.edit({startIndex: start, oldEndIndex: start + 3, newEndIndex: start + 2,
    startPosition: {row: 0, column: start}, oldEndPosition: {row: 0, column: start + 3},
    newEndPosition: {row: 0, column: start + 2}});
  tree = p.parse(symbolic, tree);
  assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
  assert.deepEqual(snapshot(tree.rootNode), snapshot(p.parse(symbolic).rootNode));
  const restored = source;
  tree.edit({startIndex: start, oldEndIndex: start + 2, newEndIndex: start + 3,
    startPosition: {row: 0, column: start}, oldEndPosition: {row: 0, column: start + 2},
    newEndPosition: {row: 0, column: start + 3}});
  tree = p.parse(restored, tree);
  assert.deepEqual(snapshot(tree.rootNode), snapshot(p.parse(restored).rootNode));
});

test('Deleting a word operator operand errors and repairs without losing neighbors', () => {
  const p = parser();
  let source = '{$before}{if $a and $b}Y{/if}{$after}';
  let tree = p.parse(source);
  const operand = source.lastIndexOf('$b');
  const broken = source.slice(0, operand) + source.slice(operand + 2);
  tree.edit({startIndex: operand, oldEndIndex: operand + 2, newEndIndex: operand,
    startPosition: {row: 0, column: operand}, oldEndPosition: {row: 0, column: operand + 2},
    newEndPosition: {row: 0, column: operand}});
  tree = p.parse(broken, tree);
  assert.equal(tree.rootNode.hasError, true, tree.rootNode.toString());
  assert.deepEqual(snapshot(tree.rootNode), snapshot(p.parse(broken).rootNode));
  assert.equal(tree.rootNode.descendantsOfType('if_close_tag').length, 1);
  assert.equal(tree.rootNode.descendantsOfType('output').length, 2);
  const repaired = broken.slice(0, operand) + '$b' + broken.slice(operand);
  tree.edit({startIndex: operand, oldEndIndex: operand, newEndIndex: operand + 2,
    startPosition: {row: 0, column: operand}, oldEndPosition: {row: 0, column: operand},
    newEndPosition: {row: 0, column: operand + 2}});
  const final = p.parse(repaired, tree);
  assert.deepEqual(snapshot(final.rootNode), snapshot(p.parse(repaired).rootNode));
});
