import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('word-comparison-operators.txt');
assert.equal(examples.length, 4);
for (const { name, source } of examples) test(`Word comparison tree and reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expected = reference(source);
  assert.equal(expected.error, null, name);
  assert.deepEqual(observations(root), expected.events);
});

test('Comparison aliases retain exact case, token ranges, and supported whitespace boundaries', () => {
  const spellings = ['eq', 'NE', 'nEq', 'gt', 'Ge', 'GTE', 'lt', 'LE', 'lte'];
  for (const gap of [' ', '\t', '\r\n', '   ']) {
    const source = spellings.map(word => `{$a${gap}${word}${gap}$b}`).join('');
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const operators = root.descendantsOfType('word_operator');
    assert.deepEqual(operators.map(node => node.text), spellings);
    let searchFrom = 0;
    const expectedRanges = spellings.map(word => {
      const start = source.indexOf(word, searchFrom);
      searchFrom = start + word.length;
      return [start, start + word.length];
    });
    assert.deepEqual(operators.map(node => [node.startIndex, node.endIndex]), expectedRanges);
    assert.equal(reference(source).error, null, source);
  }
});

test('Comparison aliases bind at the symbolic equality and relational levels', () => {
  const cases = [
    { source: '{$a eq $b gt $c}', outer: 'eq', inner: 'gt', outerField: 'right' },
    { source: '{$a == $b lte $c}', outer: '==', inner: 'lte', outerField: 'right' },
    { source: '{$a gt $b eq $c}', outer: 'eq', inner: 'gt', outerField: 'left' },
    { source: '{$a eq $b and $c}', outer: 'and', inner: 'eq', outerField: 'left' },
    { source: '{$a eq $b or $c}', outer: 'or', inner: 'eq', outerField: 'left' },
    { source: '{$a eq $b xor $c}', outer: 'xor', inner: 'eq', outerField: 'left' },
    { source: '{$a eq $b && $c}', outer: '&&', inner: 'eq', outerField: 'left' },
    { source: '{$a eq $b || $c}', outer: '||', inner: 'eq', outerField: 'left' },
  ];
  for (const { source, outer, inner, outerField } of cases) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const expression = root.descendantsOfType('binary_expression')[0];
    const nested = expression.childForFieldName(outerField);
    assert.equal(expression.childForFieldName('operator').text, outer);
    assert.equal(nested.type, 'binary_expression');
    assert.equal(nested.childForFieldName('operator').text, inner);
  }
  const grouped = parser().parse('{$a eq ($b gt $c)}').rootNode;
  assert.equal(grouped.hasError, false, grouped.toString());
  const groupedRight = grouped.descendantsOfType('binary_expression')[0].childForFieldName('right');
  assert.equal(groupedRight.type, 'parenthesized_expression');
  assert.equal(groupedRight.descendantsOfType('binary_expression')[0].childForFieldName('operator').text, 'gt');
  for (const source of ['{$a eq $b eq $c}', '{$a gt $b ge $c}'])
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
});

test('Aliases preserve identifiers, calls, variables, strings, comments, and no-gap expressions', () => {
  const source = '{eq}{$neq}{gt($value)}{"eq ne neq gt ge gte lt le lte"}' +
    '{* eq ne neq gt ge gte lt le lte *}{$a\r\neq\r\n$b}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  assert.deepEqual(root.descendantsOfType('word_operator').map(node => node.text), ['eq']);
  for (const source of ['{if 0eq1}Y{/if}', '{if 0 eq1}Y{/if}', '{if 0eq 1}Y{/if}']) {
    const noGapRoot = parser().parse(source).rootNode;
    assert.equal(noGapRoot.descendantsOfType('word_operator').length, 0, source);
    assert.equal(reference(source).error, null, source);
  }
  for (const [source, expected] of [
    ['{if 0eq1}Y{else}N{/if}', 'Y'],
    ['{if 0 eq1}Y{else}N{/if}', 'N'],
    ['{if 0eq 1}Y{else}N{/if}', 'Y'],
  ]) {
    const result = fullEngine(source);
    assert.equal(result.error, null, source);
    assert.equal(result.result, expected, source);
  }
  assert.equal(reference(source).error, null);
});

test('Full Smarty probes map all aliases and preserve comparison precedence', () => {
  const cases = [
    ['1 eq 1', 'T'], ['1 eq 2', 'F'], ['1 ne 2', 'T'], ['1 ne 1', 'F'],
    ['1 neq 2', 'T'], ['1 neq 1', 'F'], ['2 gt 1', 'T'], ['1 gt 2', 'F'],
    ['2 ge 2', 'T'], ['1 ge 2', 'F'], ['2 gte 2', 'T'], ['1 gte 2', 'F'],
    ['1 lt 2', 'T'], ['2 lt 1', 'F'], ['2 le 2', 'T'], ['2 le 1', 'F'],
    ['2 lte 2', 'T'], ['2 lte 1', 'F'], ['1 EQ 1', 'T'],
    ['1 eq 2 gt 1', 'T'], ['2 eq 1 and 1', 'F'], ['2 eq 1 or 0', 'F'],
    ['2 eq 1 xor 1', 'T'], ['8 is div by 2 eq 0', 'F'], ['8 is div by 3 eq 0', 'T'],
  ];
  for (const [expression, expected] of cases) {
    const result = fullEngine(`{if ${expression}}T{else}F{/if}`);
    assert.equal(result.error, null, expression);
    assert.equal(result.result, expected, expression);
  }
});

test('Malformed comparison RHS retains later siblings and the if closer', () => {
  const source = '{if $left neq }{*keep*}{$after}{widget value=$item}{/if}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  const block = root.descendantsOfType('if_block')[0];
  assert.ok(block, root.toString());
  const children = block.namedChildren;
  const ifTag = block.descendantsOfType('if_tag')[0];
  assert.deepEqual(children.map(node => node.type), ['if_tag', 'comment', 'output', 'custom_tag', 'if_close_tag']);
  assert.deepEqual(ifTag.namedChildren.map(node => node.type), ['variable', 'ERROR']);
  const condition = ifTag.childForFieldName('condition');
  assert.equal(condition.type, 'variable', root.toString());
  assert.equal(condition.childForFieldName('right'), null);
  const errorSibling = ifTag.namedChildren.find(node => node.type === 'ERROR');
  assert.ok(errorSibling, root.toString());
  assert.deepEqual(errorSibling.namedChildren.map(node => node.type), ['word_operator']);
  assert.equal(errorSibling.namedChildren[0].type, 'word_operator');
  assert.equal(errorSibling.namedChildren[0]?.text, 'neq');
  assert.deepEqual([errorSibling.namedChildren[0].startIndex, errorSibling.namedChildren[0].endIndex],
    [source.indexOf('neq'), source.indexOf('neq') + 3]);
  assert.equal(block.descendantsOfType('comment')[0].text, '{*keep*}');
  assert.equal(block.descendantsOfType('output')[0].text, '{$after}');
  assert.equal(block.descendantsOfType('custom_tag')[0].childForFieldName('name').text, 'widget');
  assert.equal(block.descendantsOfType('if_close_tag')[0].text, '{/if}');
});

test('Incremental comparison edits and malformed recovery match fresh parses', () => {
  const p = parser();
  let source = '{$before}{if $ready}{if $left neq $right}Y{/if}{/if}{$after}';
  let tree = p.parse(source);
  const edit = (next, start, oldLength, newLength) => {
    const point = { row: 0, column: start };
    tree.edit({ startIndex: start, oldEndIndex: start + oldLength, newEndIndex: start + newLength,
      startPosition: point, oldEndPosition: { row: 0, column: start + oldLength },
      newEndPosition: { row: 0, column: start + newLength } });
    tree = p.parse(next, tree);
    assert.deepEqual(snapshot(tree.rootNode), snapshot(p.parse(next).rootNode));
    source = next;
  };
  const op = source.indexOf('neq');
  edit(source.slice(0, op) + '==' + source.slice(op + 3), op, 3, 2);
  edit(source.slice(0, op) + 'neq' + source.slice(op + 2), op, 2, 3);
  const conditionStart = source.indexOf('$left neq $right');
  const validCondition = '$left neq $right';
  const brokenCondition = '$left neq ';
  edit(source.slice(0, conditionStart) + brokenCondition + source.slice(conditionStart + validCondition.length),
    conditionStart, validCondition.length, brokenCondition.length);
  assert.equal(tree.rootNode.hasError, true, tree.rootNode.toString());
  for (const text of ['{$before}', '{/if}', '{$after}']) assert.ok(source.includes(text));
  for (const type of ['output', 'if_close_tag']) assert.ok(tree.rootNode.descendantsOfType(type).length >= (type === 'output' ? 2 : 2));
  const repairAt = conditionStart + brokenCondition.length;
  const repaired = source.slice(0, repairAt) + '$right' + source.slice(repairAt);
  edit(repaired, repairAt, 0, 6);
  assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
});
