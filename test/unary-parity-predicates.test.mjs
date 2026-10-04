import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, observations, parser, reference, fullEngine, snapshot } from './helpers.mjs';

const examples = fixtures('unary-parity-predicates.txt');
assert.equal(examples.length, 12);
for (const { name, source } of examples) test(`Unary parity reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expected = reference(source);
  assert.equal(expected.error, null);
  assert.deepEqual(observations(root), expected.events);
});

function parse(source) {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  return root;
}

function condition(source) {
  return parse(source).descendantsOfType('if_tag')[0].childForFieldName('condition');
}

test('Unary parity predicates keep exact spelling, boundaries, and one-operand fields', () => {
  for (const source of [
    '{if $n is odd}Y{/if}',
    '{if $n is even}Y{/if}',
    '{if $n is not odd}Y{/if}',
    '{if $n is not even}Y{/if}',
    '{if $n  Is   NoT  Odd}Y{/if}',
    '{if $n\tis  not\n even}Y{/if}',
  ]) {
    const predicate = condition(source);
    const operator = predicate.childForFieldName('operator');
    const start = source.toLowerCase().indexOf('is');
    assert.equal(predicate.type, 'single_condition_expression', source);
    assert.equal(operator.type, 'single_condition_operator', source);
    assert.equal(operator.text, source.slice(start, operator.endIndex), source);
    assert.equal(operator.startIndex, start, source);
    assert.equal(operator.endIndex, source.indexOf('}', start), source);
    assert.equal(predicate.childForFieldName('left').type, 'variable', source);
    assert.equal(predicate.childForFieldName('right'), null, source);
    assert.deepEqual(predicate.childrenForFieldName('operator').length, 1);
  }

  const outputSource = '{$n is not even}';
  const output = parse(outputSource).firstNamedChild.childForFieldName('value');
  const operator = output.childForFieldName('operator');
  assert.equal(output.type, 'single_condition_expression');
  assert.equal(operator.startIndex, outputSource.indexOf('is'));
  assert.equal(operator.text, 'is not even');
});

test('Single-condition precedence preserves arithmetic and surrounding expression structure', () => {
  const relational = condition('{if 0 < 2 is odd}Y{/if}');
  assert.equal(relational.type, 'binary_expression');
  assert.equal(relational.childForFieldName('operator').text, '<');
  assert.equal(relational.childForFieldName('right').type, 'single_condition_expression');
  assert.equal(relational.childForFieldName('right').childForFieldName('left').text, '2');

  const parenthesized = condition('{if (0 < 2) is odd}Y{/if}');
  assert.equal(parenthesized.type, 'single_condition_expression');
  assert.equal(parenthesized.childForFieldName('left').type, 'parenthesized_expression');
  assert.equal(parenthesized.childForFieldName('left').namedChildren[0].type, 'binary_expression');

  const arithmetic = condition('{if 4+1 is even}Y{/if}');
  assert.equal(arithmetic.type, 'single_condition_expression');
  assert.equal(arithmetic.childForFieldName('left').type, 'binary_expression');
  assert.equal(arithmetic.childForFieldName('left').childForFieldName('operator').text, '+');

  const following = parse('{$n is even + 1}').firstNamedChild.childForFieldName('value');
  assert.equal(following.type, 'binary_expression');
  assert.equal(following.childForFieldName('left').type, 'single_condition_expression');

  const boolean = condition('{if $a is odd && $b is not even}Y{/if}');
  assert.equal(boolean.type, 'binary_expression');
  assert.equal(boolean.childForFieldName('operator').text, '&&');
  assert.deepEqual(boolean.descendantsOfType('single_condition_operator').map(node => node.text), ['is odd', 'is not even']);

  const grouped = condition('{if ($n is odd) && $flag}Y{/if}');
  assert.equal(grouped.childForFieldName('left').type, 'parenthesized_expression');
  const prefixNot = condition('{if not $n}Y{/if}');
  assert.equal(prefixNot.type, 'unary_expression');
  assert.equal(prefixNot.childForFieldName('operator').type, 'word_operator');

  const modifierSource = '{$x|default:($n is odd)}';
  const modifierRoot = parse(modifierSource);
  const argument = modifierRoot.firstNamedChild.childForFieldName('value').childForFieldName('argument');
  assert.equal(argument.type, 'parenthesized_expression');
  assert.equal(argument.namedChildren[0].type, 'single_condition_expression');
  assert.deepEqual(observations(modifierRoot), reference(modifierSource).events);
});

test('Grouping predicates and divisibility remain binary operators', () => {
  for (const [source, operatorType, text] of [
    ['{if $n is odd by 2}Y{/if}', 'parity_by_operator', 'is odd by'],
    ['{if $n is not even by 2}Y{/if}', 'parity_by_operator', 'is not even by'],
    ['{if $n is div by 2}Y{/if}', 'div_by_operator', 'is div by'],
  ]) {
    const predicate = condition(source);
    assert.equal(predicate.type, 'binary_expression', source);
    assert.equal(predicate.childForFieldName('operator').type, operatorType, source);
    assert.equal(predicate.childForFieldName('operator').text, text, source);
    assert.equal(predicate.childForFieldName('right').type, 'number', source);
  }
  const generic = parse('{widget flag=is}');
  assert.equal(generic.firstNamedChild.type, 'custom_tag');
  assert.equal(generic.firstNamedChild.childForFieldName('name').text, 'widget');
  assert.equal(generic.firstNamedChild.descendantsOfType('attribute')[0].childForFieldName('value').text, 'is');
  assert.equal(generic.firstNamedChild.descendantsOfType('single_condition_operator').length, 0);
});

test('Compiler boundary observations distinguish rejected predicate suffixes from extra arguments', () => {
  for (const source of ['{if 3 is oddness}T{/if}']) {
    assert.ok(reference(source).error, source);
    assert.ok(fullEngine(source).error, source);
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
  }
  for (const source of ['{if 3 isodd}T{/if}', '{if 3 is notodd}T{/if}', '{if 3 is }T{/if}', '{if 3 is not}T{/if}']) {
    assert.equal(reference(source).error, null, source);
    assert.equal(fullEngine(source).error, null, source);
  }
  assert.ok(reference('{if 3 is not }T{/if}').error);
  assert.ok(fullEngine('{if 3 is not }T{/if}').error);
});

test('Full Smarty confirms unary parity truth, case, whitespace, output and modifier contexts', () => {
  for (const [expression, expected] of [
    ['3 is odd', 'T'], ['3 is even', 'F'],
    ['3 is not odd', 'F'], ['3 is not even', 'T'],
    ['3  Is   NoT  Odd', 'F'], ['0 < 2 is odd', 'F'], ['(0 < 2) is odd', 'T'],
    ['4 + 1 is even', 'F'],
  ]) {
    const result = fullEngine(`{if ${expression}}T{else}F{/if}`);
    assert.equal(result.error, null, expression);
    assert.equal(result.result, expected, expression);
  }
  assert.equal(fullEngine('{$n is even + 1}', {values: {n: 4}}).result, '2');
  assert.equal(fullEngine('{$n is not even}', {values: {n: 3}}).result, '1');
  assert.equal(fullEngine('{$x|default:($n is odd)}', {values: {x: '', n: 3}}).result, '1');
  assert.equal(fullEngine('{if\t3 is odd}T{else}F{/if}').result, 'T');
  for (const source of ['{if 3\tis odd}T{/if}', '{if 3 is\todd}T{/if}']) {
    // The pinned SINGLECOND lexer accepts these separators, but its semantic
    // mapping strips ordinary spaces only and emits invalid generated PHP.
    assert.equal(reference(source).error, null, source);
    assert.ok(fullEngine(source).error, source);
    assert.equal(parser().parse(source).rootNode.hasError, false, source);
  }
});

test('Malformed parity recovery keeps the closer and tail; incremental edits match a fresh parse', () => {
  const malformed = 'before {if $n is odd && }Y{/if} after {$tail}';
  const broken = parser().parse(malformed).rootNode;
  assert.equal(broken.hasError, true, broken.toString());
  assert.equal(broken.namedChildren[0].text, 'before ');
  assert.ok(broken.descendantsOfType('if_close_tag').length);
  assert.ok(broken.descendantsOfType('output').some(node => node.text === '{$tail}'));
  assert.equal(broken.namedChildren.at(-2).text, ' after ');
  assert.equal(broken.namedChildren.at(-1).text, '{$tail}');

  const p = parser();
  let source = 'before {if $n is odd}Y{/if} after';
  let tree = p.parse(source);
  for (const [oldText, newText, hasError] of [['odd', 'oddness', true], ['oddness', 'odd', false], ['odd', 'not even', false], ['not even', 'not odd', false]]) {
    const start = source.indexOf(oldText, source.indexOf('is'));
    const next = source.slice(0, start) + newText + source.slice(start + oldText.length);
    tree.edit({
      startIndex: start, oldEndIndex: start + oldText.length, newEndIndex: start + newText.length,
      startPosition: {row: 0, column: start}, oldEndPosition: {row: 0, column: start + oldText.length},
      newEndPosition: {row: 0, column: start + newText.length},
    });
    tree = p.parse(next, tree);
    assert.equal(tree.rootNode.hasError, hasError, tree.rootNode.toString());
    assert.equal(tree.rootNode.namedChildren[0].text, 'before ');
    assert.ok(tree.rootNode.namedChildren.some(node => node.text.includes('after')));
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode));
    source = next;
  }
});
