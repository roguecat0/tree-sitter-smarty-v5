import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, observations, parser, reference, fullEngine, snapshot } from './helpers.mjs';

const examples = fixtures('parity-grouping-predicates.txt');
assert.equal(examples.length, 4);
for (const { name, source } of examples) test(`Parity predicate reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expected = reference(source);
  assert.equal(expected.error, null);
  assert.deepEqual(observations(root), expected.events);
});

function condition(source) {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  return root.descendantsOfType('if_tag')[0].childForFieldName('condition');
}

test('Parity operators retain exact spelling, range, fields, and operands', () => {
  for (const [phrase, source] of [
    ['is odd by', '{if $smarty.section.outer.index is odd by 2}Y{/if}'],
    ['is even by', '{if $n is even by 2}Y{/if}'],
    ['is not odd by', '{if $n is not odd by 2}Y{/if}'],
    ['is not even by', '{if $n is not even by 2}Y{/if}'],
    ['Is Odd By', '{if $n Is Odd By 2}Y{/if}'],
    ['is  not\n even   by', '{if $n is  not\n even   by 2}Y{/if}'],
  ]) {
    const predicate = condition(source);
    const operator = predicate.childForFieldName('operator');
    const start = source.toLowerCase().indexOf('is');
    assert.equal(predicate.type, 'binary_expression');
    assert.equal(operator.type, 'parity_by_operator');
    assert.equal(operator.text, source.slice(start, operator.endIndex));
    assert.equal(operator.text.replace(/\s+/g, ' ').toLowerCase(), phrase.replace(/\s+/g, ' ').toLowerCase());
    assert.equal(operator.startIndex, start);
    assert.equal(predicate.childForFieldName('left').type,
      source.includes('smarty.section') ? 'section_property_expression' : 'variable');
    assert.equal(predicate.childForFieldName('right').type, 'number');
  }
});

test('Parity grouping composes with existing precedence and div-by stays unchanged', () => {
  const relational = condition('{if 0 < 4 is odd by 2}Y{/if}');
  assert.equal(relational.childForFieldName('operator').text, '<');
  assert.equal(relational.childForFieldName('right').childForFieldName('operator').type, 'parity_by_operator');
  const grouped = condition('{if (0 < 4) is even by 2}Y{/if}');
  assert.equal(grouped.childForFieldName('operator').type, 'parity_by_operator');
  assert.equal(grouped.childForFieldName('left').type, 'parenthesized_expression');
  const arithmetic = condition('{if 4 + 2 is odd by 3}Y{/if}');
  assert.equal(arithmetic.childForFieldName('left').childForFieldName('operator').text, '+');
  const rhsArithmetic = condition('{if 4 is odd by 2 + 1}Y{/if}');
  assert.equal(rhsArithmetic.childForFieldName('operator').text, '+');
  assert.equal(rhsArithmetic.childForFieldName('left').childForFieldName('operator').type, 'parity_by_operator');
  const unary = condition('{if 4 is odd by -2}Y{/if}');
  assert.equal(unary.childForFieldName('right').type, 'unary_expression');
  const composed = condition('{if ($a is odd by 2) && ($b is not even by 2) || $flag}Y{/if}');
  assert.equal(composed.childForFieldName('operator').text, '||');
  assert.equal(composed.childForFieldName('left').childForFieldName('operator').text, '&&');
  assert.equal(composed.descendantsOfType('parity_by_operator').length, 2);

  const divSource = '{$n is div by 2}';
  const divRoot = parser().parse(divSource).rootNode;
  assert.equal(divRoot.hasError, false, divRoot.toString());
  const div = divRoot.firstNamedChild.childForFieldName('value');
  const divOperator = div.childForFieldName('operator');
  assert.equal(div.type, 'binary_expression');
  assert.equal(divOperator.type, 'div_by_operator');
  assert.equal(divOperator.text, 'is div by');
  assert.equal(divOperator.startIndex, divSource.indexOf('is'));
  assert.equal(divOperator.endIndex, divSource.indexOf('by') + 2);
  assert.equal(div.childForFieldName('left').type, 'variable');
  assert.equal(div.childForFieldName('right').type, 'number');
});

test('Smarty rejects joined parity word boundaries but accepts by2', () => {
  for (const source of ['{if 5 is oddby 2}T{/if}', '{if 5 is not oddby 2}T{/if}']) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, true, source);
    assert.ok(reference(source).error);
    assert.ok(fullEngine(source).error);
  }
  const compact = parser().parse('{if 5 is odd by2}T{/if}').rootNode;
  assert.equal(compact.hasError, false, compact.toString());
  assert.equal(reference('{if 5 is odd by2}T{/if}').error, null);
  assert.equal(fullEngine('{if 5 is odd by2}T{/if}').error, null);
});

test('Full Smarty verifies even, odd, and negated grouping outcomes', () => {
  for (const [expression, expected] of [
    ['5 is odd by 2', 'F'], ['5 is even by 2', 'T'],
    ['5 is not odd by 2', 'T'], ['5 is not even by 2', 'F'],
  ]) {
    const result = fullEngine(`{if ${expression}}T{else}F{/if}`);
    assert.equal(result.error, null, expression);
    assert.equal(result.result, expected, expression);
  }
});

test('Malformed parity value recovery preserves closer and tail; edits repair boundaries', () => {
  const malformed = 'before {if $n is odd by }Y{/if} after {$tail}';
  const broken = parser().parse(malformed).rootNode;
  assert.equal(broken.hasError, true, broken.toString());
  assert.equal(broken.namedChildren[0].text, 'before ');
  assert.ok(broken.descendantsOfType('if_close_tag').length);
  assert.ok(broken.descendantsOfType('output').some(node => node.text === '{$tail}'));
  assert.equal(broken.namedChildren.at(-2).text, ' after ');
  assert.equal(broken.namedChildren.at(-1).text, '{$tail}');

  const p = parser();
  let source = 'before {if $n is odd by 2}Y{/if} after';
  let tree = p.parse(source);
  const apply = (start, oldText, newText, hasError) => {
    const next = source.slice(0, start) + newText + source.slice(start + oldText.length);
    tree.edit({
      startIndex: start, oldEndIndex: start + oldText.length, newEndIndex: start + newText.length,
      startPosition: { row: 0, column: start },
      oldEndPosition: { row: 0, column: start + oldText.length },
      newEndPosition: { row: 0, column: start + newText.length },
    });
    tree = p.parse(next, tree);
    assert.equal(tree.rootNode.hasError, hasError, tree.rootNode.toString());
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode));
    source = next;
  };
  const valueStart = source.indexOf('2}');
  apply(valueStart, '2', '', true);
  apply(valueStart, '', '2', false);
  const boundary = source.indexOf('odd by') + 3;
  apply(boundary, ' by', 'by ', true);
  apply(boundary, 'by ', ' by', false);
});
