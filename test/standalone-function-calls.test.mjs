import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('standalone-function-calls.txt');
assert.equal(examples.length, 10);
for (const { name, source } of examples) test(`Standalone function reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expected = reference(source);
  assert.equal(expected.error, null);
  assert.deepEqual(observations(root), expected.events);
});

test('Call nodes retain callee, argument order, and exact ranges', () => {
  const source = '{sum($first, is_valid_id($third))}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const call = root.firstNamedChild.childForFieldName('value');
  assert.equal(call.type, 'function_call_expression');
  assert.equal(call.text, 'sum($first, is_valid_id($third))');
  assert.equal(call.startIndex, 1);
  assert.equal(call.endIndex, source.length - 1);
  assert.equal(call.childForFieldName('name').text, 'sum');
  assert.equal(call.childForFieldName('name').startIndex, 1);
  assert.equal(call.childForFieldName('name').endIndex, 4);
  const punctuation = call.children.filter(child => !child.isNamed);
  assert.deepEqual(punctuation.map(child => child.text), ['(', ',', ')']);
  assert.deepEqual(punctuation.map(child => child.startIndex), [source.indexOf('('), source.indexOf(','), source.lastIndexOf(')')]);
  const args = call.childrenForFieldName('argument');
  assert.equal(args.length, 2);
  assert.equal(args[0].text, '$first');
  const nested = args[1];
  assert.equal(nested.type, 'function_call_expression');
  assert.equal(nested.text, 'is_valid_id($third)');
  assert.equal(nested.startIndex, source.indexOf('is_valid_id'));
  assert.equal(nested.endIndex, nested.startIndex + nested.text.length);
  assert.equal(nested.childForFieldName('name').text, 'is_valid_id');
  assert.equal(nested.childrenForFieldName('argument').length, 1);
  const nestedPunctuation = nested.children.filter(child => !child.isNamed);
  assert.deepEqual(nestedPunctuation.map(child => child.text), ['(', ')']);
  assert.deepEqual(nestedPunctuation.map(child => child.startIndex), [source.indexOf('(', nested.startIndex), source.lastIndexOf(')') - 1]);
});

test('Function-shaped outputs stay distinct from generic tags', () => {
  for (const [source, type] of [
    ['{f(1)}', 'output'],
    ['{widget ($a > 0)}', 'output'],
    ['{widget}', 'custom_tag'],
    ['{widget value=("x")}', 'custom_tag'],
  ]) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    assert.equal(root.firstNamedChild.type, type, source);
  }
});

test('Unsupported trailing function-output attributes error and recover neighbors', () => {
  const source = '{widget ($a > 0) enabled=!$b value=$a|decorate:($b || #enabled#)}{*ignored &&*}{/other}';
  const root = parser().parse(source).rootNode;
  assert.equal(reference(source).error, null, 'Smarty accepts this output-attribute form');
  assert.equal(root.hasError, true, root.toString());
  assert.deepEqual(root.namedChildren.map(node => node.type), ['output', 'comment', 'custom_close_tag'], root.toString());
  const output = root.namedChildren[0];
  const call = output.childForFieldName('value');
  assert.equal(call.type, 'function_call_expression', root.toString());
  assert.equal(call.childForFieldName('name').text, 'widget');
  assert.equal(call.text, 'widget ($a > 0)');
  const attributeStart = source.indexOf('enabled');
  const outputEnd = source.indexOf('}', attributeStart);
  const errors = output.descendantsOfType('ERROR');
  assert.equal(errors.length, 1, output.toString());
  assert.equal(errors[0].startIndex, attributeStart);
  assert.equal(errors[0].text, source.slice(attributeStart, outputEnd));
  assert.equal(output.endIndex, outputEnd + 1);
  assert.equal(root.namedChildren[1].text, '{*ignored &&*}');
  assert.equal(root.namedChildren[2].type, 'custom_close_tag');
});

test('Unsupported trailing attributes do not become valid with a tilde suffix', () => {
  for (const source of [
    '{widget ($a > 0) enabled=!$b~}',
    '{widget ($a > 0) enabled=!$b value=$a|escape~}',
  ]) {
    const expected = reference(source);
    assert.ok(expected.error, `Smarty must reject ${source}`);
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, true, root.toString());
  }
});

test('Malformed calls report errors without losing adjacent outputs', () => {
  for (const malformed of ['{is_valid_id($id}', '{is_valid_id($id + )}', '{is_valid_id($id,)}']) {
    const source = `{$before}${malformed}{$after}`;
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, true, root.toString());
    assert.equal(root.namedChildren[0].type, 'output', root.toString());
    assert.equal(root.namedChildren.at(-1).type, 'output', root.toString());
  }
  const trailing = '{if is_valid_id($id,)}ok{/if}';
  assert.ok(reference(trailing).error, 'Smarty compiler rejects a trailing call comma');
});

test('Call parenthesis deletion and restoration match fresh trees', () => {
  const p = parser();
  let source = '{$before}{is_valid_id($id)}{$after}';
  let tree = p.parse(source);
  const close = source.indexOf(')}');
  for (const [before, after, error] of [[')', '', true], ['', ')', false]]) {
    const startIndex = close;
    const next = source.slice(0, startIndex) + after + source.slice(startIndex + before.length);
    tree.edit({
      startIndex,
      oldEndIndex: startIndex + before.length,
      newEndIndex: startIndex + after.length,
      startPosition: { row: 0, column: startIndex },
      oldEndPosition: { row: 0, column: startIndex + before.length },
      newEndPosition: { row: 0, column: startIndex + after.length },
    });
    tree = p.parse(next, tree);
    assert.equal(tree.rootNode.hasError, error, tree.rootNode.toString());
    const changedOutput = tree.rootNode.namedChildren[1];
    assert.equal(changedOutput.type, 'output');
    assert.equal(changedOutput.hasError, error, changedOutput.toString());
    assert.equal(tree.rootNode.namedChildren[0].text, '{$before}');
    assert.equal(tree.rootNode.namedChildren.at(-1).text, '{$after}');
    if (!error) {
      const call = changedOutput.childForFieldName('value');
      assert.equal(call.type, 'function_call_expression', changedOutput.toString());
      assert.equal(call.childForFieldName('name').text, 'is_valid_id');
      assert.equal(call.childrenForFieldName('argument').length, 1);
      assert.equal(call.childrenForFieldName('argument')[0].text, '$id');
    }
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode));
    source = next;
  }
});
