import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const referenceCases = fixtures('smarty-reference.txt').filter(({ name }) => name.startsWith('smarty-5.8.4-literal-'));
const referenceNames = [
  'smarty-5.8.4-literal-opaque-output',
  'smarty-5.8.4-literal-nested-markers',
  'smarty-5.8.4-literal-official-js-braces',
];
assert.deepEqual(referenceCases.map(({ name }) => name), referenceNames);

const treeCases = fixtures('literal-blocks.txt');
assert.deepEqual(treeCases.map(({ name }) => name), [
  'literal-empty', 'literal-css-braces-and-quotes', 'literal-apparent-syntax-and-false-closes',
  'literal-opener-whitespace-and-case', 'literal-composition-if-foreach',
]);

test('Smarty 5.8.4 reference literal cases keep body syntax opaque and resume afterward', () => {
  const engineInputs = [
    ['{literal}<b>{$name}</b>{/literal}{$after}', { name: 'x', after: 'ok' }, '<b>{$name}</b>ok'],
    ['{literal}a{literal}b{/literal}c{/literal}{$after}', { after: 'ok' }, 'a{literal}b{/literal}cok'],
    ["{literal}function myBar {alert('Bar!');}{/literal}{$after}", { after: 'ok' }, "function myBar {alert('Bar!');}ok"],
  ];

  for (let i = 0; i < referenceCases.length; i++) {
    const { name, source } = referenceCases[i];
    const recorded = reference(source);
    const rendered = fullEngine(engineInputs[i][0], { values: engineInputs[i][1] });
    const root = parser().parse(source).rootNode;
    assert.equal(recorded.version, '5.8.4');
    assert.equal(recorded.error, null, `${name}: ${JSON.stringify(recorded.error)}`);
    assert.deepEqual(observations(root), recorded.events, name);
    assert.equal(rendered.version, '5.8.4');
    assert.equal(rendered.error, null, `${name}: ${JSON.stringify(rendered.error)}`);
    assert.equal(rendered.result, engineInputs[i][2], name);
    assert.equal(root.hasError, false, `${name}: ${root.toString()}`);
    assert.equal(root.namedChildren[0].type, 'literal_block');
    const block = root.namedChildren[0];
    const body = block.childForFieldName('content');
    if (body) {
      assert.equal(source.slice(body.startIndex, body.endIndex), body.text, name);
      assert.equal(block.text.slice(block.namedChildren.find(child => child.type === 'literal_tag').endIndex - block.startIndex,
        block.namedChildren.find(child => child.type === 'literal_close_tag').startIndex - block.startIndex), body.text, name);
    }
    if (i !== 1) assert.equal(root.namedChildren.at(-1).type, 'output', name);
  }

  const nested = referenceCases[1];
  const body = parser().parse(nested.source).rootNode.namedChildren[0].childForFieldName('content');
  assert.equal(body.text, 'a{literal}b{/literal}c');
  assert.deepEqual(referenceCases.map(({ source }) => observations(parser().parse(source).rootNode)), [
    [{ kind: 'output' }], [], [{ kind: 'output' }],
  ]);
});

test('literal task trees preserve exact body bytes and composition boundaries', () => {
  for (const { name, source } of treeCases) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, `${name}: ${root.toString()}`);
    assert.equal(root.toString(), expectedTrees[name], name);
    const blocks = root.descendantsOfType('literal_block');
    assert.equal(blocks.length, 1, name);
    const block = blocks[0];
    const open = block.namedChildren.find(child => child.type === 'literal_tag');
    const close = block.namedChildren.find(child => child.type === 'literal_close_tag');
    assert.equal(source.slice(block.startIndex, open.endIndex), open.text, `${name} opener range`);
    assert.equal(source.slice(close.startIndex, block.endIndex), close.text, `${name} closer range`);
    const content = block.childForFieldName('content');
    if (content) {
      assert.equal(source.slice(content.startIndex, content.endIndex), content.text, `${name} body range`);
      assert.equal(source.slice(open.endIndex, close.startIndex), content.text, `${name} exact body`);
    } else {
      assert.equal(open.endIndex, close.startIndex, `${name} empty body`);
    }
  }
  const composed = parser().parse(treeCases.at(-1).source).rootNode;
  assert.equal(composed.descendantsOfType('output').length, 1);
  assert.equal(composed.descendantsOfType('literal_content')[0].text, '<b>{$item}</b>');
});

const expectedTrees = {
  'literal-empty': '(source_file (literal_block (literal_tag) (literal_close_tag)))',
  'literal-css-braces-and-quotes': '(source_file (literal_block (literal_tag) content: (literal_content) (literal_close_tag)))',
  'literal-apparent-syntax-and-false-closes': '(source_file (literal_block (literal_tag) content: (literal_content) (literal_close_tag)))',
  'literal-opener-whitespace-and-case': '(source_file (literal_block (literal_tag) content: (literal_content) (literal_close_tag)))',
  'literal-composition-if-foreach': '(source_file (if_block (if_tag condition: (variable name: (identifier))) (foreach_block (foreach_tag source: (variable name: (identifier)) item: (variable name: (identifier))) (literal_block (literal_tag) content: (literal_content) (literal_close_tag)) (output value: (variable name: (identifier))) (foreach_close_tag)) (if_close_tag)))',
};

test('literal content preserves LF, CRLF, and raw bytes exactly', () => {
  for (const source of [
    '{literal}a\nb{*x*}{$v}{/literal}',
    '{literal}a\r\nb{*x*}{$v}{/literal}',
    '{literal}\t{} } " \' {if $x}\n{/literal}',
  ]) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const block = root.namedChildren[0];
    const body = block.childForFieldName('content');
    const open = block.namedChildren.find(child => child.type === 'literal_tag');
    const close = block.namedChildren.find(child => child.type === 'literal_close_tag');
    assert.equal(body.text, source.slice(open.endIndex, close.startIndex));
    assert.equal(body.startIndex, open.endIndex);
    assert.equal(body.endIndex, close.startIndex);
  }
});

test('opener spacing is accepted, while close spacing and separated names do not close', () => {
  for (const source of ['{literal   }A{/literal}', '{LiTeRaL }A{/lItErAl}']) {
    const result = fullEngine(source);
    assert.equal(result.version, '5.8.4');
    assert.equal(result.error, null, JSON.stringify(result.error));
    assert.equal(result.result, 'A');
  }
  for (const source of ['{literal}A{/literal   }', '{literal}A{/ literal}']) {
    const result = fullEngine(source);
    assert.equal(result.version, '5.8.4');
    assert.match(result.error?.message ?? '', /missing or misspelled literal closing tag/i);
  }
  const separatedOpener = fullEngine('{ literal}A{/literal}');
  assert.match(separatedOpener.error?.message ?? '', /unknown tag|unexpected/i);
  const lookalike = '{literal}A{/literalty}B{/literal}';
  const lookalikeRendered = fullEngine(lookalike);
  assert.equal(lookalikeRendered.error, null);
  assert.equal(lookalikeRendered.result, 'A{/literalty}B');
});

test('unclosed and standalone markers recover without treating a close as a generic tag', () => {
  const unclosedSource = '{literal}raw {$x}';
  const unclosed = parser().parse(unclosedSource).rootNode;
  assert.equal(unclosed.hasError, true, unclosed.toString());
  assert.equal(unclosed.descendantsOfType('literal_tag').length, 1);
  assert.equal(unclosed.descendantsOfType('literal_content').length, 1);
  assert.equal(unclosed.descendantsOfType('output').length, 0);
  const unclosedEngine = fullEngine(unclosedSource, { mode: 'compile' });
  assert.equal(unclosedEngine.version, '5.8.4');
  assert.match(unclosedEngine.error?.message ?? '', /missing or misspelled literal closing tag/i);

  const standaloneSource = '{/literal}{$after}';
  const standalone = parser().parse(standaloneSource).rootNode;
  assert.equal(standalone.descendantsOfType('custom_close_tag').length, 0);
  assert.equal(standalone.namedChildren[0].type, 'stray_literal_close', standalone.toString());
  assert.equal(standalone.descendantsOfType('output').length, 1, standalone.toString());
  const full = fullEngine(standaloneSource, { mode: 'compile' });
  assert.equal(full.version, '5.8.4');
  assert.ok(full.error, 'standalone literal closer is rejected by Smarty');
});

test('incremental close removal, restoration, and false-close repair match fresh parses', () => {
  const p = parser();
  const source = '{literal}{$raw}{/literal}{$after}';
  const tree = p.parse(source);
  const closerStart = source.indexOf('{/literal}');
  const missingClose = source.slice(0, closerStart) + source.slice(closerStart + '{/literal}'.length);
  tree.edit({ startIndex: closerStart, oldEndIndex: closerStart + 10, newEndIndex: closerStart,
    startPosition: { row: 0, column: closerStart }, oldEndPosition: { row: 0, column: closerStart + 10 }, newEndPosition: { row: 0, column: closerStart } });
  const removed = p.parse(missingClose, tree);
  assert.deepEqual(snapshot(removed.rootNode), snapshot(p.parse(missingClose).rootNode));
  assert.equal(removed.rootNode.hasError, true);

  const restoredTree = removed;
  restoredTree.edit({ startIndex: closerStart, oldEndIndex: closerStart, newEndIndex: closerStart + 10,
    startPosition: { row: 0, column: closerStart }, oldEndPosition: { row: 0, column: closerStart }, newEndPosition: { row: 0, column: closerStart + 10 } });
  const restored = p.parse(source, restoredTree);
  assert.deepEqual(snapshot(restored.rootNode), snapshot(p.parse(source).rootNode));
  assert.equal(restored.rootNode.hasError, false);
  assert.equal(restored.rootNode.descendantsOfType('output').length, 1);

  const falseSource = '{literal}{$raw}{/literalty}{$after}';
  const fixedSource = '{literal}{$raw}{/literal}{$after}';
  const falseTree = p.parse(falseSource);
  const editStart = falseSource.indexOf('literalty');
  falseTree.edit({ startIndex: editStart, oldEndIndex: editStart + 'literalty'.length,
    newEndIndex: editStart + 'literal'.length,
    startPosition: { row: 0, column: editStart }, oldEndPosition: { row: 0, column: editStart + 'literalty'.length },
    newEndPosition: { row: 0, column: editStart + 'literal'.length } });
  const repaired = p.parse(fixedSource, falseTree);
  const fresh = p.parse(fixedSource);
  assert.deepEqual(snapshot(repaired.rootNode), snapshot(fresh.rootNode));
  assert.equal(repaired.rootNode.hasError, false);
  assert.equal(repaired.rootNode.descendantsOfType('output').length, 1);
});
