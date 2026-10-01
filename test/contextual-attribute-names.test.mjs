import assert from 'node:assert/strict';
import { fixtures, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('contextual-attribute-names.txt');
for (const { name, source } of examples.slice(0, 2)) {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, `${name}: ${root.toString()}`);
  const expected = reference(source);
  assert.equal(expected.error, null, `${name}: pinned Smarty rejected fixture`);
  assert.deepEqual(observations(root), expected.events, `${name}: ordered reference events`);

  const tag = root.namedChildren[0];
  const attributes = tag.namedChildren.filter(node => node.type === 'attribute');
  const wantedNames = name === 'Reserved words in generic attributes'
    ? ['parent', 'self', 'if', 'else', 'elseif', 'foreach', 'foreachelse']
    : ['file', 'block', 'parent', 'self'];
  assert.deepEqual(attributes.map(attribute => attribute.childForFieldName('name').text), wantedNames);
  let rangeCursor = source.indexOf('{') + 1;
  for (const [index, attribute] of attributes.entries()) {
    const nameNode = attribute.childForFieldName('name');
    const expectedStart = source.indexOf(wantedNames[index], rangeCursor);
    assert.equal(nameNode.type, 'identifier');
    assert.deepEqual(source.slice(nameNode.startIndex, nameNode.endIndex), nameNode.text);
    assert.deepEqual([nameNode.startIndex, nameNode.endIndex], [expectedStart, expectedStart + nameNode.text.length]);
    rangeCursor = nameNode.endIndex;
  }
  assert.equal(root.namedChildren.at(-1).type, 'output');
  assert.equal(root.namedChildren.at(-1).text, '{$later}');
}

const mixedCaseSource = '{widget Parent=$parent SELF=$receiver}{$later}';
const mixedCase = parser().parse(mixedCaseSource).rootNode;
assert.equal(mixedCase.hasError, false, mixedCase.toString());
assert.equal(reference(mixedCaseSource).error, null);
assert.deepEqual(observations(mixedCase), reference(mixedCaseSource).events);
assert.deepEqual(mixedCase.firstNamedChild.namedChildren.filter(node => node.type === 'attribute').map(attribute => {
  const name = attribute.childForFieldName('name');
  return [name.type, name.text, name.startIndex, name.endIndex];
}), [['identifier', 'Parent', 8, 14], ['identifier', 'SELF', 23, 27]]);

const primitiveSource = '{widget class="x" true=true false=false null=null}{$later}';
const primitiveRoot = parser().parse(primitiveSource).rootNode;
assert.equal(primitiveRoot.hasError, false, primitiveRoot.toString());
assert.deepEqual(observations(primitiveRoot), reference(primitiveSource).events);
assert.deepEqual(primitiveRoot.firstNamedChild.namedChildren.filter(node => node.type === 'attribute').map(attribute => [
  attribute.childForFieldName('name').type,
  attribute.childForFieldName('name').text,
  attribute.childForFieldName('value').type,
]), [
  ['identifier', 'class', 'string'],
  ['identifier', 'true', 'boolean'],
  ['identifier', 'false', 'boolean'],
  ['identifier', 'null', 'null'],
]);

for (const base of ['self', 'parent']) {
  const forms = [...base].reduce((items, letter) => items.flatMap(prefix => [prefix + letter, prefix + letter.toUpperCase()]), ['']);
  for (const spelling of forms) {
    const source = `{widget ${spelling}=$receiver}`;
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, `${spelling}: ${root.toString()}`);
    const name = root.firstNamedChild.namedChildren.find(node => node.type === 'attribute').childForFieldName('name');
    assert.deepEqual([name.type, name.text, source.slice(name.startIndex, name.endIndex)], ['identifier', spelling, spelling]);
    assert.equal(reference(source).error, null, `${spelling}: pinned Smarty rejected attribute name`);
  }
}

const malformedSource = '{widget parent=} {*after*} {$later}';
const malformed = parser().parse(malformedSource).rootNode;
assert.equal(malformed.hasError, true, malformed.toString());
assert.equal(malformed.toString(), '(source_file (custom_tag name: (identifier) (attribute name: (identifier) value: (MISSING identifier))) (text) (comment) (text) (output value: (variable name: (identifier))))');
const malformedAttribute = malformed.firstNamedChild.namedChildren.find(node => node.type === 'attribute');
assert.equal(malformedAttribute.childForFieldName('name').text, 'parent');
assert.equal(malformedAttribute.childForFieldName('value').isMissing, true);
assert.deepEqual(malformed.namedChildren.map(node => node.type), ['custom_tag', 'text', 'comment', 'text', 'output']);
assert.match(reference('{widget parent=}').error, /Syntax error|Unexpected/);

for (const source of ['{if $condition}body{/if}', '{if $condition}body{else}other{/if}']) {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  assert.equal(root.firstNamedChild.type, 'if_block');
}
for (const source of ['{self::READY}', '{parent::READY}']) {
  assert.equal(parser().parse(source).rootNode.hasError, true, source);
  assert.match(reference(source).error, /static class/);
}

const incrementalParser = parser();
let source = '{widget other=$value}{$later}';
let tree = incrementalParser.parse(source);
let currentName = 'other';
for (const nextName of ['parent', 'self', 'other']) {
  const startIndex = source.indexOf(currentName);
  const nextSource = source.slice(0, startIndex) + nextName + source.slice(startIndex + currentName.length);
  tree.edit({
    startIndex, oldEndIndex: startIndex + currentName.length, newEndIndex: startIndex + nextName.length,
    startPosition: { row: 0, column: startIndex },
    oldEndPosition: { row: 0, column: startIndex + currentName.length },
    newEndPosition: { row: 0, column: startIndex + nextName.length },
  });
  tree = incrementalParser.parse(nextSource, tree);
  const fresh = parser().parse(nextSource);
  assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
  assert.deepEqual(snapshot(tree.rootNode), snapshot(fresh.rootNode));
  const name = tree.rootNode.firstNamedChild.namedChildren.find(node => node.type === 'attribute').childForFieldName('name');
  assert.deepEqual([name.type, name.text], ['identifier', nextName]);
  source = nextSource;
  currentName = nextName;
}
