import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('comments.txt');
assert.equal(examples.length, 10);
for (const { name, source } of examples) {
  test(`Comment reference: ${name}`, () => {
    const root = parser().parse(source).rootNode;
    const expected = reference(source);
    // Smarty's lexer rejects a comment opener within a double-quoted tag
    // attribute. Task 047 corrects the old parser-only string expectation.
    if (name === 'Comment in a quoted value is rejected') {
      assert.match(expected.error, /Syntax error.*Unexpected/);
      assert.deepEqual(expected.events, []);
      assert.equal(root.hasError, true, root.toString());
      assert.equal(root.descendantsOfType('comment').length, 0);
    } else {
      assert.equal(root.hasError, false, root.toString());
      assert.equal(expected.error, null);
      assert.deepEqual(observations(root), expected.events);
    }
  });
}
test('Comment ranges exclude following newline; bodies have no executable nodes', () => {
  for (const newline of ['\n', '\r\n']) {
    const body = `{*helper${newline}{$ignored}{widget}{#title#}${newline}*}`;
    const root = parser().parse(`A${body}${newline}B`).rootNode;
    assert.equal(root.hasError, false);
    const comment = root.namedChildren[1];
    assert.equal(comment.type, 'comment');
    assert.equal(comment.text, body);
    assert.deepEqual([comment.startIndex, comment.endIndex], [1, 1 + body.length]);
    assert.deepEqual(comment.startPosition, {row: 0, column: 1});
    assert.deepEqual(comment.endPosition, {row: 2, column: 2});
    assert.deepEqual(comment.namedChildren, []);
    assert.equal(root.namedChildren[2].text, `${newline}B`);
    assert.deepEqual(observations(root), []);
  }
});
test('Unterminated comment preserves preceding output and rejects missing close', () => {
  const source = '{$valid}{* ignored';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true);
  assert.equal(root.firstNamedChild.type, 'output');
  assert.equal(root.firstNamedChild.text, '{$valid}');
  assert.match(reference(source).error, /missing or misspelled comment closing tag/);
});
test('Comment closing delimiter deletion and repair match fresh trees', () => {
  const p = parser();
  const prefix = '{$valid}{* {$ignored} ';
  let tree = p.parse(`${prefix}*}`);
  for (const [ending, oldLength, error] of [['', 2, true], ['*}', 0, false]]) {
    const startIndex = prefix.length;
    tree.edit({startIndex, oldEndIndex: startIndex + oldLength, newEndIndex: startIndex + ending.length,
      startPosition: {row: 0, column: startIndex}, oldEndPosition: {row: 0, column: startIndex + oldLength}, newEndPosition: {row: 0, column: startIndex + ending.length}});
    const source = prefix + ending;
    tree = p.parse(source, tree);
    assert.equal(tree.rootNode.hasError, error);
    assert.equal(tree.rootNode.firstNamedChild.text, '{$valid}');
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(source).rootNode));
  }
});
