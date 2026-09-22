import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('config-variables.txt');
assert.equal(examples.length, 6);
for (const { name, source } of examples) {
  test(`Config reference: ${name}`, () => {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const expected = reference(source);
    assert.equal(expected.error, null);
    assert.deepEqual(observations(root), expected.events);
  });
}
test('Config name retains exact range and spelling', () => {
  const node = parser().parse('{#title#}').rootNode.firstNamedChild.childForFieldName('value');
  assert.equal(node.type, 'config_variable');
  assert.equal(node.text, '#title#');
  const name = node.childForFieldName('name');
  assert.equal(name.text, 'title');
  assert.deepEqual([name.startIndex, name.endIndex], [2, 7]);
});
test('Config malformed delimiters and internal whitespace are rejected', () => {
  for (const source of ['{#title}', '{# title#}', '{#title #}']) {
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
    assert.match(reference(source).error, /Syntax error/);
  }
});
test('Config terminator deletion and repair match fresh trees', () => {
  const p = parser();
  let tree = p.parse('{#title#}');
  for (const [source, oldEndIndex, newEndIndex, error] of [['{#title}', 8, 7, true], ['{#title#}', 7, 8, false]]) {
    tree.edit({startIndex: 7, oldEndIndex, newEndIndex,
      startPosition: {row: 0, column: 7}, oldEndPosition: {row: 0, column: oldEndIndex}, newEndPosition: {row: 0, column: newEndIndex}});
    tree = p.parse(source, tree);
    assert.equal(tree.rootNode.hasError, error);
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(source).rootNode));
  }
});
