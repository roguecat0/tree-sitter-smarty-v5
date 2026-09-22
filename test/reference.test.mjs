import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, observations, parser, reference } from './helpers.mjs';

const examples = fixtures();
assert.equal(examples.length, 9, 'The corpus reader must not silently skip fixtures');
for (const { name, source } of examples) {
  test(`Smarty agrees: ${name}`, () => {
    const actual = parser().parse(source).rootNode;
    assert.equal(actual.hasError, false, actual.toString());
    const expected = reference(source);
    assert.equal(expected.error, null);
    assert.deepEqual(observations(actual), expected.events);
  });
}

test('Unfamiliar extension names retain arguments and modifier structure', () => {
  for (const suffix of ['a', 'long_name_927', 'Z9']) {
    const source = `{extension_${suffix} $x label='ok'}{$x|modifier_${suffix}:2}{/extension_${suffix}}`;
    const tree = parser().parse(source);
    const expected = reference(source);
    assert.equal(tree.rootNode.hasError, false);
    assert.equal(expected.error, null);
    assert.deepEqual(observations(tree.rootNode), expected.events);
  }
});

for (const source of ['{widget value=($a + )}', '{$a + }', '{if $a + }ok{/if}']) {
  test(`Both reject malformed expression: ${source}`, () => {
    assert.equal(parser().parse(source).rootNode.hasError, true);
    assert.match(reference(source).error, /Syntax error/);
  });
}

test('Known control tags cannot fall back to custom tags', () => {
  for (const source of ['{if $a}open', '{else}', '{if}x{/if}', '{if $a}x{/widget}']) {
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
  }
  const valid = '{iffy $a}{/iffy}';
  assert.equal(parser().parse(valid).rootNode.hasError, false);
});

test('Binary operator fields preserve their spelling', () => {
  const value = parser().parse('{$a - $b / 3}').rootNode.firstNamedChild.childForFieldName('value');
  assert.equal(value.childForFieldName('operator').text, '-');
  assert.equal(value.childForFieldName('right').childForFieldName('operator').text, '/');
});
