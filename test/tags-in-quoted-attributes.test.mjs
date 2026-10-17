import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('tags-in-quoted-attributes.txt');
assert.equal(examples.length, 12, 'The quoted-tag fixture set must not silently skip cases');

for (const { name, source } of examples) test(`Quoted tag content is structured: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expected = reference(source);
  assert.equal(expected.error, null, `${name}: ${expected.error}`);
  const actual = observations(root);
  if (name === 'Nested quoted output stays inside the conditional') {
    // The recorder sees the nested Smarty output token during compilation but
    // its event projection omits output tags nested in another tag's value.
    assert.deepEqual(actual.filter(event => event.kind !== 'output'), expected.events);
    assert.equal(actual.filter(event => event.kind === 'output').length, 1);
  } else {
    assert.deepEqual(actual, expected.events);
  }
  if (name === 'Escaped quotes remain fragments around a nested conditional') {
    assert.deepEqual(root.descendantsOfType('string_fragment').map(fragment => fragment.text), [String.raw`before \"x\" `]);
  }
  if (name === 'Escaped braces stay literal around a nested conditional') {
    assert.deepEqual(root.descendantsOfType('string_fragment').map(fragment => fragment.text), [
      String.raw`before \{literal\} `, String.raw` \{/literal\} after`,
    ]);
  }
  if (name === 'Nested quoted output stays inside the conditional') {
    const block = root.descendantsOfType('if_block')[0];
    assert.equal(block.descendantsOfType('output')[0].text, '{$object->render("x")}');
    assert.equal(block.descendantsOfType('string').length, 1);
  }
  if (name === 'Literal markers are text around a recognized conditional') {
    assert.deepEqual(root.descendantsOfType('string_fragment').map(fragment => fragment.text), [
      'before {literal}literal{/literal}', ' after',
    ]);
  }
  if (name === 'Single-quoted braces remain string content') {
    assert.equal(root.descendantsOfType('if_block').length, 0);
    assert.equal(root.descendantsOfType('attribute')[0].childForFieldName('value').type, 'string');
  }
});

test('Smarty compiler accepts quoted tags in output, method arguments, and built-in attributes', () => {
  for (const source of [
    '{"before {if $a}yes{else}no{/if} after"|escape}',
    '{$object->render("before {if $a}yes{/if} after")}',
    '{strlen("before {if $a}yes{/if} after")}',
    '{html_options options=$options selected="{if $a}1{else}0{/if}"}',
    String.raw`{html_options selected="before \"x\" {if $a}1{else}0{/if}"}`,
    String.raw`{html_options selected="before \{literal\} {if $a}yes{/if} \{/literal\} after"}`,
    '{html_options selected="before {if $a}{$object->render("x")}{/if} after"}',
  ]) assert.equal(fullEngine(source, { mode: 'compile' }).error, null, source);
});

test('Comments inside double-quoted content remain a genuine syntax error', () => {
  const source = '{html_options selected="before{* rejected *}after"}{$after}';
  assert.ok(reference(source).error, 'The Smarty recorder must reject a comment in a quoted value');
  assert.ok(fullEngine(source, { mode: 'compile' }).error, 'Smarty compiler must reject a comment in a quoted value');

  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.ok(root.descendantsOfType('ERROR').length > 0 || root.descendantsOfType('MISSING').length > 0, root.toString());
  assert.equal(root.text.includes('{* rejected *}'), true);
  const laterExpression = root.descendantsOfType('string_interpolation').at(-1);
  assert.equal(laterExpression.text, '{$after}');
  assert.equal(laterExpression.childForFieldName('value').type, 'variable');
});

test('Missing nested conditional closer recovers at the outer quote and later output', () => {
  const source = '{widget value="before {if $ok}yes"}{$after}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  const laterOutput = root.descendantsOfType('output').at(-1);
  assert.ok(laterOutput, root.toString());
  assert.equal(laterOutput.text, '{$after}');
});

test('Malformed nested condition retains its error and following output', () => {
  const source = '{widget value="before {if $ok >}yes{/if}"}{$after}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  const block = root.descendantsOfType('if_block')[0];
  assert.ok(block, root.toString());
  assert.equal(block.descendantsOfType('ERROR').length, 1, root.toString());
  assert.equal(root.namedChildren.at(-1).text, '{$after}');
});

test('Missing outer quote retains following expression structure inside recovery', () => {
  const source = '{widget value="before {if $ok}yes{/if}{$after}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  const followingValue = root.descendantsOfType('string_interpolation').at(-1);
  assert.ok(followingValue, root.toString());
  assert.equal(followingValue.childForFieldName('value').text, '$after');
});

test('Editing a plain quoted value into a conditional matches a fresh parse', () => {
  const p = parser();
  let source = '{widget value="plain"}{$after}';
  let tree = p.parse(source);
  const old = 'plain';
  const replacement = '{if $ok}yes{else}no{/if}';
  const startIndex = source.indexOf(old);
  const next = source.slice(0, startIndex) + replacement + source.slice(startIndex + old.length);
  tree.edit({
    startIndex, oldEndIndex: startIndex + old.length, newEndIndex: startIndex + replacement.length,
    startPosition: { row: 0, column: startIndex },
    oldEndPosition: { row: 0, column: startIndex + old.length },
    newEndPosition: { row: 0, column: startIndex + replacement.length },
  });
  tree = p.parse(next, tree);
  assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
  assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode));
  assert.equal(tree.rootNode.namedChildren.at(-1).text, '{$after}');
});
