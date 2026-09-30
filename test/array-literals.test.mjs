import assert from 'node:assert/strict';
import { fixtures, observations, parser, reference, snapshot } from './helpers.mjs';

const parse = source => parser().parse(source);

for (const { name, source } of fixtures('array-literals.txt')) {
  const tree = parse(source);
  assert.equal(tree.rootNode.hasError, false, `${name}: ${tree.rootNode.toString()}`);
  const expected = reference(source);
  assert.equal(expected.error, null, `${name}: Smarty rejected fixture`);
  assert.deepEqual(observations(tree.rootNode), expected.events, `${name}: Smarty event projection`);
}

const keyed = parse('{["x"=>1, name=>[$v, array(2,)],]}').rootNode;
assert.equal(keyed.hasError, false, keyed.toString());
const array = keyed.descendantsOfType('array_literal')[0];
assert.deepEqual(array.namedChildren.map(node => node.type), ['array_element', 'array_element']);
assert.equal(array.namedChildren[0].childForFieldName('key')?.text, '"x"');
assert.equal(array.namedChildren[0].childForFieldName('value')?.text, '1');
assert.equal(array.namedChildren[1].childForFieldName('key')?.text, 'name');
assert.equal(array.namedChildren[1].childForFieldName('value')?.type, 'array_literal');
assert.equal(array.startIndex, 1);
assert.equal(array.endIndex, keyed.text.length - 1);
assert.deepEqual(array.children.filter(node => !node.isNamed).map(node => node.text), ['[', ',', ',', ']']);

const arrayCallSource = '{$user->find(array(10, 20,))}';
const arrayCallRoot = parse(arrayCallSource).rootNode;
assert.equal(arrayCallRoot.hasError, false, arrayCallRoot.toString());
const arrayCall = arrayCallRoot.descendantsOfType('array_literal')[0];
const arrayCallStart = arrayCallSource.indexOf('array(');
const arrayCallEnd = arrayCallSource.indexOf(')', arrayCallStart) + 1;
assert.deepEqual([arrayCall.startIndex, arrayCall.endIndex], [arrayCallStart, arrayCallEnd]);
assert.deepEqual(arrayCall.children.filter(node => !node.isNamed).map(node => node.text),
  ['array', '(', ',', ',', ')']);
assert.deepEqual(arrayCall.namedChildren.map(node => [node.type, node.text, node.startIndex, node.endIndex]), [
  ['array_element', '10', arrayCallSource.indexOf('10'), arrayCallSource.indexOf('10') + 2],
  ['array_element', '20', arrayCallSource.indexOf('20'), arrayCallSource.indexOf('20') + 2],
]);

const parenthesizedKey = parse('{[($x+1)=>"v"]}').rootNode;
assert.equal(parenthesizedKey.hasError, false, parenthesizedKey.toString());
const compound = parenthesizedKey.descendantsOfType('array_element')[0].childForFieldName('key');
assert.equal(compound.type, 'parenthesized_expression');
assert.equal(compound.firstNamedChild.childForFieldName('operator').text, '+');

const compoundKey = parse('{[$x+1=>"v"]}').rootNode;
assert.equal(compoundKey.hasError, true, compoundKey.toString());
assert.ok(reference('{[$x+1=>"v"]}').error);
assert.equal(compoundKey.descendantsOfType('array_element').some(node => node.childForFieldName('key')),
  false, compoundKey.toString());

for (const source of ['{$user->find(["x"=>])}{after $value}', '{$user->find([1, 2)}{after $value}']) {
  const tree = parse(source);
  assert.equal(tree.rootNode.hasError, true, tree.rootNode.toString());
  assert.ok(reference(source).error, source);
  assert.equal(tree.rootNode.namedChildren.at(-1).type, 'custom_tag', tree.rootNode.toString());
  assert.equal(tree.rootNode.namedChildren.at(-1).childForFieldName('name').text, 'after');
}

const initialSource = '{$user->find(["x"=>1, 2])}{after $value}';
const p = parser();
let currentSource = initialSource;
let currentTree = p.parse(currentSource);
for (const [before, after] of [['"x"=>1', '"x"'], ['"x"', '"x"=>1']]) {
  const startIndex = currentSource.indexOf(before);
  const nextSource = currentSource.slice(0, startIndex) + after + currentSource.slice(startIndex + before.length);
  currentTree.edit({
    startIndex, oldEndIndex: startIndex + before.length, newEndIndex: startIndex + after.length,
    startPosition: { row: 0, column: startIndex }, oldEndPosition: { row: 0, column: startIndex + before.length },
    newEndPosition: { row: 0, column: startIndex + after.length },
  });
  currentTree = p.parse(nextSource, currentTree);
  assert.deepEqual(snapshot(currentTree.rootNode), snapshot(parse(nextSource).rootNode));
  assert.equal(currentTree.rootNode.hasError, false, currentTree.rootNode.toString());
  assert.equal(currentTree.rootNode.namedChildren.at(-1).childForFieldName('name').text, 'after');
  currentSource = nextSource;
}

const closingSource = '{$user->find([1])}{after $value}';
let closeSource = closingSource;
const closeParser = parser();
let closeTree = closeParser.parse(closeSource);
const closeIndex = closingSource.indexOf(']');
for (const [before, after, hasError] of [[']', '', true], ['', ']', false]]) {
  const startIndex = before ? closeSource.indexOf(before) : closeIndex;
  const nextSource = closeSource.slice(0, startIndex) + after + closeSource.slice(startIndex + before.length);
  closeTree.edit({
    startIndex, oldEndIndex: startIndex + before.length, newEndIndex: startIndex + after.length,
    startPosition: { row: 0, column: startIndex }, oldEndPosition: { row: 0, column: startIndex + before.length },
    newEndPosition: { row: 0, column: startIndex + after.length },
  });
  closeTree = closeParser.parse(nextSource, closeTree);
  assert.deepEqual(snapshot(closeTree.rootNode), snapshot(parse(nextSource).rootNode));
  assert.equal(closeTree.rootNode.hasError, hasError, closeTree.rootNode.toString());
  assert.equal(closeTree.rootNode.namedChildren.at(-1).childForFieldName('name').text, 'after');
  closeSource = nextSource;
}
