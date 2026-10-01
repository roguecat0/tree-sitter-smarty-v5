import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('static-identifier-expressions.txt');

test('Static identifier expression fixtures parse and match Smarty event projections', () => {
  assert.equal(examples.length, 12);
  for (const { name, source } of examples) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, `${name}: ${root.toString()}`);
    const expected = reference(source);
    assert.equal(expected.error, null, `${name}: Smarty rejected fixture`);
    assert.deepEqual(observations(root), expected.events, `${name}: event projection`);
  }
});

test('Static identifier, digit-prefixed ID, primitive, number and class-constant nodes stay distinct', () => {
  for (const [source, text, type] of [
    ['{$a == FLAG}', 'FLAG', 'identifier'],
    ['{$a == 123foo}', '123foo', 'identifier'],
    ['{$a == 123}', '123', 'number'],
    ['{$a == true}', 'true', 'boolean'],
    ['{$a == false}', 'false', 'boolean'],
    ['{$a == null}', 'null', 'null'],
    ['{$a == TrUe}', 'TrUe', 'boolean'],
    ['{$a == FaLsE}', 'FaLsE', 'boolean'],
    ['{$a == NuLl}', 'NuLl', 'null'],
    ['{$a == Widget::NAME}', 'Widget::NAME', 'class_constant_expression'],
  ]) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, `${source}: ${root.toString()}`);
    const value = root.firstNamedChild.childForFieldName('value').childForFieldName('right');
    assert.deepEqual([value.type, value.text, value.startIndex, value.endIndex],
      [type, text, source.indexOf(text), source.indexOf(text) + text.length]);
  }
});

test('Identifier values retain expression fields and array element ownership', () => {
  const conditionSource = '{if MODE && $enabled}yes{/if}';
  const conditionRoot = parser().parse(conditionSource).rootNode;
  assert.equal(conditionRoot.hasError, false, conditionRoot.toString());
  const condition = conditionRoot.firstNamedChild.firstNamedChild.childForFieldName('condition');
  assert.deepEqual([condition.childForFieldName('left').type, condition.childForFieldName('left').text,
    condition.childForFieldName('right').type, condition.childForFieldName('right').text],
  ['identifier', 'MODE', 'variable', '$enabled']);

  const methodSource = '{$user->get(GROUP_NAME_NONE)}';
  const methodRoot = parser().parse(methodSource).rootNode;
  assert.equal(methodRoot.hasError, false, methodRoot.toString());
  const method = methodRoot.firstNamedChild.childForFieldName('value');
  const [argument] = method.childrenForFieldName('argument');
  assert.deepEqual([method.type, method.childForFieldName('object').text, method.childForFieldName('method').text,
    argument.type, argument.text, argument.startIndex, argument.endIndex],
  ['method_call_expression', '$user', 'get', 'identifier', 'GROUP_NAME_NONE', methodSource.indexOf('GROUP_NAME_NONE'), methodSource.indexOf('GROUP_NAME_NONE') + 15]);

  const functionSource = '{in_array(foo, $list)}';
  const functionRoot = parser().parse(functionSource).rootNode;
  assert.equal(functionRoot.hasError, false, functionRoot.toString());
  const call = functionRoot.firstNamedChild.childForFieldName('value');
  const [staticArgument, variableArgument] = call.childrenForFieldName('argument');
  assert.deepEqual([call.type, call.childForFieldName('name').text,
    staticArgument.type, staticArgument.text, staticArgument.startIndex, staticArgument.endIndex,
    variableArgument.type, variableArgument.text],
  ['function_call_expression', 'in_array', 'identifier', 'foo', functionSource.indexOf('foo'),
    functionSource.indexOf('foo') + 3, 'variable', '$list']);

  const arraySource = '{$a == [STATUS_KEY=>MODE]}';
  const arrayRoot = parser().parse(arraySource).rootNode;
  assert.equal(arrayRoot.hasError, false, arrayRoot.toString());
  const element = arrayRoot.firstNamedChild.childForFieldName('value').childForFieldName('right')
    .firstNamedChild;
  assert.deepEqual([element.childForFieldName('key').type, element.childForFieldName('key').text,
    element.childForFieldName('value').type, element.childForFieldName('value').text],
  ['identifier', 'STATUS_KEY', 'identifier', 'MODE']);
});

test('Smarty 5.8.4 accepts full-expression ID contexts and keeps malformed operands invalid', () => {
  for (const source of [
    '{$a == FLAG}', '{if MODE && $enabled}yes{/if}',
    '{$user->get(GROUP_NAME_NONE)}', '{in_array(foo, $list)}', '{$a == [STATUS_KEY=>MODE]}',
  ]) {
    const compile = fullEngine(source, { mode: 'compile' });
    assert.equal(compile.version, '5.8.4');
    assert.equal(compile.error, null, `${source}: ${compile.error?.message}`);
  }
  const call = fullEngine('{in_array(foo, $list)}', { values: { list: ['foo'] } });
  assert.equal(call.version, '5.8.4');
  assert.equal(call.error, null, call.error?.message);
  assert.equal(call.result, '1');
  const malformed = 'before {if $x == }bad{/if} after {$later}';
  assert.match(reference(malformed).error ?? '', /Unexpected "\}"/);
  const root = parser().parse(malformed).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.equal(root.toString(), '(source_file (text) (if_block (if_tag condition: (variable name: (identifier)) (ERROR)) (text) (if_close_tag)) (text) (output value: (variable name: (identifier))))');
  const error = root.descendantsOfType('ERROR')[0];
  assert.deepEqual([error.text, error.startIndex, error.endIndex], ['==', malformed.indexOf('=='), malformed.indexOf('==') + 2]);
  assert.deepEqual(root.namedChildren.slice(-2).map(node => [node.type, node.text]), [
    ['text', ' after '], ['output', '{$later}'],
  ]);
});

test('Identifier condition edit matches a fresh parse and preserves following output', () => {
  const p = parser();
  let source = '{if STATUS_OPEN && $enabled}yes{/if}{$after}';
  let tree = p.parse(source);
  for (const [before, after] of [['STATUS_OPEN', '$enabled'], ['$enabled', 'STATUS_OPEN']]) {
    const startIndex = source.indexOf(before);
    const next = source.slice(0, startIndex) + after + source.slice(startIndex + before.length);
    tree.edit({
      startIndex, oldEndIndex: startIndex + before.length, newEndIndex: startIndex + after.length,
      startPosition: { row: 0, column: startIndex }, oldEndPosition: { row: 0, column: startIndex + before.length },
      newEndPosition: { row: 0, column: startIndex + after.length },
    });
    tree = p.parse(next, tree);
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode));
    assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
    assert.equal(tree.rootNode.namedChildren.at(-1).text, '{$after}');
    source = next;
  }
});

test('Bare expression identifiers retain call and unknown-tag boundaries', () => {
  for (const source of ['{$f(foo)}', '{$f(123foo)}']) {
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
    assert.ok(reference(source).error, `Smarty rejects variable-callee call ${source}`);
  }
  for (const source of ['{foo}', '{123foo}']) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, `${source}: ${root.toString()}`);
    assert.equal(root.firstNamedChild.type, 'custom_tag', `${source}: ${root.toString()}`);
    assert.equal(root.firstNamedChild.childForFieldName('name').text, source.slice(1, -1));
    assert.deepEqual(observations(root), reference(source).events);
  }
  for (const source of ['{widget value=foo}', '{$x|m:foo}']) {
    assert.equal(parser().parse(source).rootNode.hasError, false, source);
  }
  assert.equal(reference('{isset(foo)}').error, null, 'Smarty accepts a bare ID as a built-in call argument');
  assert.equal(fullEngine('{isset(foo)}', { values: { foo: 'foo' } }).result, '1');
});
