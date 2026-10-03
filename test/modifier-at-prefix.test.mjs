import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, observations, parser, reference, snapshot } from './helpers.mjs';

const cases = fixtures('modifier-at-prefix.txt');

for (const { name, source } of cases) {
  test(`Modifier prefix reference and structure: ${name}`, () => {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const expected = reference(source);
    assert.equal(expected.error, null, `${name}: Smarty rejected fixture`);
    assert.deepEqual(observations(root), expected.events);
  });
}

test('Single and double at prefixes preserve the same modifier name and exact ranges', () => {
  for (const [source, prefix] of [['{$x|@ucfirst}', '@'], ['{$x|@@ucfirst}', '@@']]) {
    const root = parser().parse(source).rootNode;
    const modifier = root.descendantsOfType('modifier_expression')[0];
    const pipe = source.indexOf('|');
    const nameStart = pipe + 1 + prefix.length;
    assert.equal(modifier.childForFieldName('name').text, 'ucfirst');
    assert.deepEqual([modifier.startIndex, modifier.endIndex], [1, source.length - 1]);
    assert.deepEqual([pipe + 1, nameStart], prefix === '@' ? [4, 5] : [4, 6]);
    assert.deepEqual([modifier.childForFieldName('name').startIndex, modifier.childForFieldName('name').endIndex],
      [nameStart, nameStart + 'ucfirst'.length]);
    assert.deepEqual([source.slice(pipe + 1, nameStart), prefix], [prefix, prefix]);
  }
});

test('Prefixed modifier chain retains fields and parenthesized compound input', () => {
  const chain = parser().parse(cases[2].source).rootNode.descendantsOfType('modifier_expression');
  const outer = chain.find(node => node.childForFieldName('name')?.text === 'escape');
  const inner = chain.find(node => node.childForFieldName('name')?.text === 'default');
  assert.equal(outer.childForFieldName('value'), inner);
  assert.equal(inner.childForFieldName('name').text, 'default');
  assert.deepEqual(inner.childrenForFieldName('argument').map(node => node.text), ['label']);
  assert.equal(outer.childrenForFieldName('argument')[0].text, "'html'");
  assert.equal(cases[2].source.slice(inner.startIndex, inner.endIndex), '$x|@default:label');
  assert.equal(cases[2].source.slice(outer.startIndex, outer.endIndex), '$x|@default:label|escape:\'html\'');

  const compound = parser().parse(cases[3].source).rootNode;
  const compoundOuter = compound.descendantsOfType('modifier_expression').find(node => node.childForFieldName('name')?.text === 'escape');
  const compoundInner = compound.descendantsOfType('modifier_expression').find(node => node.childForFieldName('name')?.text === 'default');
  const parens = compoundInner.childForFieldName('value');
  const binary = parens.namedChildren[0];
  assert.equal(parens.type, 'parenthesized_expression');
  assert.equal(binary.type, 'binary_expression');
  assert.equal(binary.childForFieldName('left').text, '$x');
  assert.equal(binary.childForFieldName('right').text, '$y');
  assert.equal(compoundOuter.childForFieldName('value'), compoundInner);
  assert.deepEqual(compoundInner.childrenForFieldName('argument').map(node => node.type), ['identifier']);
  assert.deepEqual(compoundOuter.childrenForFieldName('argument').map(node => node.type), ['string']);
  assert.equal(cases[3].source.slice(compoundInner.startIndex, compoundInner.endIndex), '($x + $y)|@default:label');
  assert.equal(cases[3].source.slice(compoundOuter.startIndex, compoundOuter.endIndex), "($x + $y)|@default:label|escape:'html'");
});

test('Named generic-tag attribute owns the complete prefixed modifier value', () => {
  const source = cases[4].source;
  const root = parser().parse(source).rootNode;
  const tag = root.descendantsOfType('custom_tag')[0];
  const attribute = tag.namedChildren.find(node => node.type === 'attribute');
  const modifier = attribute.childForFieldName('value');
  assert.equal(tag.childForFieldName('name').text, 'widget');
  assert.equal(attribute.childForFieldName('name').text, 'value');
  assert.equal(modifier.type, 'modifier_expression');
  assert.equal(modifier.childForFieldName('value').text, '$x');
  assert.equal(modifier.childForFieldName('name').text, 'escape');
  assert.deepEqual(modifier.childrenForFieldName('argument').map(node => node.text), ["'html'"]);
  assert.deepEqual(reference(source).events.map(({ kind, name, arguments: args }) => [kind, name,
    kind === 'modifier' ? args : kind === 'tag' ? args.length : undefined]), [
    ['modifier', 'escape', 1], ['tag', 'widget', 1],
  ]);
});

test('Whitespace after the pipe is rejected and the later output survives', () => {
  const source = '{$x| @ucfirst}{$after}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.match(reference(source).error, /Syntax error/);
  assert.equal(root.descendantsOfType('output').some(node => node.text === '{$after}'), true, root.toString());
});

test('Malformed prefixed modifier reports an error without losing its following output', () => {
  const source = '{$x|@}{$after}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.match(reference(source).error, /Syntax error/);
  assert.equal(root.descendantsOfType('output').some(node => node.text === '{$after}'), true, root.toString());
});

test('Incremental prefix and whitespace edits match fresh parses', () => {
  const p = parser();
  let source = '{$x|ucfirst}{$after}';
  let tree = p.parse(source);
  const edit = (from, to) => {
    const pipe = source.indexOf('|');
    const startIndex = pipe + 1;
    const oldEndIndex = startIndex + from.length;
    const next = source.slice(0, startIndex) + to + source.slice(oldEndIndex);
    tree.edit({ startIndex, oldEndIndex, newEndIndex: startIndex + to.length,
      startPosition: { row: 0, column: startIndex }, oldEndPosition: { row: 0, column: oldEndIndex },
      newEndPosition: { row: 0, column: startIndex + to.length } });
    tree = p.parse(next, tree);
    source = next;
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(source).rootNode));
  };

  for (const [from, to, valid] of [
    ['ucfirst', '@ucfirst', true], ['@ucfirst', '@@ucfirst', true],
    ['@@ucfirst', '@ucfirst', true], ['@ucfirst', 'ucfirst', true],
    ['ucfirst', ' @ucfirst', false], [' @ucfirst', '@ucfirst', true],
  ]) {
    edit(from, to);
    assert.equal(tree.rootNode.hasError, !valid, tree.rootNode.toString());
    assert.equal(tree.rootNode.descendantsOfType('output').some(node => node.text === '{$after}'), true, tree.rootNode.toString());
  }
});
