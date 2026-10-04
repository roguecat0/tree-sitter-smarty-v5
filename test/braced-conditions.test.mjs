import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('braced-conditions.txt');
assert.equal(examples.length, 3);

test('Braced condition trees are explicit and compared with pinned compiler observations', () => {
  for (const {name, source} of examples) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, `${name}: ${root.toString()}`);
    const observed = reference(source);
    assert.equal(observed.error, null);
    assert.deepEqual(observations(root), observed.events);
    assert.equal(fullEngine(source, {mode: 'compile'}).error, null);
  }

  const source = '{if {$x} > 0}Y{/if}{$after}';
  const root = parser().parse(source).rootNode;
  const block = root.namedChild(0);
  const tag = block.namedChild(0);
  const condition = tag.childForFieldName('condition');
  const wrapper = condition.childForFieldName('left');
  assert.equal(block.type, 'if_block');
  assert.equal(condition.type, 'binary_expression');
  assert.equal(wrapper.type, 'output');
  assert.equal(wrapper.text, '{$x}');
  assert.equal(wrapper.startIndex, 4);
  assert.equal(wrapper.endIndex, 8);
  assert.equal(wrapper.childForFieldName('value').text, '$x');
  assert.equal(wrapper.childForFieldName('value').startIndex, 5);
  assert.equal(wrapper.childForFieldName('value').endIndex, 7);
  assert.equal(condition.startIndex, 4);
  assert.equal(condition.endIndex, 12);
  assert.equal(tag.startIndex, 0);
  assert.equal(tag.endIndex, 13);
  assert.equal(block.startIndex, 0);
  assert.equal(block.endIndex, 19);
  assert.equal(block.namedChild(1).text, 'Y');
  assert.equal(block.namedChild(2).text, '{/if}');
  assert.equal(root.namedChild(1).text, '{$after}');
});

test('Braced condition operands compose with shared operators and preserve branch ownership', () => {
  for (const [source, tree] of [
    ['{if {$a + 1 * 2}}Y{/if}', node => {
      const value = node.namedChild(0).namedChild(0).childForFieldName('condition').childForFieldName('value');
      assert.equal(value.type, 'binary_expression');
      assert.equal(value.childForFieldName('left').type, 'variable');
      assert.equal(value.childForFieldName('right').childForFieldName('operator').text, '*');
    }],
    ['{if {$repair->get_attachments()->count()}>0}Y{/if}', node => {
      const condition = node.namedChild(0).namedChild(0).childForFieldName('condition');
      assert.equal(condition.type, 'binary_expression');
      const value = condition.childForFieldName('left').childForFieldName('value');
      assert.equal(value.type, 'method_call_expression');
      assert.equal(value.childForFieldName('object').type, 'method_call_expression');
      assert.equal(condition.childForFieldName('operator').text, '>');
    }],
    ['{if {$x|strlen}}Y{/if}', node => {
      const value = node.namedChild(0).namedChild(0).childForFieldName('condition').childForFieldName('value');
      assert.equal(value.type, 'modifier_expression');
      assert.equal(value.childForFieldName('name').text, 'strlen');
    }],
    ['{if $ready}{elseif {$x} and $ready}Z{/if}{$after}', node => {
      const block = node.namedChild(0);
      const clause = block.namedChildren.find(child => child.type === 'elseif_clause');
      const tag = clause.namedChild(0);
      const condition = tag.childForFieldName('condition');
      assert.equal(condition.type, 'binary_expression');
      assert.equal(condition.childForFieldName('operator').type, 'word_operator');
      assert.equal(condition.childForFieldName('operator').text, 'and');
      assert.equal(condition.childForFieldName('left').type, 'output');
      assert.equal(clause.namedChild(1).text, 'Z');
      assert.equal(block.namedChild(block.namedChildCount - 1).type, 'if_close_tag');
      assert.equal(node.namedChild(1).text, '{$after}');
    }],
    ['{if {$x > 0} || $ready}Y{/if}', node => {
      const condition = node.namedChild(0).namedChild(0).childForFieldName('condition');
      assert.equal(condition.type, 'binary_expression');
      assert.equal(condition.childForFieldName('operator').text, '||');
      assert.equal(condition.childForFieldName('left').type, 'output');
      assert.equal(condition.childForFieldName('left').childForFieldName('value').type, 'binary_expression');
    }],
    ['{if {$x}}{foreach $rows as $row}{$row}{/foreach}{/if}{$after}', node => {
      const outer = node.namedChild(0);
      assert.equal(outer.type, 'if_block');
      assert.equal(outer.namedChild(1).type, 'foreach_block');
      assert.equal(outer.namedChild(2).type, 'if_close_tag');
      assert.equal(node.namedChild(1).text, '{$after}');
    }],
  ]) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    tree(root);
    assert.equal(reference(source).error, null);
    assert.equal(fullEngine(source, {mode: 'compile'}).error, null);
  }
});

test('Malformed braced conditions retain tag boundaries and following output', () => {
  const parser_ = parser();
  const source = '{if {$x} > }Y{/if}{$after}';
  const root = parser_.parse(source).rootNode;
  const block = root.namedChild(0);
  const tag = block.namedChild(0);
  const condition = tag.childForFieldName('condition');
  assert.equal(block.type, 'if_block');
  assert.equal(tag.type, 'if_tag');
  assert.equal(condition.type, 'output');
  assert.equal(condition.text, '{$x}');
  const operatorError = tag.namedChildren.find(child => child.type === 'ERROR');
  assert.ok(operatorError, tag.toString());
  assert.equal(operatorError.text, '>');
  assert.equal(operatorError.hasError, true);
  assert.equal(block.namedChild(1).text, 'Y');
  assert.equal(block.namedChild(2).text, '{/if}');
  assert.equal(root.namedChild(1).text, '{$after}');
  assert.equal(source.slice(tag.startIndex, tag.endIndex), '{if {$x} > }');
  assert.equal(source.slice(operatorError.startIndex, operatorError.endIndex), '>');
  assert.equal(source.slice(block.namedChild(2).startIndex, block.namedChild(2).endIndex), '{/if}');
  assert.equal(source.slice(root.namedChild(1).startIndex, root.namedChild(1).endIndex), '{$after}');
  assert.equal(fullEngine(source, {mode: 'compile'}).error.type, 'Smarty\\CompilerException');

  const spaced = '{if { $x}}Y{/if}{$after}';
  const spacedRoot = parser_.parse(spaced).rootNode;
  assert.equal(spacedRoot.hasError, true, spaced);
  assert.equal(spacedRoot.namedChild(spacedRoot.namedChildCount - 1).text, '{$after}');

  const allNodes = root => {
    const nodes = [];
    const pending = [root];
    while (pending.length) {
      const node = pending.pop();
      nodes.push(node);
      pending.push(...node.namedChildren);
    }
    return nodes;
  };
  const hasNamedCloseOrRecovery = (root, source) => allNodes(root).some(node =>
    node.text === '{/if}' && (node.type === 'if_close_tag' || node.type === 'ERROR' || node.type === 'string_fragment'));
  const assertCleanTrailingOutput = (root, source) => {
    const after = allNodes(root).find(node => node.type === 'output' && node.text === '{$after}');
    assert.ok(after, root.toString());
    assert.equal(after.hasError, false);
    assert.equal(source.slice(after.startIndex, after.endIndex), '{$after}');
    return after;
  };

  const missingHeader = '{if {$x} and $ready{/if}{$after}';
  const missingHeaderRoot = parser_.parse(missingHeader).rootNode;
  assert.equal(missingHeaderRoot.hasError, true, missingHeader);
  const missingHeaderTag = missingHeaderRoot.descendantsOfType('if_tag').find(node =>
    node.childForFieldName('condition')?.type === 'binary_expression');
  assert.ok(missingHeaderTag, missingHeaderRoot.toString());
  const missingHeaderCondition = missingHeaderTag.childForFieldName('condition');
  const missingHeaderLeft = missingHeaderCondition.childForFieldName('left');
  const missingHeaderRight = missingHeaderCondition.childForFieldName('right');
  assert.equal(missingHeaderLeft.type, 'output');
  assert.equal(missingHeaderLeft.childForFieldName('value').text, '$x');
  assert.equal(missingHeaderRight.type, 'variable');
  assert.equal(missingHeaderRight.text, '$ready');
  assert.ok(hasNamedCloseOrRecovery(missingHeaderRoot, missingHeader), missingHeaderRoot.toString());
  const missingHeaderAfter = assertCleanTrailingOutput(missingHeaderRoot, missingHeader);
  assert.ok(missingHeaderTag.startIndex < missingHeaderCondition.startIndex);
  assert.ok(missingHeaderCondition.endIndex <= missingHeaderAfter.startIndex);
  assert.equal(missingHeader.slice(missingHeaderLeft.startIndex, missingHeaderLeft.endIndex), '{$x}');
  assert.equal(fullEngine(missingHeader, {mode: 'compile'}).error.type, 'Smarty\\CompilerException');

  const ambiguousHeader = '{if {$x}Y{/if}{$after}';
  const ambiguousHeaderRoot = parser_.parse(ambiguousHeader).rootNode;
  assert.equal(ambiguousHeaderRoot.hasError, true, ambiguousHeader);
  assert.ok(hasNamedCloseOrRecovery(ambiguousHeaderRoot, ambiguousHeader), ambiguousHeaderRoot.toString());
  assertCleanTrailingOutput(ambiguousHeaderRoot, ambiguousHeader);
  assert.equal(fullEngine(ambiguousHeader, {mode: 'compile'}).error.type, 'Smarty\\CompilerException');

  const unclosed = '{if {$x} > 0}Y';
  const unclosedRoot = parser_.parse(unclosed).rootNode;
  assert.equal(unclosedRoot.hasError, true, unclosed);
  const unclosedTag = unclosedRoot.descendantsOfType('if_tag').find(node =>
    node.childForFieldName('condition')?.type === 'binary_expression');
  const unclosedBody = unclosedRoot.descendantsOfType('text').find(node => node.text === 'Y');
  assert.ok(unclosedTag, unclosedRoot.toString());
  assert.ok(unclosedBody, unclosedRoot.toString());
  assert.ok(unclosedTag.startIndex < unclosedTag.childForFieldName('condition').startIndex);
  assert.ok(unclosedTag.endIndex <= unclosedBody.startIndex);
  assert.equal(unclosed.slice(unclosedTag.startIndex, unclosedTag.endIndex), '{if {$x} > 0}');
  assert.equal(unclosed.slice(unclosedBody.startIndex, unclosedBody.endIndex), 'Y');
  assert.equal(fullEngine(unclosed, {mode: 'compile'}).error.type, 'Smarty\\CompilerException');

  const crossed = '{if {$x} > 0}Y{/foreach}{$after}';
  const crossedRoot = parser_.parse(crossed).rootNode;
  assert.equal(crossedRoot.hasError, true, crossed);
  assert.equal(crossedRoot.namedChildCount, 1, crossedRoot.toString());
  const recovery = crossedRoot.namedChild(0);
  assert.equal(recovery.type, 'ERROR');
  assert.equal(recovery.text, crossed);
  assert.ok(recovery.descendantsOfType('if_tag').some(node => node.childForFieldName('condition')?.type === 'binary_expression'));
  assert.equal(recovery.descendantsOfType('if_close_tag').length, 0);
  const crossedCloseStart = crossed.indexOf('{/foreach}');
  const crossedCloseEnd = crossedCloseStart + '{/foreach}'.length;
  const crossedCloseRecovery = recovery.descendantsOfType('ERROR').find(node =>
    node.startIndex === crossedCloseStart && node.endIndex === crossedCloseEnd);
  assert.ok(crossedCloseRecovery, recovery.toString());
  assert.equal(crossed.slice(crossedCloseRecovery.startIndex, crossedCloseRecovery.endIndex), '{/foreach}');
  const after = recovery.descendantsOfType('output').find(node => node.text === '{$after}');
  assert.ok(after);
  assert.equal(after.hasError, false);
  assert.equal(fullEngine(crossed, {mode: 'compile'}).error.type, 'Smarty\\CompilerException');
});

test('Condition wrapper edits match fresh parses through if and elseif boundaries', () => {
  const incremental = parser();
  let source = '{if $x > 0}Y{else}N{/if}{$after}';
  let tree = incremental.parse(source);
  const pos = (text, index) => {
    const lines = text.slice(0, index).split('\n');
    return {row: lines.length - 1, column: lines.at(-1).length};
  };
  const edit = (before, after, hasError, from = 0) => {
    const startIndex = source.indexOf(before, from);
    assert.notEqual(startIndex, -1, `${before} in ${source}`);
    const oldEndIndex = startIndex + before.length;
    const next = source.slice(0, startIndex) + after + source.slice(oldEndIndex);
    const newEndIndex = startIndex + after.length;
    tree.edit({startIndex, oldEndIndex, newEndIndex,
      startPosition: pos(source, startIndex), oldEndPosition: pos(source, oldEndIndex),
      newEndPosition: pos(next, newEndIndex)});
    tree = incremental.parse(next, tree);
    const fresh = parser().parse(next);
    assert.equal(tree.rootNode.hasError, hasError, next);
    assert.deepEqual(snapshot(tree.rootNode), snapshot(fresh.rootNode), `${before} -> ${after}`);
    source = next;
  };

  edit('$x', '{$x}', false);
  edit('$x', '$obj->ready()', false);
  edit('> 0}', '> 0', true); // remove the outer if-header close
  edit('> 0', '> 0}', false); // restore the outer if-header close
  edit('{else}', '{elseif {$ready} and $other}', false);
  const block = tree.rootNode.namedChild(0);
  const clause = block.namedChildren.find(child => child.type === 'elseif_clause');
  assert.equal(clause.namedChild(0).childForFieldName('condition').type, 'binary_expression');
  assert.equal(block.namedChild(block.namedChildCount - 1).type, 'if_close_tag');
  assert.equal(tree.rootNode.namedChild(1).text, '{$after}');
});
