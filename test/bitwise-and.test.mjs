import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('bitwise-and.txt');
assert.equal(examples.length, 6);
for (const { name, source } of examples) test(`Bitwise AND reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expected = reference(source);
  assert.equal(expected.error, null);
  assert.deepEqual(observations(root), expected.events);
});

test('Bitwise AND field keeps its exact source range and whitespace spelling', () => {
  for (const source of ['{$a & $b}', '{$a&$b}']) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const expression = root.firstNamedChild.childForFieldName('value');
    const operator = expression.childForFieldName('operator');
    const start = source.indexOf('&');
    assert.equal(expression.type, 'binary_expression');
    assert.equal(operator.text, '&');
    assert.equal(operator.startIndex, start);
    assert.equal(operator.endIndex, start + 1);
    assert.equal(expression.childForFieldName('left').text, '$a');
    assert.equal(expression.childForFieldName('right').text, '$b');
  }
});

test('Smarty arithmetic and equality bind more tightly than bitwise AND', () => {
  const source = '{if 5 & 3 == 1}T{/if}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const condition = root.descendantsOfType('if_tag')[0].childForFieldName('condition');
  assert.equal(condition.childForFieldName('operator').text, '&');
  const equality = condition.childForFieldName('right');
  assert.equal(equality.type, 'binary_expression');
  assert.equal(equality.childForFieldName('operator').text, '==');
  assert.equal(equality.childForFieldName('left').text, '3');

  const arithmetic = parser().parse('{$a + 2 & $b}').rootNode.firstNamedChild.childForFieldName('value');
  assert.equal(arithmetic.childForFieldName('operator').text, '&');
  assert.equal(arithmetic.childForFieldName('left').childForFieldName('operator').text, '+');

  const relational = parser().parse('{if $a & $b < $c}T{/if}')
    .rootNode.descendantsOfType('if_tag')[0].childForFieldName('condition');
  assert.equal(relational.childForFieldName('operator').text, '&');
  assert.equal(relational.childForFieldName('right').childForFieldName('operator').text, '<');
});

test('Bitwise AND binds above logical operators, and chains associate left', () => {
  const condition = parser().parse('{if $a & $b && $c || $d}Y{/if}')
    .rootNode.descendantsOfType('if_tag')[0].childForFieldName('condition');
  assert.equal(condition.childForFieldName('operator').text, '||');
  const logicalAnd = condition.childForFieldName('left');
  assert.equal(logicalAnd.childForFieldName('operator').text, '&&');
  assert.equal(logicalAnd.childForFieldName('left').childForFieldName('operator').text, '&');

  const chain = parser().parse('{$a & $b & $c}').rootNode.firstNamedChild.childForFieldName('value');
  assert.equal(chain.childForFieldName('operator').text, '&');
  assert.equal(chain.childForFieldName('left').childForFieldName('operator').text, '&');
  assert.equal(chain.childForFieldName('right').text, '$c');
});

test('Controlled Smarty 5.8.4 compilation and rendering confirms PHP bitwise behavior', () => {
  for (const [source, expected] of [
    ['{5 & 3}', '1'],
    ['{5 + 2 & 3}', '3'],
    ['{5 & 3 + 1}', '4'],
    ['{if 5 & 3 == 1}T{else}F{/if}', 'F'],
    ['{if 5 & 3 < 2}T{else}F{/if}', 'F'],
    // With x=2 and mask=2, `(2 & 2) && 2` renders `1`; `2 & (2 && 2)` renders `0`.
    ['{$x & $mask && 2}', '1'],
  ]) {
    const result = fullEngine(source, {values: {x: 2, mask: 2}});
    assert.equal(result.version, '5.8.4', source);
    assert.equal(result.error, null, source);
    assert.equal(result.result, expected, source);
  }
});

test('Malformed AND operand errors stay local and later syntax recovers', () => {
  for (const [source, expectedTree] of [
    ['before {$a &} {* keep *} after {$later}',
      '(source_file (text) (output value: (binary_expression left: (variable name: (identifier)) right: (boolean (MISSING "true")))) (text) (comment) (text) (output value: (variable name: (identifier))))'],
    ['before {if $a &}bad{/if} after {$later}',
      '(source_file (text) (if_block (if_tag condition: (binary_expression left: (variable name: (identifier)) right: (boolean (MISSING "true")))) (text) (if_close_tag)) (text) (output value: (variable name: (identifier))))'],
  ]) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, true, root.toString());
    assert.equal(root.toString(), expectedTree);
    const expression = source.includes('{if')
      ? root.descendantsOfType('if_tag')[0].childForFieldName('condition')
      : root.descendantsOfType('output')[0].childForFieldName('value');
    assert.equal(expression.type, 'binary_expression');
    const missing = expression.childForFieldName('right');
    assert.equal(missing.type, 'boolean');
    assert.equal(missing.firstChild.type, 'true');
    assert.equal(missing.firstChild.isMissing, true);
    assert.equal(missing.text, '');
    assert.equal(missing.parent.type, 'binary_expression');
    assert.equal(missing.parent.childForFieldName('left').text, '$a');
    assert.equal(missing.parent.childForFieldName('operator').text, '&');
    const expected = reference(source);
    assert.equal(expected.version, '5.8.4');
    assert.match(expected.error, /Unexpected "}"/);
    const compiled = fullEngine(source, {mode: 'compile'});
    assert.equal(compiled.version, '5.8.4');
    assert.match(compiled.error?.message, /Unexpected "}"/);
    assert.equal(root.descendantsOfType('comment').length, source.includes('{*') ? 1 : 0);
    assert.equal(root.descendantsOfType('if_close_tag').length, source.includes('{if') ? 1 : 0);
    const later = root.descendantsOfType('output').at(-1);
    assert.equal(later.text, '{$later}');
    assert.equal(later.hasError, false);
  }

  const output = parser().parse('before {$a &} {* keep *} after {$later}').rootNode;
  assert.equal(output.namedChildren.map(node => node.type).join(','), 'text,output,text,comment,text,output');
  const condition = parser().parse('before {if $a &}bad{/if} after {$later}').rootNode;
  assert.equal(condition.namedChildren.map(node => node.type).join(','), 'text,if_block,text,output');
  assert.equal(condition.namedChildren[1].childForFieldName('condition'), null);

  assert.equal(parser().parse('plain & HTML').rootNode.hasError, false);
  assert.equal(parser().parse('<div title="A & B">A & B</div>').rootNode.hasError, false);
});

test('Removing and restoring a nested AND operand matches fresh parse trees', () => {
  const p = parser();
  let source = '{if ($a & $b) && $c}Y{/if}';
  let tree = p.parse(source);
  const start = source.indexOf('$b');
  for (const [oldText, newText, hasError] of [['$b', '', true], ['', '$b', false]]) {
    const next = source.slice(0, start) + newText + source.slice(start + oldText.length);
    tree.edit({
      startIndex: start, oldEndIndex: start + oldText.length, newEndIndex: start + newText.length,
      startPosition: {row: 0, column: start},
      oldEndPosition: {row: 0, column: start + oldText.length},
      newEndPosition: {row: 0, column: start + newText.length},
    });
    tree = p.parse(next, tree);
    assert.equal(tree.rootNode.hasError, hasError, tree.rootNode.toString());
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode));
    source = next;
  }
});
