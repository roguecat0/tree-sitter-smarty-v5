import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, observations, parser, reference, fullEngine, snapshot } from './helpers.mjs';

const examples = fixtures('condition-operators.txt');
assert.equal(examples.length, 24);
for (const {name, source} of examples) test(`Operator reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expected = reference(source);
  assert.equal(expected.error, null);
  if (name === 'Operators in unknown tags and modifier arguments') {
    // Keep operator/attribute/comment recovery coverage in true generic-tag
    // context; the parenthesized function-output form has separate coverage.
    assert.deepEqual(expected.events, [
      {kind: 'modifier', name: 'decorate', arguments: 1},
      {kind: 'tag', name: 'widget', arguments: [
        {name: null}, {name: 'enabled'}, {name: 'value'},
      ]},
      {kind: 'tag', name: 'otherclose', arguments: []},
    ]);
    assert.equal(root.firstNamedChild.type, 'custom_tag');
    assert.equal(root.firstNamedChild.childForFieldName('argument').type, 'binary_expression');
  } else {
    assert.deepEqual(observations(root), expected.events);
  }
});

test('Full Smarty distinguishes every new adjacent precedence boundary', () => {
  for (const [expression, expected] of [
    ['1 || 0 && 0', '1'], ['0 && 1 == 0', ''], ['0 == 2 < 3', ''],
    ['1 + 2 < 4', '1'], ['1 + 2 * 3', '7'], ['!2 * 0', '0'],
    ['-2|strlen', '-1'], ['(-2)|strlen', '2'], ['!0|strlen', ''],
    ['(1 || 0) && 0', ''], ['(0 == 2) < 3', '1'],
    ['-2 * +3', '-6'], ['! ! 2', '1'],
  ]) {
    const result = fullEngine(`{${expression}}`);
    assert.equal(result.error, null, expression);
    assert.equal(result.result, expected, expression);
    assert.equal(parser().parse(`{${expression}}`).rootNode.hasError, false, expression);
  }
  const result = fullEngine('{$item->price|strlen}', {objects: {item: {price: 22}}});
  assert.equal(result.error, null);
  assert.equal(result.result, '2');
});

test('Full-engine helper separates controlled success, compiler errors and PHP errors', () => {
  assert.equal(fullEngine('{$x + 1}', {values: {x: 2}}).result, '3');
  assert.equal(fullEngine('{if}').error.type, 'Smarty\\CompilerException');
  for (const source of ['{2 < 3 < 4}', '{1 == 1 == 1}']) {
    assert.equal(reference(source).error, null);
    assert.equal(fullEngine(source).error.type, 'ParseError');
    assert.equal(parser().parse(source).rootNode.hasError, true);
  }
  assert.throws(() => fullEngine('text', {mode: 'invalid'}), /Command failed/);
});

test('Operator fields retain exact spelling and ranges across whitespace', () => {
  for (const op of ['==','!=','===','!==','<','<=','>','>=','&&','||']) {
    for (const gap of ['', ' ', '\n', '\r\n']) {
      const source = `{$a${gap}${op}${gap}$b}`;
      const root = parser().parse(source).rootNode;
      assert.equal(root.hasError, false, source);
      assert.equal(reference(source).error, null);
      const operator = root.firstNamedChild.childForFieldName('value').childForFieldName('operator');
      assert.equal(operator.text, op);
      assert.equal(operator.startIndex, 3 + gap.length);
      assert.equal(operator.endIndex, 3 + gap.length + op.length);
    }
  }
  const unary = parser().parse('{-2}').rootNode.firstNamedChild.childForFieldName('value');
  assert.equal(unary.type, 'unary_expression');
  assert.equal(unary.childForFieldName('operator').text, '-');
  assert.equal(unary.childForFieldName('argument').type, 'number');
});

test('Dangling operands and nonassociative chains cannot be swallowed', () => {
  for (const source of ['{$a &&}', '{!}', '{$a >=}', '{$a < $b < $c}', '{$a == $b != $c}', '{$a <= $b >= $c}']) {
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
  }
  for (const source of ['{$a &&}', '{!}', '{$a >=}']) assert.ok(reference(source).error);
});

test('Condition operand deletion and restoration match fresh trees', () => {
  const p = parser();
  let source = '{$before}{if $a}{if $b && $c}Y{/if}{/if}';
  let tree = p.parse(source);
  const startIndex = source.indexOf('$c');
  for (const [before, after, error] of [['$c', '', true], ['', '$c', false]]) {
    const next = source.slice(0,startIndex) + after + source.slice(startIndex + before.length);
    tree.edit({startIndex, oldEndIndex: startIndex + before.length, newEndIndex: startIndex + after.length,
      startPosition: {row:0,column:startIndex}, oldEndPosition:{row:0,column:startIndex+before.length}, newEndPosition:{row:0,column:startIndex+after.length}});
    tree = p.parse(next,tree);
    assert.equal(tree.rootNode.hasError,error);
    assert.equal(tree.rootNode.firstNamedChild.text,'{$before}');
    assert.deepEqual(snapshot(tree.rootNode),snapshot(parser().parse(next).rootNode));
    source = next;
  }
});

test('Adjacent sign pairs stay outside the unary subset', () => {
  for (const source of ['{++$a}', '{--$a}', '{+-$a}', '{-+$a}']) {
    assert.equal(reference(source).error, null);
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
  }
  for (const source of ['{+ +$a}', '{- -$a}', '{-!$a}', '{!!$a}']) {
    assert.equal(reference(source).error, null);
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, source);
    assert.equal(root.firstNamedChild.childForFieldName('value').childForFieldName('argument').type, 'unary_expression');
  }
});
