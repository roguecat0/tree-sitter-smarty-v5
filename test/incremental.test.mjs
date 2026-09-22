import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parser, snapshot } from './helpers.mjs';

// The Node binding indexes JavaScript strings in UTF-16 code units.
function position(source, index) {
  const lines = source.slice(0, index).split('\n');
  return { row: lines.length - 1, column: lines.at(-1).length };
}

test('Incremental edits match fresh trees, including incomplete syntax and Unicode', () => {
  const incremental = parser();
  let source = 'Hé😀\n{if $ok}{widget count=2}{$a + $b * 3}{else}No{/if}';
  let tree = incremental.parse(source);
  assert.equal(tree.rootNode.hasError, false);
  const edits = [
    ['count=2', 'count=20', false],
    ['$b * 3', '$b * ', true],
    ['$b * ', '$b * 4', false],
    ['{else}No', '{elseif $other}Maybe\n{else}No', false],
    ['widget', 'unknown_widget', false],
    ['Hé😀', 'À🚂\ntext', false],
    ['{/if}', '', true],
    ['No', 'No{/if}', false],
  ];
  for (const [before, after, hasError] of edits) {
    const startIndex = source.indexOf(before);
    assert.notEqual(startIndex, -1, before);
    const oldEndIndex = startIndex + before.length;
    const next = source.slice(0, startIndex) + after + source.slice(oldEndIndex);
    const newEndIndex = startIndex + after.length;
    tree.edit({ startIndex, oldEndIndex, newEndIndex,
      startPosition: position(source, startIndex),
      oldEndPosition: position(source, oldEndIndex),
      newEndPosition: position(next, newEndIndex),
    });
    tree = incremental.parse(next, tree);
    const fresh = parser().parse(next);
    assert.equal(fresh.rootNode.hasError, hasError, next);
    assert.equal(tree.rootNode.endIndex, next.length);
    assert.deepEqual(snapshot(tree.rootNode), snapshot(fresh.rootNode), `Edit ${before} -> ${after}`);
    source = next;
  }
});
