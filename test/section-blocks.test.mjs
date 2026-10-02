import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const sectionFixtures = fixtures('smarty-reference.txt').filter(({name}) => name.includes('section-'));
for (const {name, source} of sectionFixtures) {
  test(`Smarty agrees: ${name}`, () => {
    const tree = parser().parse(source).rootNode;
    assert.equal(tree.hasError, false, tree.toString());
    const expected = reference(source);
    assert.equal(expected.error, null);
    assert.deepEqual(observations(tree), expected.events);
  });
}

test('Section header wrappers preserve long and short source ranges', () => {
  for (const [source, nameText, loopText, nameValue, loopValue] of [
    ['{section loop=$items name=rows}{/section}', 'name=rows', 'loop=$items', 'rows', '$items'],
    ['{section rows $items}{/section}', 'rows', '$items', 'rows', '$items'],
    ['{section rows $items start=1 step=2}{/section}', 'rows', '$items', 'rows', '$items'],
  ]) {
    const tree = parser().parse(source).rootNode;
    assert.equal(tree.hasError, false, tree.toString());
    const header = tree.namedChildren[0].namedChildren[0].namedChildren[0];
    const name = header.childForFieldName('name');
    const loop = header.childForFieldName('loop');
    assert.equal(name.type, 'section_header_name');
    assert.equal(loop.type, 'section_header_loop');
    assert.equal(name.text, nameText);
    assert.equal(loop.text, loopText);
    const nameValueNode = name.childForFieldName('value');
    const loopValueNode = loop.childForFieldName('value');
    assert.equal(nameValueNode.text, nameValue);
    assert.equal(loopValueNode.text, loopValue);
    const assertRange = (node, text, start) => {
      assert.deepEqual([node.startIndex, node.endIndex], [start, start + text.length]);
      assert.deepEqual(node.startPosition, {row: 0, column: start});
      assert.deepEqual(node.endPosition, {row: 0, column: start + text.length});
      assert.equal(source.slice(node.startIndex, node.endIndex), text);
    };
    const nameStart = source.indexOf(nameText);
    const loopStart = source.indexOf(loopText);
    assertRange(name, nameText, nameStart);
    assertRange(loop, loopText, loopStart);
    assertRange(nameValueNode, nameValue, source.indexOf(nameValue, nameStart));
    assertRange(loopValueNode, loopValue, source.indexOf(loopValue, loopStart));
  }
  assert.equal(fullEngine('{section rows $items}{/section}', {mode: 'compile'}).error, null);
  assert.equal(fullEngine('{section rows $items start=1 step=2}{$items[rows]}{/section}', {mode: 'compile'}).error, null);
  assert.equal(fullEngine(`{section loop=$items properties="'first','last'" name=rows start=1 step=2 max=3 show=true nocache}{/section}`, {mode: 'compile'}).error, null);
});

test('Section property spellings remain explicit in expressions', () => {
  const properties = ['first', 'last', 'index', 'iteration', 'show', 'total', 'rownum', 'index_prev', 'index_next', 'loop'];
  const parse = parser();
  for (const property of properties) {
    const tree = parse.parse(`{$smarty.section.rows.${property}}`).rootNode;
    assert.equal(tree.hasError, false, `${property}: ${tree.toString()}`);
    const expression = tree.namedChildren[0].childForFieldName('value');
    assert.equal(expression.type, 'section_property_expression');
    assert.equal(expression.childForFieldName('section').text, 'rows');
    assert.equal(expression.childForFieldName('property').text, property);
    assert.equal(fullEngine(`{section name=rows loop=$items}{$smarty.section.rows.${property}}{/section}`, {mode: 'compile'}).error, null, property);
  }
});

test('Section index forms compose in attributes, conditions and modifier arguments', () => {
  const source = '{section name=rows loop=$items}{if $smarty.section.rows.first && $items[rows.index]}{widget value=$items[rows]}{$items[rows]|default:$smarty.section.rows.iteration}{/if}{/section}';
  const tree = parser().parse(source).rootNode;
  assert.equal(tree.hasError, false, tree.toString());
  const expected = reference(source);
  assert.equal(expected.error, null);
  assert.deepEqual(observations(tree), expected.events);
  assert.match(tree.toString(), /section_property_index/);
  assert.match(tree.toString(), /section_index/);
  assert.match(tree.toString(), /section_property_expression/);
});

test('Nested sections retain nearest sectionelse and close ownership', () => {
  const source = '{section name=outer loop=$items}A{section name=inner loop=$items}{sectionelse}inner-empty{/section}B{sectionelse}outer-empty{/section}{$after}';
  const tree = parser().parse(source).rootNode;
  assert.equal(tree.hasError, false, tree.toString());
  const outer = tree.namedChildren[0];
  assert.equal(outer.type, 'section_block');
  assert.equal(outer.namedChildren.filter(child => child.type === 'sectionelse_clause').length, 1);
  const inner = outer.namedChildren.find(child => child.type === 'section_block');
  assert.ok(inner);
  assert.equal(inner.namedChildren.filter(child => child.type === 'sectionelse_clause').length, 1);
  assert.equal(outer.namedChildren.at(-1).type, 'section_close_tag');
  assert.equal(tree.namedChildren.at(-1).type, 'output');
  assert.equal(fullEngine(source, {mode: 'compile'}).error, null);
});

test('Section nesting composes around existing if, foreach and literal blocks', () => {
  const source = '{if $ready}{section name=rows loop=$items}{foreach $items as $item}{literal}raw{/literal}{$item[rows]}{/foreach}{/section}{/if}';
  const tree = parser().parse(source).rootNode;
  assert.equal(tree.hasError, false, tree.toString());
  assert.deepEqual(tree.namedChildren.map(child => child.type), ['if_block']);
  assert.equal(fullEngine(source, {mode: 'compile'}).error, null);
  const nested = '{foreach $items as $item}{section name=rows loop=$items}{$item[rows]}{/section}{/foreach}';
  assert.equal(parser().parse(nested).rootNode.hasError, false, nested);
  assert.equal(fullEngine(nested, {mode: 'compile'}).error, null);
});

test('Invalid section ownership is rejected by Smarty and recovers neighboring output', () => {
  for (const [source, recoveryShape] of [
    ['{/section}{$after}', 'sibling'], ['{sectionelse}{$after}', 'sibling'],
    ['{section name=rows loop=$items}x', 'no-neighbor'],
    ['{section name=rows loop=$items}{sectionelse}{sectionelse}{/section}{$after}', 'section-sibling'],
    ['{section name=rows loop=$items}{if true}x{/section}{/if}{$after}', 'crossed-if'],
    ['{section name=rows loop=$items}{foreach $items as $item}x{/section}{/foreach}{$after}', 'crossed-foreach'],
  ]) {
    const result = fullEngine(source, {mode: 'compile'});
    assert.ok(result.error, source);
    const tree = parser().parse(source).rootNode;
    assert.equal(tree.hasError, true, tree.toString());
    if (recoveryShape === 'sibling') {
      assert.equal(tree.namedChildren.at(-1).type, 'output', tree.toString());
      assert.equal(tree.namedChildren.at(-1).text, '{$after}');
    } else if (recoveryShape === 'section-sibling') {
      assert.equal(tree.namedChildren.at(-1).type, 'output', tree.toString());
      assert.equal(tree.namedChildren.at(-1).text, '{$after}');
      assert.equal(tree.namedChildren[0].type, 'section_block');
      assert.equal(tree.namedChildren[0].namedChildren.some(node => node.type === 'ERROR'), true);
    } else if (recoveryShape.startsWith('crossed-')) {
      assert.equal(tree.namedChildren.length, 1, tree.toString());
      const recovery = tree.namedChildren[0];
      assert.equal(recovery.type, 'ERROR');
      assert.equal(recovery.text, source);
      assert.ok(recovery.namedChildren.some(node => node.type === 'section_tag'));
      const nested = recoveryShape === 'crossed-if' ? 'if_block' : 'foreach_block';
      const block = recovery.namedChildren.find(node => node.type === nested);
      assert.ok(block, tree.toString());
      const closer = recoveryShape === 'crossed-if' ? 'if_close_tag' : 'foreach_close_tag';
      assert.equal(block.descendantsOfType(closer).length, 1, tree.toString());
      const after = recovery.descendantsOfType('output').find(node => node.text === '{$after}');
      assert.ok(after, tree.toString());
      assert.equal(after.parent, recovery);
    }
  }
});

test('Malformed short headers and section indices recover after the tag', () => {
  for (const source of ['{section rows}{/section}{$after}', '{section rows $items start=}{/section}{$after}', '{$items[rows.] }{$after}', '{$smarty.section.rows.}{$after}']) {
    const tree = parser().parse(source).rootNode;
    assert.equal(tree.hasError, true, source);
    assert.equal(tree.namedChildren.at(-1).type, 'output', tree.toString());
    assert.equal(tree.namedChildren.at(-1).text, '{$after}');
  }
});

test('Section close, index kind and sectionelse edits match fresh parses', () => {
  const checkEdit = (before, from, to) => {
    const p = parser();
    const incremental = p.parse(before);
    const startIndex = before.indexOf(from);
    assert.notEqual(startIndex, -1);
    const edited = before.slice(0, startIndex) + to + before.slice(startIndex + from.length);
    const edit = {
      startIndex,
      oldEndIndex: startIndex + from.length,
      newEndIndex: startIndex + to.length,
      startPosition: {row: 0, column: startIndex},
      oldEndPosition: {row: 0, column: startIndex + from.length},
      newEndPosition: {row: 0, column: startIndex + to.length},
    };
    incremental.edit(edit);
    const reparsed = p.parse(edited, incremental);
    assert.deepEqual(snapshot(reparsed.rootNode), snapshot(p.parse(edited).rootNode));
  };
  checkEdit('{section name=rows loop=$items}{$items[rows]}{/section}{$after}', '{/section}', '');
  checkEdit('{$items[rows]}{$after}', 'rows', '$key');
  checkEdit('{section name=rows loop=$items}{sectionelse}empty{/section}{$after}', '{sectionelse}', '');
});
