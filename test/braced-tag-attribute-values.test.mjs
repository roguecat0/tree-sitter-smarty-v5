import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, parser, reference, observations, snapshot } from './helpers.mjs';

const treeCases = fixtures('braced-tag-attribute-values.txt');
const refCases = fixtures('smarty-reference-braced-tag-attribute-values.txt');

for (const { name, source } of refCases) {
  test(`Braced generic-tag attribute Smarty reference: ${name}`, () => {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const expected = reference(source);
    assert.equal(expected.error, null, source);
    // Smarty's recorder emits the output event before its generic-tag event
    // for a braced attribute value. It observes names/order, not value ownership.
    assert.deepEqual(observations(root), expected.events);
  });
}

test('Braced generic-tag attribute values have explicit nested output ownership and ranges', () => {
  for (const { name, source } of treeCases.slice(0, 8)) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, `${name}: ${root.toString()}`);
  }

  const source = '{widget before=1 selected={$x + $y} after=$z}{$after}';
  const root = parser().parse(source).rootNode;
  const tag = root.namedChildren[0];
  assert.equal(tag.type, 'custom_tag');
  const attributes = tag.namedChildren.filter(child => child.type === 'attribute');
  assert.deepEqual(attributes.map(attribute => attribute.childForFieldName('name').text), ['before', 'selected', 'after']);
  assert.equal(attributes[0].childForFieldName('value').type, 'number');
  assert.equal(attributes[2].childForFieldName('value').type, 'variable');
  const selected = attributes[1];
  const wrapped = selected.childForFieldName('value');
  const expression = wrapped.childForFieldName('value');
  assert.equal(wrapped.type, 'output');
  assert.equal(expression.type, 'binary_expression');
  assert.deepEqual([expression.childForFieldName('left').text, expression.childForFieldName('right').text], ['$x', '$y']);
  assert.deepEqual([wrapped.startIndex, wrapped.endIndex], [source.indexOf('{$x'), source.indexOf('} after') + 1]);
  assert.deepEqual([expression.startIndex, expression.endIndex], [source.indexOf('$x +'), source.indexOf('} after')]);
  assert.deepEqual([selected.startIndex, selected.endIndex], [source.indexOf('selected'), source.indexOf(' after')]);
  assert.equal(root.namedChildren[1].text, '{$after}');

  const directRoot = parser().parse('{widget selected=$x}{$after}').rootNode;
  const direct = directRoot.namedChildren[0].namedChildren.find(child => child.type === 'attribute');
  assert.equal(direct.childForFieldName('value').type, 'variable');
  assert.equal(direct.childForFieldName('value').text, '$x');
  assert.equal(directRoot.namedChildren[1].text, '{$after}');
});

test('Rejected leading whitespace in a braced attribute value keeps following output', () => {
  const source = '{widget value={ $x}}{$after}';
  const recorded = reference(source);
  assert.match(recorded.error ?? '', /Unexpected " "/);
  const compiled = fullEngine(source, {mode: 'compile'});
  assert.equal(compiled.error.type, 'Smarty\\CompilerException');
  assert.match(compiled.error.message, /Unexpected " "/);
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  const malformed = root.namedChild(0);
  assert.equal(malformed.type, 'ERROR');
  assert.equal(malformed.isError, true);
  assert.deepEqual([malformed.startIndex, malformed.endIndex], [0, 14]);
  assert.equal(source.slice(malformed.startIndex, malformed.endIndex), '{widget value=');
  assert.deepEqual(malformed.namedChildren.map(node => node.type), ['identifier', 'identifier']);
  assert.deepEqual(malformed.namedChildren.map(node => [node.startIndex, node.endIndex, node.text]), [
    [1, 7, 'widget'], [8, 13, 'value'],
  ]);

  const remainder = root.namedChild(1);
  assert.equal(remainder.type, 'text');
  assert.deepEqual([remainder.startIndex, remainder.endIndex], [14, 20]);
  assert.equal(source.slice(remainder.startIndex, remainder.endIndex), '{ $x}}');
  const after = root.namedChild(2);
  assert.equal(after.type, 'output');
  assert.deepEqual([after.startIndex, after.endIndex], [20, 28]);
  assert.equal(source.slice(after.startIndex, after.endIndex), '{$after}');
  assert.equal(after.hasError, false);
});

test('Malformed wrapped value and incomplete outer tag retain neighboring output', () => {
  for (const source of ['{widget value={$x + }}{$after}', '{widget value={$x}{$after}']) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, true, root.toString());
    assert.equal(root.namedChildren.at(-1).type, 'output', root.toString());
    assert.equal(root.namedChildren.at(-1).text, '{$after}');
    assert.equal(root.namedChildren.at(-1).hasError, false);
  }
  const malformed = parser().parse('{widget value={$x + }}{$after}').rootNode;
  const tag = malformed.namedChildren[0];
  assert.equal(tag.type, 'custom_tag', malformed.toString());
  const attribute = tag.namedChildren.find(child => child.type === 'attribute');
  const wrapped = attribute.childForFieldName('value');
  assert.equal(wrapped.type, 'output');
  assert.equal(wrapped.hasError, true);
  assert.ok(wrapped.descendantsOfType('ERROR').length > 0, wrapped.toString());

  const incomplete = parser().parse('{widget value={$x}{$after}').rootNode;
  assert.equal(incomplete.namedChildren[0].type, 'custom_tag', incomplete.toString());
  assert.ok(incomplete.namedChildren[0].children.some(child => child.isMissing && child.type === '}'));
});

test('Incomplete braced value in if keeps local tag recovery, block closer, and root sibling', () => {
  const source = '{if true}{widget value={$x}{/if}{$after}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  const block = root.namedChildren[0];
  assert.equal(block.type, 'if_block', root.toString());
  assert.deepEqual(block.namedChildren.map(child => child.type), ['if_tag', 'custom_tag', 'if_close_tag']);
  const tag = block.namedChildren[1];
  assert.ok(tag.children.some(child => child.isMissing && child.type === '}'), tag.toString());
  const attribute = tag.namedChildren.find(child => child.type === 'attribute');
  assert.equal(attribute.childForFieldName('value').type, 'output');
  assert.equal(attribute.childForFieldName('value').childForFieldName('value').type, 'variable');
  assert.equal(root.namedChildren[1].type, 'output');
  assert.equal(root.namedChildren[1].text, '{$after}');
});

test('Editing a named attribute across direct, wrapped, rejected, and restored values matches fresh parse', () => {
  const parserInstance = parser();
  let source = '{widget value=$x}{$after}';
  let tree = parserInstance.parse(source);
  for (const [from, to] of [
    ['value=$x', 'value={$x}'],
    ['value={$x}', 'value={ $x}'],
    ['value={ $x}', 'value={$x}'],
    ['value={$x}', 'value=$x'],
  ]) {
    const start = source.indexOf(from);
    const next = source.slice(0, start) + to + source.slice(start + from.length);
    tree.edit({
      startIndex: start, oldEndIndex: start + from.length, newEndIndex: start + to.length,
      startPosition: { row: 0, column: start }, oldEndPosition: { row: 0, column: start + from.length },
      newEndPosition: { row: 0, column: start + to.length },
    });
    tree = parserInstance.parse(next, tree);
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode), next);
    assert.equal(tree.rootNode.namedChildren.at(-1).text, '{$after}');
    source = next;
  }
});
