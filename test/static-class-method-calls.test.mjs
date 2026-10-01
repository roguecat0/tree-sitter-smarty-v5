import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('static-class-method-calls.txt');
assert.equal(examples.length, 18);

for (const { name, source } of examples.filter(example => example.name !== 'Missing call closer preserves following output')) test(`Static class method call tree and reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expected = reference(source);
  assert.equal(expected.error, null, source);
  assert.deepEqual(observations(root), expected.events);
});

test('Static call class, method, arguments, delimiter and ranges stay distinct', () => {
  const source = '{Thing::make($item->name, State::READY)}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const call = root.firstNamedChild.childForFieldName('value');
  assert.equal(call.type, 'static_method_call_expression');
  assert.equal(call.text, 'Thing::make($item->name, State::READY)');
  assert.deepEqual([call.startIndex, call.endIndex], [1, source.length - 1]);
  assert.deepEqual([call.childForFieldName('class').text, call.childForFieldName('method').text], ['Thing', 'make']);
  assert.deepEqual(call.children.filter(child => !child.isNamed).map(child => child.text), ['::', '(', ',', ')']);
  const args = call.childrenForFieldName('argument');
  assert.equal(args.length, 2);
  assert.deepEqual(args.map(arg => arg.text), ['$item->name', 'State::READY']);
});

test('Static call compiles in controlled full-engine compile mode', () => {
  const result = fullEngine('{DateTime::getLastErrors()}', { mode: 'compile' });
  assert.equal(result.error, null, JSON.stringify(result));
});

test('Class constants remain constants and malformed calls recover neighbors', () => {
  const source = examples.find(example => example.name === 'Missing call closer preserves following output').source;
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.deepEqual(root.namedChildren.map(node => node.type), ['output', 'output'], root.toString());
  const call = root.namedChildren[0].descendantsOfType('static_method_call_expression')[0];
  assert.ok(call, root.toString());
  assert.equal(call.children.some(child => child.isMissing && child.type === ')'), true, call.toString());
  assert.equal(root.namedChildren[1].text, '{$after}');

  const constant = parser().parse('{Thing::READY}').rootNode;
  assert.equal(constant.hasError, false, constant.toString());
  assert.equal(constant.firstNamedChild.childForFieldName('value').type, 'class_constant_expression');
  for (const malformed of ['{Thing::($x)}', '{Thing::make($x', '{Thing::make($x,)}']) {
    const malformedRoot = parser().parse(malformed).rootNode;
    assert.equal(malformedRoot.hasError, true, malformedRoot.toString());
  }
});

test('Static call edit to and from a class constant matches fresh trees', () => {
  const p = parser();
  let source = '{$before}{Thing::READY}{$after}';
  let tree = p.parse(source);
  let start = source.indexOf('Thing::READY');
  for (const [remove, insert, hasError] of [
    ['Thing::READY', 'Thing::make($x)', false],
    ['Thing::make($x)', 'Thing::READY', false],
  ]) {
    const next = source.slice(0, start) + insert + source.slice(start + remove.length);
    tree.edit({
      startIndex: start, oldEndIndex: start + remove.length, newEndIndex: start + insert.length,
      startPosition: { row: 0, column: start },
      oldEndPosition: { row: 0, column: start + remove.length },
      newEndPosition: { row: 0, column: start + insert.length },
    });
    tree = p.parse(next, tree);
    assert.equal(tree.rootNode.hasError, hasError, tree.rootNode.toString());
    assert.equal(tree.rootNode.namedChildren[0].text, '{$before}');
    assert.equal(tree.rootNode.namedChildren.at(-1).text, '{$after}');
    assert.deepEqual(snapshot(tree.rootNode), snapshot(p.parse(next).rootNode));
    source = next;
    start = source.indexOf('Thing::');
  }
});

test('Unsupported static receiver and method-result chains remain visible errors', () => {
  for (const source of ['{\\App\\Thing::make($x)}', '{$class::make($x)}', '{Thing::make($x)->name}', '{Thing::make($x)->run()}']) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, true, root.toString());
  }
  for (const name of ['self', 'parent', 'SELF', 'PaReNt']) {
    const source = `{${name}::foo()}`;
    assert.match(reference(source).error, /static class/);
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
  }
});
