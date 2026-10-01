import assert from 'node:assert/strict';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('generic-tag-identifier-values.txt');

for (const { name, source } of examples) {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, name);
  const expected = reference(source);
  assert.equal(expected.error, null, name);
  assert.deepEqual(observations(root), expected.events, name);
}

const mixedSource = '{widget foo mode=title amount=123 enabled=true disabled=false nothing=null text="ok" current=$item type=Widget::NAME}';
const mixedRoot = parser().parse(mixedSource).rootNode;
const tag = mixedRoot.namedChildren[0];
assert.deepEqual(tag.namedChildren.map(node => node.type), [
  'identifier', 'identifier', 'attribute', 'attribute', 'attribute', 'attribute', 'attribute', 'attribute', 'attribute', 'attribute',
]);
assert.deepEqual(tag.namedChildren.slice(2).map(node => [node.childForFieldName('name').text, node.childForFieldName('value').type]), [
  ['mode', 'identifier'], ['amount', 'number'], ['enabled', 'boolean'], ['disabled', 'boolean'], ['nothing', 'null'],
  ['text', 'string'], ['current', 'variable'], ['type', 'class_constant_expression'],
]);
assert.equal(tag.namedChildren[1].text, 'foo');
assert.equal(tag.namedChildren[2].childForFieldName('value').text, 'title');

const noArgTag = parser().parse('{widget}').rootNode.firstNamedChild;
assert.equal(noArgTag.childForFieldName('name').text, 'widget');
assert.equal(noArgTag.namedChildren.length, 1);

const digitTag = parser().parse('{widget value=123foo}').rootNode.namedChildren[0];
assert.equal(digitTag.namedChildren[1].childForFieldName('value').type, 'identifier');
assert.equal(digitTag.namedChildren[1].childForFieldName('value').text, '123foo');

const block = fullEngine('{block name=title}body{/block}');
assert.equal(block.error, null);
assert.equal(block.result, 'body');
const assign = fullEngine('{assign var=x value=foo}{$x}');
assert.equal(assign.error, null);
assert.equal(assign.result, 'foo');

const malformed = parser().parse('{widget value=}tail {$after}').rootNode;
assert.equal(malformed.hasError, true);
assert.equal(parser().parse('{widget value=}').rootNode.hasError, true);
assert.equal(malformed.toString(), '(source_file (custom_tag name: (identifier) (attribute name: (identifier) value: (MISSING identifier))) (text) (output value: (variable name: (identifier))))');
const malformedTag = malformed.namedChildren[0];
assert.equal(malformedTag.type, 'custom_tag');
const missingValue = malformedTag.namedChildren[1].childForFieldName('value');
assert.equal(missingValue.type, 'identifier');
assert.equal(missingValue.isMissing, true);
assert.deepEqual(malformed.namedChildren.slice(1).map(node => node.type), ['text', 'output']);
assert.equal(reference('{widget value=}').error?.includes('Syntax error'), true);
assert.equal(reference('{widget value=}tail {$after}').error?.includes('Syntax error'), true);

const before = '{widget }{$after}';
const after = '{widget foo}{$after}';
const editParser = parser();
const edited = editParser.parse(before);
edited.edit({
  startIndex: 8, oldEndIndex: 8, newEndIndex: 11,
  startPosition: { row: 0, column: 8 }, oldEndPosition: { row: 0, column: 8 }, newEndPosition: { row: 0, column: 11 },
});
const reparsed = editParser.parse(after, edited);
assert.deepEqual(snapshot(reparsed.rootNode), snapshot(parser().parse(after).rootNode));
assert.equal(reparsed.rootNode.hasError, false);
assert.deepEqual(reparsed.rootNode.namedChildren.map(node => node.type), ['custom_tag', 'output']);
