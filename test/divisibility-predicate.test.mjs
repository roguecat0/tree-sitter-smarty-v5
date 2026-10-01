import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, observations, parser, reference, fullEngine, snapshot } from './helpers.mjs';

const examples = fixtures('divisibility-predicate.txt');
assert.equal(examples.length, 9);
for (const { name, source } of examples) test(`Divisibility reference: ${name}`, () => {
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

test('Predicate nodes keep exact spelling, ranges, fields, and operands', () => {
  for (const source of [
    '{if $item@index is div by 2}Y{/if}',
    '{if count($rows) is  div\nby 2}Y{/if}',
  ]) {
    const predicate = condition(source);
    const operator = predicate.childForFieldName('operator');
    const start = source.indexOf('is');
    assert.equal(predicate.type, 'binary_expression');
    assert.equal(operator.type, 'div_by_operator');
    assert.equal(operator.text, source.slice(start, operator.endIndex));
    assert.equal(operator.text.replace(/\s+/g, ' '), 'is div by');
    assert.equal(operator.startIndex, start);
    assert.equal(source.slice(operator.startIndex, operator.endIndex).replace(/\s+/g, ' '), 'is div by');
    assert.equal(predicate.childForFieldName('left').type,
      source.includes('count(') ? 'function_call_expression' : 'loop_metadata_expression');
    assert.equal(predicate.childForFieldName('right').type, 'number');
  }
});

test('Shared expression operator composes in output and parenthesized modifier argument', () => {
  const outputSource = '{$n is div by 2}';
  const outputRoot = parser().parse(outputSource).rootNode;
  assert.equal(outputRoot.hasError, false, outputRoot.toString());
  const output = outputRoot.firstNamedChild;
  const predicate = output.childForFieldName('value');
  const operator = predicate.childForFieldName('operator');
  const outputStart = outputSource.indexOf('is');
  assert.equal(predicate.type, 'binary_expression');
  assert.equal(operator.type, 'div_by_operator');
  assert.equal(operator.text.replace(/\s+/g, ' '), 'is div by');
  assert.equal(operator.startIndex, outputStart);
  assert.equal(operator.endIndex, outputSource.indexOf('by') + 2);
  assert.equal(predicate.childForFieldName('left').type, 'variable');
  assert.equal(predicate.childForFieldName('right').type, 'number');
  assert.deepEqual(observations(outputRoot), reference(outputSource).events);

  const modifierSource = '{$x|default:($n is div by 2)}';
  const modifierRoot = parser().parse(modifierSource).rootNode;
  assert.equal(modifierRoot.hasError, false, modifierRoot.toString());
  const modifier = modifierRoot.firstNamedChild.childForFieldName('value');
  const argument = modifier.childForFieldName('argument');
  assert.equal(modifier.type, 'modifier_expression');
  assert.equal(argument.type, 'parenthesized_expression');
  const inner = argument.namedChildren[0];
  assert.equal(inner.type, 'binary_expression');
  assert.equal(inner.childForFieldName('operator').text.replace(/\s+/g, ' '), 'is div by');
  assert.deepEqual(observations(modifierRoot), reference(modifierSource).events);
});

test('Smarty precedence shape keeps word predicate inside a relational RHS', () => {
  const source = '{if 0 < 4 is div by 2}T{/if}';
  const outer = condition(source);
  assert.equal(outer.childForFieldName('operator').text, '<');
  const predicate = outer.childForFieldName('right');
  assert.equal(predicate.childForFieldName('operator').text, 'is div by');
  assert.equal(predicate.childForFieldName('left').text, '4');

  const grouped = condition('{if (0 < 4) is div by 2}T{/if}');
  assert.equal(grouped.childForFieldName('operator').text, 'is div by');
  assert.equal(grouped.childForFieldName('left').type, 'parenthesized_expression');
  assert.equal(grouped.childForFieldName('left').namedChildren[0].childForFieldName('operator').text, '<');
});

test('Arithmetic before and after the predicate retains grammar grouping', () => {
  const before = condition('{if 4 + 2 is div by 3}F{/if}');
  assert.equal(before.childForFieldName('operator').text, 'is div by');
  assert.equal(before.childForFieldName('left').childForFieldName('operator').text, '+');
  const after = condition('{if 4 is div by 2 + 1}T{/if}');
  assert.equal(after.childForFieldName('operator').text, '+');
  assert.equal(after.childForFieldName('left').childForFieldName('operator').text, 'is div by');
  const grouped = condition('{if 4 is div by (2 + 1)}F{/if}');
  assert.equal(grouped.childForFieldName('operator').text, 'is div by');
  assert.equal(grouped.childForFieldName('right').type, 'parenthesized_expression');
  assert.equal(grouped.childForFieldName('right').namedChildren[0].childForFieldName('operator').text, '+');
});

test('Unary RHS and boolean composition retain exact operator structure', () => {
  const unary = condition('{if 4 is div by -2}T{/if}');
  const right = unary.childForFieldName('right');
  assert.equal(unary.childForFieldName('operator').text, 'is div by');
  assert.equal(right.type, 'unary_expression');
  assert.equal(right.childForFieldName('operator').text, '-');
  assert.equal(right.childForFieldName('argument').type, 'number');

  const composed = condition('{if ($item@index is div by 2) && (count($rows) is div by 3) || $flag}Y{/if}');
  assert.equal(composed.childForFieldName('operator').text, '||');
  const and = composed.childForFieldName('left');
  assert.equal(and.childForFieldName('operator').text, '&&');
  for (const side of and.childForFieldName('left').descendantsOfType('div_by_operator')) {
    assert.equal(side.text, 'is div by');
  }
  assert.equal(and.childForFieldName('right').descendantsOfType('div_by_operator').length, 1);
});

test('Only the exact lower-case predicate with a separated RHS enters this subset', () => {
  for (const source of [
    '{$n is div by2}', '{$n is not div by 2}', '{$n is even by 2}', '{$n is odd by 2}',
  ]) {
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
  }
});

test('Full Smarty verifies controlled truth and PHP translation boundaries', () => {
  for (const [expression, expected] of [
    ['4 is div by 2', 'T'], ['5 is div by 2', 'F'], ['4 is div by -2', 'T'],
    ['0 < 4 is div by 2', 'T'], ['(0 < 4) is div by 2', 'F'],
    ['4 + 2 is div by 3', 'F'], ['(4 + 2) is div by 3', 'T'],
    ['4 is div by 2 + 1', 'T'], ['4 is div by (2 + 1)', 'F'],
  ]) {
    const result = fullEngine(`{if ${expression}}T{else}F{/if}`);
    assert.equal(result.error, null, expression);
    assert.equal(result.result, expected, expression);
  }
  for (const [source, expected] of [
    ['{$n is div by 2}', {4: '1', 5: ''}],
    ['{$x|default:($n is div by 2)}', {4: '1', 5: ''}],
  ]) {
    for (const [n, result] of Object.entries(expected)) {
      const rendered = fullEngine(source, {values: {n: Number(n)}});
      assert.equal(rendered.error, null, source);
      assert.equal(rendered.result, result, `${source} n=${n}`);
    }
  }
});

test('Missing or edited predicate operands recover and incremental edits match fresh trees', () => {
  const malformed = 'before {if $n is div by }Y{/if} after';
  const broken = parser().parse(malformed).rootNode;
  assert.equal(broken.hasError, true, broken.toString());
  assert.equal(broken.namedChildren[0].type, 'text');
  assert.equal(broken.namedChildren.at(-1).text, ' after');
  assert.ok(broken.descendantsOfType('if_close_tag').length);

  const p = parser();
  let source = 'before {if $n is div by 2}Y{/if} after';
  let tree = p.parse(source);
  const start = source.indexOf('2}', source.indexOf('by'));
  for (const [oldText, newText, hasError] of [['2', '', true], ['', '2', false]]) {
    const next = source.slice(0, start) + newText + source.slice(start + oldText.length);
    tree.edit({
      startIndex: start, oldEndIndex: start + oldText.length, newEndIndex: start + newText.length,
      startPosition: { row: 0, column: start },
      oldEndPosition: { row: 0, column: start + oldText.length },
      newEndPosition: { row: 0, column: start + newText.length },
    });
    tree = p.parse(next, tree);
    assert.equal(tree.rootNode.hasError, hasError, tree.rootNode.toString());
    assert.equal(tree.rootNode.namedChildren[0].text, 'before ');
    assert.equal(tree.rootNode.namedChildren.at(-1).text, ' after');
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode));
    source = next;
  }
});
