import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, observations, parser, reference, fullEngine, snapshot } from './helpers.mjs';

const examples = fixtures('word-boolean-operators.txt');
assert.equal(examples.length, 13);
for (const { name, source } of examples) test(`Prefix not tree and reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expected = reference(source);
  assert.equal(expected.error, null, name);
  if (name === 'Prefix not over a call') {
    const projected = observations(root);
    assert.deepEqual(projected.filter(event => event.kind !== 'modifier'), expected.events);
    assert.deepEqual(projected.filter(event => event.kind === 'modifier'), [
      { kind: 'modifier', name: 'isset', arguments: 0 },
    ]);
  } else assert.deepEqual(observations(root), expected.events);
});

test('Malformed prefix not retains following comment, output, and closer', () => {
  const source = '{if not }{*keep*}{$after}{/if}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.ok(root.descendantsOfType('comment').length, root.toString());
  assert.ok(root.descendantsOfType('output').length, root.toString());
  assert.ok(root.descendantsOfType('if_close_tag').length, root.toString());
});

test('Prefix not keeps an explicit word operator and exact source range', () => {
  for (const word of ['not', 'NOT', 'Not']) {
    const source = `{if ${word} $a}Y{/if}`;
    const root = parser().parse(source).rootNode;
    const unary = root.descendantsOfType('unary_expression')[0];
    const operator = unary.childForFieldName('operator');
    assert.equal(operator.type, 'word_operator');
    assert.equal(operator.text, word);
    assert.equal(operator.startIndex, source.indexOf(word));
    assert.equal(operator.endIndex, operator.startIndex + word.length);
    assert.equal(unary.childForFieldName('argument').text, '$a');
  }
});

test('not stays distinct from identifier, call, string, and comment forms', () => {
  for (const source of ['{not}', '{widget not}', '{widget value=not}',
    '{widget not=value}', '{notable($not)}', '{not($a)}',
    '{"not"}{* not *}']) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    assert.equal(reference(source).error, null, source);
  }
  const call = parser().parse('{not($a)}').rootNode;
  assert.equal(call.descendantsOfType('function_call_expression')[0]
    .childForFieldName('name').text, 'not');
  assert.equal(call.descendantsOfType('unary_expression').length, 0);
});

test('Prefix not binds before existing symbolic boolean operators', () => {
  const root = parser().parse('{if not $a && $b}Y{/if}').rootNode;
  const expression = root.descendantsOfType('binary_expression')[0];
  assert.equal(expression.childForFieldName('operator').text, '&&');
  assert.equal(expression.childForFieldName('left').type, 'unary_expression');
  assert.equal(expression.childForFieldName('right').type, 'variable');

  const engine = fullEngine('{if not 1 && 0}T{else}F{/if}{if not (1 && 0)}T{else}F{/if}');
  assert.equal(engine.error, null);
  assert.equal(engine.result, 'FT');
});

test('Prefix not composes with && and || in nested if and elseif conditions', () => {
  const source = '{if not $a && $b}{if not $c || $d}Y{/if}{elseif not $e && $f}Z{/if}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const branches = root.descendantsOfType('if_block');
  assert.equal(branches.length, 2, root.toString());
  assert.equal(branches[0].descendantsOfType('elseif_clause').length, 1, root.toString());
  const expressions = root.descendantsOfType('binary_expression');
  assert.deepEqual(expressions.map(node => node.childForFieldName('operator').text), ['&&', '||', '&&']);
  for (const expression of expressions) {
    assert.equal(expression.childForFieldName('left').type, 'unary_expression', expression.toString());
    assert.equal(expression.childForFieldName('right').type, 'variable', expression.toString());
  }
  assert.equal(reference(source).error, null);
});

test('Switching prefix not and ! incrementally matches fresh full snapshots', () => {
  const p = parser();
  let source = '{if not $a}Y{/if}';
  let tree = p.parse(source);
  const wordStart = source.indexOf('not');
  const symbolic = '{if !$a}Y{/if}';
  tree.edit({
    startIndex: wordStart,
    oldEndIndex: wordStart + 4,
    newEndIndex: wordStart + 1,
    startPosition: { row: 0, column: wordStart },
    oldEndPosition: { row: 0, column: wordStart + 4 },
    newEndPosition: { row: 0, column: wordStart + 1 },
  });
  tree = p.parse(symbolic, tree);
  assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
  assert.deepEqual(snapshot(tree.rootNode), snapshot(p.parse(symbolic).rootNode));
  assert.equal(tree.rootNode.descendantsOfType('unary_expression')[0]
    .childForFieldName('operator').text, '!');

  const word = '{if not $a}Y{/if}';
  const bangStart = symbolic.indexOf('!');
  tree.edit({
    startIndex: bangStart,
    oldEndIndex: bangStart + 1,
    newEndIndex: bangStart + 4,
    startPosition: { row: 0, column: bangStart },
    oldEndPosition: { row: 0, column: bangStart + 1 },
    newEndPosition: { row: 0, column: bangStart + 4 },
  });
  tree = p.parse(word, tree);
  assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
  assert.deepEqual(snapshot(tree.rootNode), snapshot(p.parse(word).rootNode));
  assert.equal(tree.rootNode.descendantsOfType('unary_expression')[0]
    .childForFieldName('operator').text, 'not');
});

test('Prefix operand deletion errors and repairs incrementally without losing neighbors', () => {
  const p = parser();
  let source = '{$before}{if not $a}Y{/if}{$after}';
  let tree = p.parse(source);
  const operand = source.indexOf('$a');
  const broken = source.slice(0, operand) + source.slice(operand + 2);
  const edited = tree.edit({
    startIndex: operand, oldEndIndex: operand + 2, newEndIndex: operand,
    startPosition: { row: 0, column: operand },
    oldEndPosition: { row: 0, column: operand + 2 },
    newEndPosition: { row: 0, column: operand },
  });
  tree = p.parse(broken, edited);
  assert.equal(tree.rootNode.hasError, true, tree.rootNode.toString());
  assert.equal(tree.rootNode.toString(), p.parse(broken).rootNode.toString());
  assert.equal(tree.rootNode.descendantsOfType('if_close_tag').length, 1);
  assert.equal(tree.rootNode.descendantsOfType('output').length, 2);

  const repaired = broken.slice(0, operand) + '$a' + broken.slice(operand);
  tree.edit({
    startIndex: operand, oldEndIndex: operand, newEndIndex: operand + 2,
    startPosition: { row: 0, column: operand },
    oldEndPosition: { row: 0, column: operand },
    newEndPosition: { row: 0, column: operand + 2 },
  });
  const final = p.parse(repaired, tree);
  assert.equal(final.rootNode.hasError, false, final.rootNode.toString());
  assert.equal(final.rootNode.toString(), p.parse(repaired).rootNode.toString());
});
