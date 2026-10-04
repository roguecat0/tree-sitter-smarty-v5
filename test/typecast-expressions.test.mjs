import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const trees = fixtures('typecast-expressions.txt');
const validTrees = trees.filter(({ name }) =>
  !name.includes('Missing cast operand') && !name.includes('Invalid cast spelling'));
for (const { name, source } of validTrees) test(`Typecast tree and Smarty reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  assert.equal(reference(source).error, null, name);
});

test('All pinned cast spellings parse in case-insensitive Smarty spelling and remain visible', () => {
  const spellings = ['int', 'integer', 'bool', 'boolean', 'float', 'double', 'real', 'string', 'binary', 'array', 'object'];
  const source = spellings.map((spelling, i) => `{(${i % 2 ? spelling.toUpperCase() : spelling}) $x}`).join('');
  assert.equal(reference(source).error, null);
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const casts = root.descendantsOfType('typecast_expression');
  const operators = root.descendantsOfType('typecast_operator');
  assert.equal(casts.length, spellings.length, root.toString());
  assert.deepEqual(operators.map(node => node.text), spellings.map((spelling, i) => `(${i % 2 ? spelling.toUpperCase() : spelling})`));
  assert.deepEqual(casts.map(node => node.childForFieldName('argument').text), Array(spellings.length).fill('$x'));
});

test('Cast spelling, operator range, operand range and ownership match source bytes', () => {
  const cases = [
    ['{(int) $x}', '(int)', '$x'],
    ['{(INT)$x}', '(INT)', '$x'],
    ['{(InT) $x}', '(InT)', '$x'],
    ['{(int)   -$x + 1}', '(int)', '-$x'],
    ['{(int) ($x + 1)}', '(int)', '($x + 1)'],
  ];
  for (const [source, spelling, operand] of cases) {
    assert.equal(reference(source).error, null, source);
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const cast = root.descendantsOfType('typecast_expression')[0];
    const operator = cast.childForFieldName('operator');
    const argument = cast.childForFieldName('argument');
    const spellingStart = source.indexOf(spelling);
    const operandStart = source.indexOf(operand, spellingStart + spelling.length);
    assert.equal(operator.text, spelling);
    assert.deepEqual([operator.startIndex, operator.endIndex], [spellingStart, spellingStart + spelling.length]);
    assert.equal(argument.text, operand);
    assert.deepEqual([argument.startIndex, argument.endIndex], [operandStart, operandStart + operand.length]);
    assert.equal(source.slice(operator.endIndex, argument.startIndex), source.slice(spellingStart + spelling.length, operandStart));
  }
});

test('Smarty cast operand boundary is distinct from neighboring arithmetic and parentheses', () => {
  const cases = [
    {source: '{(int) -$x + 0.5}', values: {x: '1.8'}, result: '-0.5'},
    {source: '{(int) (-$x + 0.5)}', values: {x: '1.8'}, result: '-1'},
    {source: '{(int) $x + 1}', values: {x: '2'}, result: '3'},
  ];
  for (const item of cases) {
    const result = fullEngine(item.source, {values: item.values});
    assert.equal(result.error, null, `${item.source}: ${JSON.stringify(result.error)}`);
    assert.equal(result.result, item.result, item.source);
  }
  const root = parser().parse('{(int) -$x + 0.5}').rootNode;
  const expression = root.descendantsOfType('binary_expression')[0];
  assert.equal(expression.childForFieldName('left').type, 'typecast_expression', expression.toString());
  assert.equal(expression.childForFieldName('left').childForFieldName('argument').type, 'unary_expression');
  assert.equal(expression.childForFieldName('right').text, '0.5');
});

test('Array literal, ordinary parentheses, and malformed casts remain distinguishable', () => {
  const literal = parser().parse('{array(1)}').rootNode;
  assert.equal(literal.hasError, false, literal.toString());
  assert.equal(literal.descendantsOfType('typecast_expression').length, 0);
  assert.equal(literal.descendantsOfType('array_literal').length, 1);
  const parenthesized = parser().parse('{(foo)}').rootNode;
  assert.equal(parenthesized.hasError, false, parenthesized.toString());
  assert.equal(parenthesized.firstNamedChild.childForFieldName('value').type, 'parenthesized_expression');
  assert.equal(parenthesized.descendantsOfType('typecast_expression').length, 0);
  assert.equal(reference('{(foo)}').error, null);

  for (const source of ['{array((int)=>"v")}{$after}', '{array((foo) $x)}{$after}']) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, true, root.toString());
    assert.ok(reference(source).error, source);
    assert.ok(fullEngine(source, {mode: 'compile'}).error, source);
    const after = root.namedChildren.at(-1);
    assert.equal(after.type, 'output', root.toString());
    assert.equal(after.hasError, false, after.toString());
    assert.equal(after.childForFieldName('value').text, '$after');
  }
  const missingSource = '{array((int)=>"v")}{$after}';
  const missingRoot = parser().parse(missingSource).rootNode;
  const localizedError = missingRoot.descendantsOfType('ERROR')[0];
  assert.ok(localizedError, missingRoot.toString());
  assert.deepEqual([localizedError.startIndex, localizedError.endIndex], [0, missingSource.indexOf('"v"')]);
  assert.equal(missingRoot.namedChildren.at(-1).text, '{$after}');
  assert.equal(missingRoot.namedChildren.at(-1).hasError, false);
  assert.equal(fullEngine('{assign var=x value=(int) $x}', {mode: 'compile', values: {x: '2'}}).error, null);
});

test('Cast edits, missing-operand recovery and neighboring syntax match fresh parses', () => {
  const p = parser();
  let source = '{widget before=$before value=(int) $x after=$after}{$tail}';
  let tree = p.parse(source);
  const edits = [
    ['(int)', '(string)', false],
    ['$x', '', true],
    ['', '$x', false],
    ['(string)', '(int)', false],
  ];
  for (const [before, after, hasError] of edits) {
    const startIndex = before
      ? source.indexOf(before, source.indexOf('value='))
      : source.indexOf('(string)', source.indexOf('value=')) + '(string) '.length;
    const next = source.slice(0, startIndex) + after + source.slice(startIndex + before.length);
    tree.edit({
      startIndex, oldEndIndex: startIndex + before.length, newEndIndex: startIndex + after.length,
      startPosition: {row: 0, column: startIndex}, oldEndPosition: {row: 0, column: startIndex + before.length},
      newEndPosition: {row: 0, column: startIndex + after.length},
    });
    tree = p.parse(next, tree);
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode));
    assert.equal(tree.rootNode.hasError, hasError, tree.rootNode.toString());
    assert.equal(tree.rootNode.namedChildren.at(-1).text, '{$tail}');
    source = next;
  }
});

test('Unknown tag casts retain the single expected argument and attribute fields', () => {
  for (const { name, source } of validTrees.filter(({name}) => name.startsWith('Generic'))) {
    const root = parser().parse(source).rootNode;
    assert.deepEqual(observations(root), reference(source).events, name);
    const tag = root.firstNamedChild;
    if (name.includes('positional')) {
      assert.equal(tag.childrenForFieldName('argument').length, 1, tag.toString());
      assert.equal(tag.childForFieldName('argument').type, 'binary_expression');
      assert.equal(tag.childForFieldName('argument').childForFieldName('right').type, 'typecast_expression');
    } else {
      assert.equal(tag.childrenForFieldName('argument').length, 0, tag.toString());
      const attribute = tag.namedChildren.find(node => node.type === 'attribute');
      assert.equal(attribute?.childForFieldName('value')?.type, 'typecast_expression', tag.toString());
    }
  }
});
