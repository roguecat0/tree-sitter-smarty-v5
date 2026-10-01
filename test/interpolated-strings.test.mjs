import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('interpolated-strings.txt');
assert.equal(examples.length, 21, 'The interpolation corpus must not silently skip fixtures');
const valid = examples.filter(({ name }) => name !== 'Malformed interpolation preserves following output');

for (const { name, source } of valid) test(`Smarty accepts interpolation fixture: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expected = reference(source);
  assert.equal(expected.error, null);
  assert.deepEqual(observations(root), expected.events);
});

test('Interpolated strings retain ordered fragments, expressions, fields, and source ranges', () => {
  const source = '{"Hello {$user->name}!"}';
  const root = parser().parse(source).rootNode;
  const output = root.firstNamedChild;
  const value = output.childForFieldName('value');
  assert.equal(value.type, 'interpolated_string');
  assert.deepEqual(value.namedChildren.map(node => node.type), [
    'string_fragment', 'string_interpolation', 'string_fragment',
  ]);
  assert.deepEqual([value.startIndex, value.endIndex], [1, source.length - 1]);
  const [before, interpolation, after] = value.namedChildren;
  assert.deepEqual([before.text, before.startIndex, before.endIndex], ['Hello ', 2, 8]);
  assert.deepEqual([after.text, after.startIndex, after.endIndex], ['!', 21, 22]);
  assert.equal(interpolation.childForFieldName('value').type, 'member_expression');
  assert.deepEqual([interpolation.startIndex, interpolation.endIndex], [8, 21]);
  assert.equal(interpolation.childForFieldName('value').text, '$user->name');
});

test('Generic tag and modifier own complete interpolated string values', () => {
  const tagRoot = parser().parse('{widget value="id_{$item@key}"}').rootNode;
  const tag = tagRoot.firstNamedChild;
  const attribute = tag.namedChildren[1];
  const tagValue = attribute.childForFieldName('value');
  assert.equal(tag.type, 'custom_tag');
  assert.equal(attribute.type, 'attribute');
  assert.equal(tagValue.type, 'interpolated_string');
  assert.deepEqual(tag.namedChildren.map(node => node.type), ['identifier', 'attribute']);
  assert.equal(tagValue.firstNamedChild.type, 'string_fragment');
  assert.equal(tagValue.namedChildren[1].childForFieldName('value').type, 'loop_metadata_expression');

  const modifierRoot = parser().parse('{$value|default:"id_{$item}"}').rootNode;
  const modifier = modifierRoot.firstNamedChild.childForFieldName('value');
  assert.equal(modifier.type, 'modifier_expression');
  assert.equal(modifier.childrenForFieldName('argument').length, 1);
  assert.equal(modifier.childForFieldName('argument').type, 'interpolated_string');
  assert.equal(modifier.childForFieldName('argument').namedChildren[1].childForFieldName('value').text, '$item');
});

test('Direct variables and backtick-dollar variables keep their expression nodes', () => {
  for (const [source, childType] of [
    ['{"Hello $name"}', 'variable'],
    ['{"Hello `$name`"}', 'variable'],
    ['{"Hello `$user->get_name()`"}', 'method_call_expression'],
  ]) {
    const root = parser().parse(source).rootNode;
    const value = root.firstNamedChild.childForFieldName('value');
    assert.equal(value.type, 'interpolated_string', root.toString());
    const interpolation = value.namedChildren.find(node => node.type === 'string_interpolation');
    assert.ok(interpolation);
    assert.equal(interpolation.childForFieldName('value').type, childType);
  }
});

test('Pinned Smarty compiler accepts supported interpolation forms', () => {
  for (const source of [
    '{"Hello $name"}',
    '{"Hello {$user->name}!"}',
    '{"Hello `$name`"}',
    '{$value|default:"id_{$item}"}',
  ]) {
    assert.equal(fullEngine(source, { mode: 'compile' }).error, null, source);
  }
});

test('Smarty rendering distinguishes backtick interpolation from literal text', () => {
  const cases = [
    ['{"Hello `$name`"}', 'Hello world'],
    ['{"Hello `{$name}`"}', 'Hello `world`'],
    ['{"Hello `strtoupper($name)`"}', 'Hello `strtoupper(world)`'],
  ];
  for (const [source, expected] of cases) {
    assert.equal(reference(source).error, null, source);
    const rendered = fullEngine(source, { mode: 'render', values: { name: 'world' } });
    assert.equal(rendered.error, null, source);
    assert.equal(rendered.result, expected, source);
  }
});

test('Dollar without a Smarty identifier remains literal string text', () => {
  const cases = [
    ['{"$"}', '$'],
    ['{"$!"}', '$!'],
    ['{"$5"}', '$5'],
    ['{"Price $5"}', 'Price $5'],
    ['{"$$"}', '$$'],
  ];
  for (const [source, expected] of cases) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    assert.equal(root.firstNamedChild.childForFieldName('value').type, 'string');
    assert.equal(reference(source).error, null, source);
    const rendered = fullEngine(source, { mode: 'render' });
    assert.equal(rendered.error, null, source);
    assert.equal(rendered.result, expected, source);
  }
});

test('Dollar followed by a digit-prefixed Smarty ID enters interpolation', () => {
  for (const name of ['5a', '5_']) {
    const source = `{"$${name}"}`;
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const value = root.firstNamedChild.childForFieldName('value');
    assert.equal(value.type, 'interpolated_string');
    assert.equal(value.firstNamedChild.type, 'string_interpolation');
    assert.equal(value.firstNamedChild.childForFieldName('value').type, 'variable');
    assert.equal(value.firstNamedChild.childForFieldName('value').childForFieldName('name').text, name);
    assert.equal(reference(source).error, null);
    const rendered = fullEngine(source, { mode: 'render', values: { [name]: 'world' } });
    assert.equal(rendered.error, null);
    assert.equal(rendered.result, 'world');
  }
});

test('A literal dollar fragment does not consume the next interpolation opener', () => {
  for (const [source, prefix, expected] of [
    ['{"$$name"}', '$', '$world'],
    ['{"$5$name"}', '$5', '$5world'],
  ]) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const value = root.firstNamedChild.childForFieldName('value');
    assert.equal(value.type, 'interpolated_string');
    const [fragment, interpolation] = value.namedChildren;
    assert.equal(fragment.type, 'string_fragment');
    assert.equal(fragment.text, prefix);
    assert.equal(interpolation.type, 'string_interpolation');
    assert.equal(interpolation.childForFieldName('value').text, '$name');
    assert.equal(reference(source).error, null);
    const rendered = fullEngine(source, { mode: 'render', values: { name: 'world' } });
    assert.equal(rendered.error, null);
    assert.equal(rendered.result, expected);
  }
});

test('Backtick boundaries retain exact literal fragment text and ranges', () => {
  const cases = [
    ['{"Hello `$name`"}', [['Hello ', 2, 8]]],
    ['{"Hello `{$name}`"}', [['Hello `', 2, 9], ['`', 16, 17]]],
    ['{"Hello `strtoupper($name)`"}', [['Hello `strtoupper(', 2, 20], [')`', 25, 27]]],
  ];
  for (const [source, expected] of cases) {
    const root = parser().parse(source).rootNode;
    const value = root.descendantsOfType('interpolated_string')[0];
    assert.ok(value, `Expected interpolation nodes in ${source}: ${root.toString()}`);
    assert.deepEqual(value.descendantsOfType('string_fragment').map(fragment => [
      fragment.text, fragment.startIndex, fragment.endIndex,
    ]), expected, source);
  }
});

test('Plain double and single quoted strings retain string nodes', () => {
  for (const source of ['{"plain text"}', "{'$name'}", "{'{$name}'}"]) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    assert.equal(root.firstNamedChild.childForFieldName('value').type, 'string');
  }
});

test('Malformed interpolation marks its missing closer and preserves following output', () => {
  const source = '{"Hello {$name"}{$after}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.equal(root.namedChildren.at(-1).type, 'output', root.toString());
  assert.equal(root.namedChildren.at(-1).text, '{$after}');
  const firstOutput = root.namedChildren[0];
  assert.equal(firstOutput.type, 'output', root.toString());
  const interpolation = firstOutput.descendantsOfType('string_interpolation')[0];
  assert.ok(interpolation, root.toString());
  const missingCloser = interpolation.children.find(node => node.isMissing);
  assert.ok(missingCloser, root.toString());
  assert.equal(missingCloser.type, '}');
  assert.ok(missingCloser.startIndex <= source.indexOf('{$after}'), root.toString());
  assert.deepEqual(root.namedChildren.at(-1).childForFieldName('value').text, '$after');
  const smarty = reference(source);
  assert.match(smarty.error ?? '', /expected one of: "\}"/);
});

test('Adding and removing interpolation matches full fresh-tree snapshots', () => {
  const p = parser();
  let source = '{$value|default:"name"}{$after}';
  let tree = p.parse(source);
  for (const [from, to, interpolation] of [
    ['name', 'name {$item->name}', true],
    ['name {$item->name}', 'name', false],
  ]) {
    const startIndex = source.indexOf(from);
    const next = source.slice(0, startIndex) + to + source.slice(startIndex + from.length);
    tree.edit({
      startIndex, oldEndIndex: startIndex + from.length, newEndIndex: startIndex + to.length,
      startPosition: { row: 0, column: startIndex },
      oldEndPosition: { row: 0, column: startIndex + from.length },
      newEndPosition: { row: 0, column: startIndex + to.length },
    });
    tree = p.parse(next, tree);
    const root = tree.rootNode;
    assert.equal(root.hasError, false, root.toString());
    assert.equal(root.namedChildren.at(-1).text, '{$after}');
    assert.equal(root.descendantsOfType('string_interpolation').length, interpolation ? 1 : 0);
    assert.deepEqual(snapshot(root), snapshot(parser().parse(next).rootNode));
    source = next;
  }
});
