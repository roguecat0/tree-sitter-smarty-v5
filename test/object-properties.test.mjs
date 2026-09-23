import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('object-properties.txt');
assert.equal(examples.length, 12);
for (const { name, source } of examples) {
  test(`Property reference: ${name}`, () => {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const expected = reference(source);
    assert.equal(expected.error, null);
    assert.deepEqual(observations(root), expected.events);
  });
}
test('Property chains preserve receiver and exact member names and ranges', () => {
  const root = parser().parse('{$user->profile->name}').rootNode;
  const outer = root.firstNamedChild.childForFieldName('value');
  assert.equal(outer.type, 'member_expression');
  const inner = outer.childForFieldName('object');
  assert.equal(inner.type, 'member_expression');
  assert.equal(inner.childForFieldName('object').text, '$user');
  for (const [node, text, start, end] of [[inner, 'profile', 8, 15], [outer, 'name', 17, 21]]) {
    const member = node.childForFieldName('member');
    assert.equal(member.type, 'identifier');
    assert.equal(member.text, text);
    assert.deepEqual([member.startIndex, member.endIndex], [start, end]);
  }
});
test('Property whitespace agrees with Smarty', () => {
  for (const gap of ['', ' ', '\t', '\n', '\r\n']) {
    const source = `{$user${gap}->${gap}name}`;
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, source);
    assert.equal(reference(source).error, null);
    assert.equal(root.firstNamedChild.childForFieldName('value').childForFieldName('member').text, 'name');
  }
});
test('Unknown tag and modifier names preserve property structure without plugins', () => {
  for (const name of ['a', 'long_name_927', 'Z9']) {
    const source = `{extension_${name} value=$user->name|modifier_${name}}{/different_${name}}`;
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false);
    assert.equal(root.descendantsOfType('member_expression').length, 1);
    const expected = reference(source);
    assert.equal(expected.error, null);
    assert.deepEqual(observations(root), expected.events);
  }
});
test('Unfinished properties fail and unsupported forms do not become supported accidentally', () => {
  for (const source of ['{$user->}', '{$user->profile->}']) {
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
    assert.match(reference(source).error, /Syntax error/);
  }
  for (const source of ['{$user->$name}', '{$user::name}', '{$user?.name}', '{#user#->name}', '{($user)->name}']) {
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
  }
});
test('Property chain edits break and repair the new boundary', () => {
  const p = parser();
  let source = '{$user->profile->name}';
  let tree = p.parse(source);
  for (const [before, after, error] of [['profile->name', '', true], ['', 'profile->name', false]]) {
    const startIndex = 8;
    const oldEndIndex = startIndex + before.length;
    const newEndIndex = startIndex + after.length;
    const next = source.slice(0, startIndex) + after + source.slice(oldEndIndex);
    tree.edit({startIndex, oldEndIndex, newEndIndex,
      startPosition: {row: 0, column: startIndex}, oldEndPosition: {row: 0, column: oldEndIndex}, newEndPosition: {row: 0, column: newEndIndex}});
    tree = p.parse(next, tree);
    assert.equal(tree.rootNode.hasError, error);
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode));
    source = next;
  }
});
