import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, observations, parser, reference, snapshot } from './helpers.mjs';

const cases = fixtures('loop-metadata-modifier-arguments.txt');
for (const { name, source } of cases) {
  test(`Loop metadata modifier argument reference and structure: ${name}`, () => {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const expected = reference(source);
    assert.equal(expected.error, null, `${name}: Smarty rejected fixture`);
    assert.deepEqual(observations(root), expected.events);
  });
}

test('Modifier metadata keeps the expected fields and same-output composition order', () => {
  const source = cases[1].source;
  const root = parser().parse(source).rootNode;
  const outer = root.descendantsOfType('output')[0].childForFieldName('value');
  assert.equal(outer.type, 'modifier_expression');
  assert.equal(outer.childForFieldName('name').text, 'escape');
  const inner = outer.childForFieldName('value');
  assert.equal(inner.childForFieldName('name').text, 'default');
  assert.deepEqual(inner.childrenForFieldName('argument').map(node => node.type), ['variable', 'loop_metadata_expression']);
  const metadata = inner.childrenForFieldName('argument')[1];
  assert.equal(metadata.childForFieldName('item').text, '$item');
  assert.equal(metadata.childForFieldName('property').text, 'index');
  assert.deepEqual(reference(source).events.map(({ kind, name, arguments: args }) => [kind, name,
    kind === 'modifier' ? args : kind === 'tag' ? args.length : undefined]), [
    ['tag', 'foreach', 2], ['modifier', 'default', 2], ['modifier', 'escape', 0],
    ['output', undefined, undefined], ['tag', 'foreachclose', 0],
  ]);
});

test('Direct metadata modifier argument preserves exact source ranges', () => {
  const source = cases[0].source;
  const metadata = parser().parse(source).rootNode.descendantsOfType('loop_metadata_expression')[0];
  const item = metadata.childForFieldName('item');
  const property = metadata.childForFieldName('property');
  const start = source.indexOf('$item@index');
  assert.deepEqual([metadata.startIndex, metadata.endIndex], [start, start + '$item@index'.length]);
  assert.deepEqual([item.startIndex, item.endIndex], [start, start + '$item'.length]);
  assert.deepEqual([property.startIndex, property.endIndex], [start + '$item@'.length, start + '$item@index'.length]);
});

test('Malformed metadata modifier arguments report errors and preserve following output and close', () => {
  for (const malformed of [
    '{foreach $items as $item}{$item|default:$fallback:$item@}{$after}{/foreach}',
    '{foreach $items as $item}{$item|default:$fallback:$item @index}{$after}{/foreach}',
  ]) {
    const root = parser().parse(malformed).rootNode;
    assert.equal(root.hasError, true, root.toString());
    assert.match(reference(malformed).error, /Syntax error/);
    const atIndex = malformed.indexOf('@');
    assert.equal(root.descendantsOfType('ERROR').some(node => node.startIndex <= atIndex && node.endIndex > atIndex), true, root.toString());
    assert.equal(root.descendantsOfType('output').some(node => node.text === '{$after}'), true, root.toString());
    assert.equal(root.descendantsOfType('foreach_close_tag').length, 1, root.toString());
    assert.equal(root.descendantsOfType('loop_metadata_expression').length, 0, root.toString());
  }
});

test('Metadata modifier suffix edits match full fresh snapshots through recovery', () => {
  const p = parser();
  const original = cases[1].source.replace('{/foreach}', '{$after}{/foreach}');
  let source = original;
  let tree = p.parse(source);
  const suffixPosition = () => source.includes('$item@index')
    ? source.indexOf('$item@index') + '$item'.length
    : source.indexOf('$fallback:$item') + '$fallback:$item'.length;
  const edit = (from, to, offset = 0) => {
    const startIndex = suffixPosition() + offset;
    const oldEndIndex = startIndex + from.length;
    const next = source.slice(0, startIndex) + to + source.slice(oldEndIndex);
    tree.edit({ startIndex, oldEndIndex, newEndIndex: startIndex + to.length,
      startPosition: { row: 0, column: startIndex }, oldEndPosition: { row: 0, column: oldEndIndex },
      newEndPosition: { row: 0, column: startIndex + to.length } });
    tree = p.parse(next, tree);
    source = next;
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(source).rootNode));
  };

  edit('@index', '');
  assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
  const defaultModifier = tree.rootNode.descendantsOfType('modifier_expression')
    .find(node => node.childForFieldName('name')?.text === 'default');
  const argument = defaultModifier.childrenForFieldName('argument')[1];
  assert.equal(argument.type, 'variable');
  assert.equal(argument.text, '$item');
  edit('', '@index');
  assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
  assert.equal(tree.rootNode.descendantsOfType('loop_metadata_expression').length, 1, tree.rootNode.toString());
  assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(original).rootNode));

  edit('index', '', 1);
  assert.equal(tree.rootNode.hasError, true, tree.rootNode.toString());
  assert.equal(tree.rootNode.descendantsOfType('output').some(node => node.text === '{$after}'), true, tree.rootNode.toString());
  assert.equal(tree.rootNode.descendantsOfType('foreach_close_tag').length, 1, tree.rootNode.toString());
  edit('', 'index', 1);
  assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
  assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(original).rootNode));
});
