import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('modifier-identifiers.txt');
assert.equal(examples.length, 5);
for (const { name, source } of examples) test(`Modifier argument reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expected = reference(source);
  assert.equal(expected.error, null, source);
  assert.deepEqual(observations(root), expected.events);
});

test('Static identifiers preserve their exact token and field ranges', () => {
  for (const [source, token] of [['{$x|escape:quotes}', 'quotes'], ['{$x|default:123foo}', '123foo']]) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const modifier = root.firstNamedChild.childForFieldName('value');
    const argument = modifier.childrenForFieldName('argument')[0];
    const start = source.indexOf(token);
    assert.deepEqual([argument.type, argument.text, argument.startIndex, argument.endIndex],
      ['identifier', token, start, start + token.length]);
  }
});

test('Static identifier chains preserve inner and outer arguments and source ranges', () => {
  const source = "{$x|default:foo|escape:'htmlall'}";
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const outer = root.firstNamedChild.childForFieldName('value');
  const inner = outer.childForFieldName('value');
  const [innerArgument] = inner.childrenForFieldName('argument');
  const [outerArgument] = outer.childrenForFieldName('argument');
  assert.deepEqual([inner.childForFieldName('name').text, innerArgument.type, innerArgument.text], ['default', 'identifier', 'foo']);
  assert.deepEqual([outer.childForFieldName('name').text, outerArgument.type, outerArgument.text], ['escape', 'string', "'htmlall'"]);
  for (const [modifier, name] of [[inner, 'default'], [outer, 'escape']]) {
    const nameNode = modifier.childForFieldName('name');
    assert.deepEqual([nameNode.text, nameNode.startIndex, nameNode.endIndex],
      [name, source.indexOf(name), source.indexOf(name) + name.length]);
  }
  for (const node of [innerArgument, outerArgument]) {
    assert.equal(node.startIndex, source.indexOf(node.text));
    assert.equal(node.endIndex, node.startIndex + node.text.length);
  }
  const ordinary = fullEngine('{$x|default:foo}', { values: { x: '' } });
  const digitPrefixed = fullEngine('{$x|default:123foo}', { values: { x: '' } });
  assert.equal(ordinary.version, '5.8.4');
  assert.equal(ordinary.result, 'foo');
  assert.equal(digitPrefixed.version, '5.8.4');
  assert.equal(digitPrefixed.result, '123foo');
});

test('Existing literal and class-constant modifier argument classifications remain distinct', () => {
  const source = '{$x|m:true:false:null:Widget::NAME}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const modifier = root.firstNamedChild.childForFieldName('value');
  assert.deepEqual(modifier.childrenForFieldName('argument').map(node => node.type),
    ['boolean', 'boolean', 'null', 'class_constant_expression']);
  const numeric = parser().parse('{$x|m:123}').rootNode.firstNamedChild.childForFieldName('value');
  assert.equal(numeric.childrenForFieldName('argument')[0].type, 'number');
});

test('Digit-prefixed tag IDs remain custom-tag names', () => {
  const root = parser().parse('{123foo}').rootNode;
  assert.equal(root.hasError, false, root.toString());
  assert.deepEqual([root.firstNamedChild.type, root.firstNamedChild.childForFieldName('name').text],
    ['custom_tag', '123foo']);
  assert.equal(reference('{123foo}').events[0].name, '123foo');
  for (const source of ['{widget value=foo}', '{widget value=123foo}', '{widget foo}']) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, `${source}: ${root.toString()}`);
  }
  assert.equal(reference('{widget value=foo}').error, null, 'The recorder accepts this generic-tag shape');
});

test('Missing and multi-token modifier arguments error and preserve following outputs', () => {
  const missing = '{$x|m:}';
  assert.equal(parser().parse(missing).rootNode.hasError, true, missing);
  assert.ok(reference(missing).error, 'Smarty compiler rejects a missing modifier argument');

  const source = '{$before}{$x|m:foo bar}{$after}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.equal(root.namedChildren[0].type, 'output', root.toString());
  assert.equal(root.namedChildren.at(-1).type, 'output', root.toString());
  assert.equal(root.namedChildren.at(-1).text, '{$after}');
});

test('Quoted-to-identifier modifier edit matches a fresh parse', () => {
  const p = parser();
  let source = "{$before}{$x|escape:'quotes'}{$after}";
  let tree = p.parse(source);
  const before = "'quotes'";
  const after = 'quotes';
  const startIndex = source.indexOf(before);
  const next = source.slice(0, startIndex) + after + source.slice(startIndex + before.length);
  tree.edit({
    startIndex,
    oldEndIndex: startIndex + before.length,
    newEndIndex: startIndex + after.length,
    startPosition: { row: 0, column: startIndex },
    oldEndPosition: { row: 0, column: startIndex + before.length },
    newEndPosition: { row: 0, column: startIndex + after.length },
  });
  tree = p.parse(next, tree);
  assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
  assert.equal(tree.rootNode.namedChildren[0].text, '{$before}');
  assert.equal(tree.rootNode.namedChildren.at(-1).text, '{$after}');
  const edited = tree.rootNode.namedChildren[1].childForFieldName('value').childrenForFieldName('argument')[0];
  assert.deepEqual([edited.type, edited.text], ['identifier', 'quotes']);
  assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode));
});
