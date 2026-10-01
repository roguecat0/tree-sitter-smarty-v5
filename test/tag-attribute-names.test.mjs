import assert from 'node:assert/strict';
import { fixtures, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('tag-attribute-names.txt');
for (const { name, source } of examples) {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, `${name}: ${root.toString()}`);
  const expected = reference(source);
  assert.equal(expected.error, null, `${name}: Smarty rejected fixture`);
  assert.deepEqual(expected.events, [{
    kind: 'tag', name: 'widget', arguments: [
      { name: 'class' }, { name: 'data-id' }, { name: 'aria-label' },
      { name: 'foo:bar' }, { name: '123data-id' },
    ],
  }], `${name}: preserve ordered attribute names`);
}

const colonExamples = [
  ['{widget foo:bar:baz=MODE}{$later}', 'foo:bar:baz', 8, 19],
];
for (const [source, nameText, startIndex, endIndex] of colonExamples) {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const attribute = root.namedChildren[0].namedChildren.find(node => node.type === 'attribute');
  const name = attribute.childForFieldName('name');
  assert.equal(name.type, 'tag_attribute_name');
  assert.equal(name.text, nameText);
  assert.deepEqual([name.startIndex, name.endIndex, source.slice(name.startIndex, name.endIndex)], [
    startIndex, endIndex, nameText,
  ]);
  assert.equal(root.namedChildren.at(-1).type, 'output');
  const expected = reference(source);
  assert.equal(expected.error, null, `${source}: Smarty rejected fixture`);
  assert.deepEqual(expected.events, [
    { kind: 'tag', name: 'widget', arguments: [{ name: nameText }] },
    { kind: 'output' },
  ]);
}

const repeatedColonExamples = [
  [
    '{widget foo:=MODE}{$later}',
    [{ kind: 'tag', name: 'widget', arguments: [{ name: 'foo:' }] }, { kind: 'output' }],
    ['ERROR', 'output'],
  ],
  [
    '{widget foo::bar=MODE}{$later}',
    [{ kind: 'tag', name: 'widget', arguments: [{ name: 'foo::bar' }] }, { kind: 'output' }],
    ['ERROR', 'output'],
  ],
  [
    '{widget foo::bar = MODE data-id = "x"}{$later}',
    [{ kind: 'tag', name: 'widget', arguments: [{ name: 'foo::bar' }, { name: 'data-id' }] }, { kind: 'output' }],
    ['ERROR', 'text', 'output'],
  ],
];
for (const [source, events, nodeTypes] of repeatedColonExamples) {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.deepEqual(root.namedChildren.map(node => node.type), nodeTypes);
  assert.equal(root.namedChildren.at(-1).type, 'output');
  assert.equal(root.descendantsOfType('tag_attribute_name').some(node => node.text.includes('::')), false);
  assert.deepEqual(reference(source).error, null);
  assert.deepEqual(reference(source).events, events);
}

const malformedTrailingColonSource = '{widget foo:}{$later}';
const malformedTrailingColon = parser().parse(malformedTrailingColonSource).rootNode;
assert.equal(malformedTrailingColon.hasError, true, malformedTrailingColon.toString());
assert.deepEqual(malformedTrailingColon.namedChildren.map(node => node.type), ['ERROR', 'output']);
assert.match(reference(malformedTrailingColonSource).error, /Unexpected ":"/);

const mixed = parser().parse(examples[0].source).rootNode.namedChildren[0];
const attributes = mixed.namedChildren.filter(node => node.type === 'attribute');
assert.deepEqual(attributes.map(node => [
  node.childForFieldName('name').type,
  node.childForFieldName('name').text,
  node.childForFieldName('value').type,
]), [
  ['identifier', 'class', 'string'],
  ['tag_attribute_name', 'data-id', 'string'],
  ['tag_attribute_name', 'aria-label', 'variable'],
  ['tag_attribute_name', 'foo:bar', 'identifier'],
  ['tag_attribute_name', '123data-id', 'parenthesized_expression'],
]);
assert.deepEqual(attributes.map(node => {
  const name = node.childForFieldName('name');
  return [name.startIndex, name.endIndex, examples[0].source.slice(name.startIndex, name.endIndex)];
}), [
  [8, 13, 'class'], [20, 27, 'data-id'], [32, 42, 'aria-label'],
  [50, 57, 'foo:bar'], [63, 73, '123data-id'],
]);

const expressionName = parser().parse('{$data-id}').rootNode;
assert.equal(expressionName.hasError, false, expressionName.toString());
assert.equal(expressionName.descendantsOfType('tag_attribute_name').length, 0);
assert.equal(expressionName.descendantsOfType('binary_expression').length, 1);

const malformedSource = 'before {widget data-id=} {*after*} {$later}';
const malformed = parser().parse(malformedSource).rootNode;
assert.equal(malformed.hasError, true, malformed.toString());
assert.deepEqual(malformed.namedChildren.map(node => node.type), ['text', 'custom_tag', 'text', 'comment', 'text', 'output']);
assert.deepEqual(malformed.namedChildren.filter(node => ['custom_tag', 'comment', 'output'].includes(node.type)).map(node => node.type), ['custom_tag', 'comment', 'output']);
assert.equal(malformed.namedChildren[1].namedChildren[1].childForFieldName('name').text, 'data-id');
assert.equal(malformed.namedChildren[1].hasError, true);
assert.match(reference('{widget data-id=}').error, /Syntax error|Unexpected/);

const editParser = parser();
let source = '{widget data="x"}{$after}';
let tree = editParser.parse(source);
const editIndex = source.indexOf('=');
source = source.slice(0, editIndex) + '-id' + source.slice(editIndex);
tree.edit({
  startIndex: editIndex, oldEndIndex: editIndex, newEndIndex: editIndex + 3,
  startPosition: { row: 0, column: editIndex },
  oldEndPosition: { row: 0, column: editIndex },
  newEndPosition: { row: 0, column: editIndex + 3 },
});
const edited = editParser.parse(source, tree);
const fresh = parser().parse(source);
assert.equal(edited.rootNode.hasError, false, edited.rootNode.toString());
assert.deepEqual(snapshot(edited.rootNode), snapshot(fresh.rootNode));
const editedAttribute = edited.rootNode.namedChildren[0].namedChildren[1];
assert.equal(editedAttribute.childForFieldName('name').type, 'tag_attribute_name');
assert.equal(editedAttribute.childForFieldName('name').text, 'data-id');
