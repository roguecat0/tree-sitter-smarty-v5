import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('smarty-reference.txt');
assert.equal(examples.length, 7);

for (const { name, source } of examples) {
  test(`Default auto-literal Smarty 5.8.4: ${name}`, () => {
    const rendered = fullEngine(source);
    const recorded = reference(source);
    assert.equal(rendered.version, '5.8.4');
    assert.equal(recorded.version, '5.8.4');
    assert.equal(rendered.error, null, `${name}: ${JSON.stringify(rendered.error)}`);
    assert.equal(recorded.error, null, `${name}: ${JSON.stringify(recorded.error)}`);
    const expected = name === 'auto-literal-active-tag-right-whitespace'
      ? { result: 'Y', events: [{ kind: 'tag', name: 'if', arguments: [] }, { kind: 'tag', name: 'ifclose', arguments: [] }] }
      : name === 'auto-literal-html-script-composition'
        ? { result: '<script>const x = { foo: 1 };</script>Y<script>if (x) { go(); }</script>', events: [{ kind: 'tag', name: 'if', arguments: [] }, { kind: 'tag', name: 'ifclose', arguments: [] }] }
        : { result: source, events: [] };
    assert.equal(rendered.result, expected.result);
    assert.deepEqual(recorded.events, expected.events);

    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, `${name}: ${root.toString()}`);
    if (name === 'auto-literal-html-script-composition') {
      assert.equal(root.namedChildren.length, 3, root.toString());
      assert.equal(root.namedChildren[0].type, 'text');
      assert.equal(root.namedChildren[0].text, '<script>const x = { foo: 1 };</script>');
      assert.equal(root.namedChildren[1].type, 'if_block');
      assert.equal(root.namedChildren[2].type, 'text');
      assert.equal(root.namedChildren[2].text, '<script>if (x) { go(); }</script>');
    }
  });
}

test('PCRE whitespace after the opening brace stays literal', () => {
  const source = 'A {\ffoo } B';
  const rendered = fullEngine(source);
  const recorded = reference(source);
  assert.equal(rendered.version, '5.8.4');
  assert.equal(rendered.error, null);
  assert.equal(rendered.result, source);
  assert.equal(recorded.version, '5.8.4');
  assert.deepEqual(recorded.events, []);
  const root = parser().parse(source).rootNode;
  assert.equal(root.toString(), '(source_file (text))');
  assert.equal(root.hasError, false);
});

test('Active unknown tag changes to literal text after one opening-boundary space', () => {
  const before = 'A {foo} B';
  const after = 'A { foo} B';
  const p = parser();
  const tree = p.parse(before);
  assert.equal(tree.rootNode.toString(), '(source_file (text) (custom_tag name: (identifier)) (text))');
  assert.equal(tree.rootNode.hasError, false);
  const beforeEngine = fullEngine(before);
  const beforeReference = reference(before);
  assert.equal(beforeEngine.version, '5.8.4');
  assert.equal(beforeReference.version, '5.8.4');
  assert.equal(beforeEngine.error?.type, 'Smarty\\CompilerException');
  assert.equal(beforeEngine.error.message, 'Syntax error in template "string:A {foo} B"  on line 1 "A {foo} B" unknown tag \'foo\'');
  assert.deepEqual(beforeReference.events, [{ kind: 'tag', name: 'foo', arguments: [] }]);
  assert.equal(beforeReference.error, null);

  const rightSpace = 'A {foo } B';
  const rightSpaceEngine = fullEngine(rightSpace);
  const rightSpaceReference = reference(rightSpace);
  assert.equal(rightSpaceEngine.version, '5.8.4');
  assert.equal(rightSpaceEngine.error?.type, 'Smarty\\CompilerException');
  assert.equal(rightSpaceEngine.error.message, 'Syntax error in template "string:A {foo } B"  on line 1 "A {foo } B" unknown tag \'foo\'');
  assert.equal(rightSpaceReference.version, '5.8.4');
  assert.deepEqual(rightSpaceReference.events, [{ kind: 'tag', name: 'foo', arguments: [] }]);
  assert.equal(rightSpaceReference.error, null);

  const index = before.indexOf('{foo}') + 1;
  tree.edit({ startIndex: index, oldEndIndex: index, newEndIndex: index + 1,
    startPosition: { row: 0, column: index }, oldEndPosition: { row: 0, column: index }, newEndPosition: { row: 0, column: index + 1 } });
  const edited = p.parse(after, tree);
  const fresh = p.parse(after);
  assert.equal(edited.rootNode.toString(), '(source_file (text))');
  assert.equal(edited.rootNode.hasError, false);
  assert.deepEqual(snapshot(edited.rootNode), snapshot(fresh.rootNode));
  const afterEngine = fullEngine(after);
  const afterReference = reference(after);
  assert.equal(afterEngine.version, '5.8.4');
  assert.equal(afterReference.version, '5.8.4');
  assert.equal(afterEngine.error, null);
  assert.equal(afterEngine.result, after);
  assert.equal(afterReference.error, null);
  assert.deepEqual(afterReference.events, []);
});

test('Unclosed active block remains an error and preserves a later output', () => {
  const source = '{if true }Y{$ok}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.toString(), '(source_file (ERROR (if_tag condition: (boolean)) (text) (output value: (variable name: (identifier)))))');
  assert.equal(root.hasError, true);
  assert.equal(root.descendantsOfType('output').length, 1);
  assert.equal(root.descendantsOfType('variable').at(-1).text, '$ok');
  const rendered = fullEngine(source, { mode: 'compile' });
  const recorded = reference(source);
  assert.equal(rendered.version, '5.8.4');
  assert.equal(recorded.version, '5.8.4');
  assert.equal(rendered.error?.type, 'Smarty\\CompilerException');
  assert.match(rendered.error.message, /unclosed/i);
  assert.equal(recorded.error, null);
  assert.deepEqual(recorded.events.map(event => event.kind === 'tag' ? event.name : event.kind), ['if', 'output']);
});
