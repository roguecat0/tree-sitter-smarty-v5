import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('namespaced-static-method-calls.txt');

test('Pinned Smarty accepts namespace-qualified static calls', () => {
  assert.ok(examples.length >= 10);
  for (const { name, source } of examples) {
    const expected = reference(source);
    assert.equal(expected.error, null, `${name}: ${expected.error}`);
    assert.deepEqual(expected.events, observations(parser().parse(source).rootNode), name);
  }
});

test('Qualified class names, full source range and call fields stay distinct', () => {
  for (const [source, expectedName, expectedSegments] of [
    [String.raw`{Demo\Assets\Builder::build()}`, String.raw`Demo\Assets\Builder`, 3],
    [String.raw`{\Demo::build($x, 2)}`, String.raw`\Demo`, 1],
    [String.raw`{Demo\if\true\null::for()}`, String.raw`Demo\if\true\null`, 4],
    [String.raw`{Demo\IF\TRUE\SeLf::for()}`, String.raw`Demo\IF\TRUE\SeLf`, 4],
    [String.raw`{Demo\Assets::build ()}`, String.raw`Demo\Assets`, 2],
    [String.raw`{1Demo\Assets::build()}`, String.raw`1Demo\Assets`, 2],
    [String.raw`{Demo\2Assets::build()}`, String.raw`Demo\2Assets`, 2],
    [String.raw`{\1Demo\2Assets::build()}`, String.raw`\1Demo\2Assets`, 2],
  ]) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const call = root.descendantsOfType('static_method_call_expression')[0];
    const klass = call.childForFieldName('class');
    assert.equal(klass.type, 'qualified_name');
    assert.equal(klass.text, expectedName);
    assert.equal(klass.namedChildren.length, expectedSegments);
    assert.deepEqual([call.startIndex, call.endIndex], [1, source.length - 1]);
    assert.equal(call.childForFieldName('method').text, source.includes('::for') ? 'for' : 'build');
  }
});

test('Qualified static calls compose without splitting their expression owner', () => {
  const cases = [
    [String.raw`{$target = Demo\Assets::build()}`, 'value'],
    [String.raw`{foreach Demo\Assets::items() as $item}{$item}{/foreach}`, 'source'],
    [String.raw`{strlen(Demo\Assets::name())}`, 'argument'],
    [String.raw`{$o->run(Demo\Assets::name())}`, 'argument'],
    [String.raw`{widget Demo\Assets::build()}`, 'argument'],
    [String.raw`{widget value=Demo\Assets::build()}`, 'value'],
    [String.raw`{Demo\Assets::build()|escape}`, 'value'],
    [String.raw`{Demo\Assets::build()|default:Demo\Assets::fallback()}`, 'argument'],
    [String.raw`{$items[Demo\Assets::index()]}`, 'index'],
    [String.raw`{[Demo\Assets::key()=>Demo\Assets::build()]}`, 'key'],
  ];
  for (const [source, owner] of cases) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    assert.ok(root.descendantsOfType('static_method_call_expression').length >= 1, source);
    if (source.includes('{widget')) {
      const tag = root.descendantsOfType('custom_tag')[0];
      assert.equal(tag.descendantsOfType('static_method_call_expression').length, 1, root.toString());
      if (owner === 'argument') assert.equal(tag.childrenForFieldName('argument').length, 1, root.toString());
      else assert.equal(tag.descendantsOfType('attribute')[0].childForFieldName('value').type, 'static_method_call_expression');
    }
    if (source.includes('|default:')) {
      const modifier = root.descendantsOfType('modifier_expression')[0];
      assert.equal(modifier.childForFieldName('argument').type, 'static_method_call_expression');
    }
  }
});

test('Namespace separator and constant boundaries preserve later output', () => {
  for (const malformed of [
    String.raw`{Demo\\Assets::build()}`,
    String.raw`{Demo\ Assets::build()}`,
    String.raw`{Demo\Assets\::build()}`,
    String.raw`{Demo\Assets ::build()}`,
  ]) {
    const root = parser().parse(`${malformed}{$after}`).rootNode;
    assert.equal(root.hasError, true, root.toString());
    assert.equal(root.descendantsOfType('static_method_call_expression').length, 0, root.toString());
    assert.ok(root.namedChildren.some(node => node.text === '{$after}'), root.toString());
  }
  for (const [malformed, expectCall] of [
    [String.raw`{Demo\Assets::}`, false],
    [String.raw`{Demo\Assets::build(`, false],
  ]) {
    const root = parser().parse(`${malformed}{$after}`).rootNode;
    assert.equal(root.hasError, true, root.toString());
    assert.equal(root.descendantsOfType('static_method_call_expression').length > 0, expectCall, root.toString());
    assert.ok(root.namedChildren.some(node => node.text === '{$after}'), root.toString());
  }
  for (const source of [
    String.raw`{Demo\Assets\VERSION}{$after}`,
    String.raw`{Demo\Assets\Builder::VERSION}{$after}`,
    String.raw`{\Demo\Assets::VERSION}{$after}`,
  ]) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, true, root.toString());
    assert.equal(root.descendantsOfType('static_method_call_expression').length, 0, root.toString());
    assert.ok(root.namedChildren.some(node => node.text === '{$after}'), root.toString());
    assert.equal(reference(source).error, null, source);
  }
  const whitespaceSource = String.raw`{Demo \Assets::build()}`;
  const whitespaceRoot = parser().parse(whitespaceSource).rootNode;
  assert.equal(whitespaceRoot.hasError, false, whitespaceRoot.toString());
  assert.equal(whitespaceRoot.firstNamedChild.type, 'custom_tag');
  assert.equal(whitespaceRoot.firstNamedChild.childForFieldName('name').text, 'Demo');
  assert.equal(whitespaceRoot.firstNamedChild.childrenForFieldName('argument').length, 1);
  const genericWhitespace = reference(whitespaceSource);
  assert.equal(genericWhitespace.error, null);
  assert.match(JSON.stringify(fullEngine(whitespaceSource, { mode: 'compile' }).error), /unknown tag/i);
});

test('Neutral namespace call compiles without loading its class', () => {
  for (const source of [
    String.raw`{Demo\Assets\Builder::build ()}`,
    String.raw`{\Demo::build()}`,
    String.raw`{Demo\if\true\null\self\parent::for()}`,
    String.raw`{1Demo\Assets::build()}`,
    String.raw`{Demo\2Assets::build()}`,
    String.raw`{\1Demo\2Assets::build()}`,
  ]) {
    const result = fullEngine(source, { mode: 'compile' });
    assert.equal(result.error, null, `${source}: ${JSON.stringify(result)}`);
  }
});

test('Qualification edits and malformed separator recovery match fresh trees', () => {
  const p = parser();
  let source = '{$before}{Thing::build($x)}{$after}';
  let tree = p.parse(source);
  for (const [oldText, newText, hasError] of [
    ['Thing::build($x)', String.raw`Demo\Assets::build($x)`, false],
    [String.raw`Demo\Assets::build($x)`, String.raw`Demo\\Assets::build($x)`, true],
    [String.raw`Demo\\Assets::build($x)`, String.raw`Demo\Assets::build($x)`, false],
    [String.raw`Demo\Assets::build($x)`, String.raw`Demo\Assets:build($x)`, true],
    [String.raw`Demo\Assets:build($x)`, String.raw`Demo\Assets::build($x)`, false],
  ]) {
    const start = source.indexOf(oldText);
    assert.notEqual(start, -1);
    const next = source.slice(0, start) + newText + source.slice(start + oldText.length);
    tree.edit({
      startIndex: start, oldEndIndex: start + oldText.length, newEndIndex: start + newText.length,
      startPosition: { row: 0, column: start },
      oldEndPosition: { row: 0, column: start + oldText.length },
      newEndPosition: { row: 0, column: start + newText.length },
    });
    tree = p.parse(next, tree);
    assert.equal(tree.rootNode.hasError, hasError, tree.rootNode.toString());
    assert.equal(tree.rootNode.namedChildren[0].text, '{$before}');
    assert.equal(tree.rootNode.namedChildren.at(-1).text, '{$after}');
    assert.deepEqual(snapshot(tree.rootNode), snapshot(p.parse(next).rootNode));
    source = next;
  }
});
