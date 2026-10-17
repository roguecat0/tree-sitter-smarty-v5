import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('braced-modifier-arguments.txt');

test('Braced modifier argument trees match pinned Smarty observations', () => {
  for (const { name, source } of examples) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, `${name}: ${root.toString()}`);
    const observed = reference(source);
    assert.equal(observed.error, null, `${name}: ${observed.error}`);
    assert.deepEqual(observations(root), observed.events, name);
  }
});

test('Braced modifier arguments preserve wrapper/value ranges and modifier ownership', () => {
  const source = '{"prefix"|cat:{$id}}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const output = root.namedChild(0);
  const modifier = output.childForFieldName('value');
  const wrapper = modifier.childForFieldName('argument');
  const value = wrapper.childForFieldName('value');
  assert.equal(output.type, 'output');
  assert.equal(modifier.type, 'modifier_expression');
  assert.equal(modifier.childForFieldName('value').type, 'string');
  assert.equal(modifier.childForFieldName('name').text, 'cat');
  assert.equal(wrapper.type, 'output');
  assert.equal(wrapper.text, '{$id}');
  assert.deepEqual([wrapper.startIndex, wrapper.endIndex], [14, 19]);
  assert.equal(value.type, 'variable');
  assert.equal(value.text, '$id');
  assert.deepEqual([value.startIndex, value.endIndex], [15, 18]);
  assert.deepEqual([modifier.startIndex, modifier.endIndex], [1, 19]);
  assert.equal(root.toString(), '(source_file (output value: (modifier_expression value: (string) name: (identifier) argument: (output value: (variable name: (identifier))))))');
});

test('Braced modifier arguments compose in tag, condition, call, and array contexts', () => {
  const compilerSources = [
    '{if $x|cat:{$id}}Y{/if}',
    '{$o->f($x|cat:{$id})}',
    '{array("key"=>$x|cat:{$id})}',
  ];
  for (const source of compilerSources) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    assert.equal(reference(source).error, null, source);
    assert.equal(fullEngine(source, { mode: 'compile' }).error, null, source);
  }

  const tagSource = '{widget value=$x|cat:{$id}}';
  const tagRoot = parser().parse(tagSource).rootNode;
  assert.equal(tagRoot.hasError, false, tagRoot.toString());
  assert.equal(reference(tagSource).error, null);
  const tag = tagRoot.namedChild(0);
  assert.equal(tag.type, 'custom_tag');
  const attribute = tag.namedChildren.find(node => node.type === 'attribute');
  assert.equal(attribute.childForFieldName('name').text, 'value');
  const modifier = attribute.childForFieldName('value');
  assert.equal(modifier.type, 'modifier_expression');
  assert.equal(modifier.childForFieldName('argument').type, 'output');
  // The full compiler cannot validate an unknown application/plugin tag.
  assert.match(fullEngine(tagSource, { mode: 'compile' }).error.message, /unknown tag 'widget'/);
});

test('Controlled cat renders confirm braced argument value grouping', () => {
  for (const [source, values, expected] of [
    ['{"prefix"|cat:{$id}}', { id: '42' }, 'prefix42'],
    ['{"prefix"|cat:{$id + 1}}', { id: 41 }, 'prefix42'],
    ['{"prefix"|cat:{$id|cat:"!"}}', { id: '42' }, 'prefix42!'],
  ]) {
    const result = fullEngine(source, { mode: 'render', values });
    assert.equal(result.error, null, `${source}: ${JSON.stringify(result.error)}`);
    assert.equal(result.result, expected, source);
  }
});

test('Malformed braced arguments keep errors local and a later output recognizable', () => {
  for (const source of [
    '{$x|cat:{$id}{$after}',
    '{$x|cat:{$id + }}{$after}',
    '{$x|cat:{$id}:}{$after}',
  ]) {
    assert.ok(reference(source).error, `Smarty recorder unexpectedly accepted malformed input: ${source}`);
    assert.ok(fullEngine(source, { mode: 'compile' }).error, `Smarty compiler unexpectedly accepted malformed input: ${source}`);
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, true, `${source}: ${root.toString()}`);
    const later = root.descendantsOfType('output').find(node => node.text === '{$after}');
    assert.ok(later, root.toString());
    assert.equal(later.hasError, false, root.toString());
    assert.deepEqual([source.slice(later.startIndex, later.endIndex), later.text], ['{$after}', '{$after}']);
  }
});

test('Editing direct and braced arguments, inner closers, and outer modifier chains matches fresh parses', () => {
  const incremental = parser();
  let source = '{$x|cat:$id}{$after}';
  let tree = incremental.parse(source);
  const position = (text, index) => {
    const lines = text.slice(0, index).split('\n');
    return { row: lines.length - 1, column: lines.at(-1).length };
  };
  for (const [from, to] of [
    [':$id', ':{$id}'],
    ['{$id}', '{$id'],
    ['{$id', '{$id}'],
    ['{$id}', '{$id}|escape'],
    ['{$id}|escape', '{$id}'],
  ]) {
    const start = source.indexOf(from);
    const next = source.slice(0, start) + to + source.slice(start + from.length);
    tree.edit({
      startIndex: start,
      oldEndIndex: start + from.length,
      newEndIndex: start + to.length,
      startPosition: position(source, start),
      oldEndPosition: position(source, start + from.length),
      newEndPosition: position(next, start + to.length),
    });
    tree = incremental.parse(next, tree);
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode), next);
    assert.equal(tree.rootNode.descendantsOfType('output').find(node => node.text === '{$after}')?.hasError, false, next);
    source = next;
  }
});
