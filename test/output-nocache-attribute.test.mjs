import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('output-nocache-attribute.txt');
assert.equal(examples.length, 14);

for (const { name, source } of examples) test(`Output nocache reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expected = reference(source);
  assert.equal(expected.error, null, source);
  if (source === '{isset($x) nocache}') {
    assert.deepEqual(observations(root).filter(event => event.kind === 'output'), expected.events);
    assert.equal(fullEngine(source, { mode: 'compile' }).error, null);
  } else {
    assert.deepEqual(observations(root), expected.events);
  }
});

test('Output nocache attributes are direct ordered children with exact ranges', () => {
  const source = '{$x NoCache=true NOCACHE=0 nocache}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const output = root.firstNamedChild;
  assert.equal(output.type, 'output');
  assert.equal(output.childForFieldName('value').text, '$x');
  const attributes = output.namedChildren.filter(child => child.type === 'attribute');
  assert.deepEqual(attributes.map(node => node.childForFieldName('name').text), ['NoCache', 'NOCACHE', 'nocache']);
  assert.deepEqual(attributes.map(node => node.text), ['NoCache=true', 'NOCACHE=0', 'nocache']);
  assert.deepEqual(attributes.map(node => node.startIndex), ['NoCache', 'NOCACHE', 'nocache'].map(name => source.indexOf(name)));
  assert.deepEqual(attributes.map(node => node.childForFieldName('value')?.type ?? null), ['boolean', 'number', null]);
  assert.deepEqual(attributes.map(node => node.endIndex), attributes.map(node => node.startIndex + node.text.length));
});

test('Binary expression families keep word operators and suffix ownership separate', () => {
  const cases = [
    ['{$x ne $y nocache}', 'ne'],
    ['{$x neq $y nocache}', 'neq'],
    ['{$x NE $y nocache}', 'NE'],
    ['{$x nEq $y nocache}', 'nEq'],
    ['{$x gt $y nocache}', 'gt'],
    ['{$x GTE $y nocache}', 'GTE'],
    ['{$x == $y nocache}', '=='],
    ['{$x <= $y nocache}', '<='],
    ['{$x & $y nocache}', '&'],
    ['{$x && $y nocache}', '&&'],
    ['{$x or $y nocache}', 'or'],
    ['{$x is div by 2 nocache}', 'is div by'],
    ['{$x ne $y and $a neq $b nocache}', 'and'],
  ];
  for (const [source, expectedOperator] of cases) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const output = root.firstNamedChild;
    assert.equal(output.type, 'output');
    assert.equal(output.childForFieldName('value')?.type, 'binary_expression');
    const value = output.childForFieldName('value');
    assert.equal(value.childForFieldName('operator')?.text, expectedOperator, source);
    if (/\b(?:ne|neq|NE|nEq|gt|GTE|or|and)\b/.test(expectedOperator)) {
      assert.ok(value.descendantsOfType('word_operator').some(node => node.text === expectedOperator), source);
    }
    const attribute = output.namedChildren.find(node => node.type === 'attribute');
    assert.equal(attribute?.text, 'nocache');
    assert.equal(attribute?.startIndex, source.indexOf('nocache'));
    assert.equal(reference(source).error, null, source);
  }
});

test('Compiler-valid nocache values and parser/compiler value boundary stay distinct', () => {
  for (const value of ['true', 'false', '1', '0', '"true"', "'false'"]) {
    const source = `{$x nocache = ${value}}`;
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    assert.equal(fullEngine(source, { mode: 'compile' }).error, null, source);
  }
  const wider = '{$x nocache=$flag}';
  const widerRoot = parser().parse(wider).rootNode;
  assert.equal(widerRoot.hasError, false, widerRoot.toString());
  assert.equal(widerRoot.firstNamedChild.namedChildren.find(node => node.type === 'attribute').childForFieldName('value').type, 'variable');
  assert.ok(fullEngine(wider, { mode: 'compile' }).error);
  assert.equal(reference('{$x nocache=TRUE}').error, null, 'the recorder checks parsing, not compiler option validation');
  assert.ok(fullEngine('{$x nocache=TRUE}', { mode: 'compile' }).error);
});

test('Missing nocache value errors locally and preserves a separate output', () => {
  const source = '{$x nocache=}{$after}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.ok(reference(source).error);
  assert.ok(fullEngine(source, { mode: 'compile' }).error);
  const tail = root.namedChildren.at(-1);
  assert.equal(tail.type, 'output');
  assert.equal(tail.text, '{$after}');
  assert.equal(tail.hasError, false, tail.toString());
});

test('nocache followed by a modifier remains a recorder/compiler mismatch only', () => {
  const source = '{$x nocache|escape}';
  const observed = reference(source);
  assert.equal(observed.error, null);
  assert.deepEqual(observed.events, [
    { kind: 'modifier', name: 'escape', arguments: 0 },
    { kind: 'output' },
  ]);
  assert.ok(fullEngine(source, { mode: 'compile' }).error);
});

test('Arbitrary output attributes remain outside the supported suffixes', () => {
  for (const source of ['{$x foo=1}{$after}']) {
    assert.equal(reference(source).error, null, `the recorder accepts arbitrary output attribute syntax: ${source}`);
    const root = parser().parse(source).rootNode;
    assert.ok(root.hasError, root.toString());
    assert.equal(root.namedChildren.at(-1).text, '{$after}');
  }
  assert.ok(fullEngine('{$x foo=1}', { mode: 'compile' }).error);
});

test('Editing across the output suffix matches fresh trees at every step', () => {
  const p = parser();
  let source = '{widget}A{$x nocache}B{widget value=$v}{$after}';
  let tree = p.parse(source);
  const edit = (before, after, expectedError) => {
    const at = source.indexOf(before, source.indexOf('{$x'));
    const next = source.slice(0, at) + after + source.slice(at + before.length);
    tree.edit({
      startIndex: at, oldEndIndex: at + before.length, newEndIndex: at + after.length,
      startPosition: { row: 0, column: at },
      oldEndPosition: { row: 0, column: at + before.length },
      newEndPosition: { row: 0, column: at + after.length },
    });
    tree = p.parse(next, tree);
    assert.equal(tree.rootNode.hasError, expectedError, tree.rootNode.toString());
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode));
    assert.equal(tree.rootNode.namedChildren.at(-1).text, '{$after}');
    assert.equal(tree.rootNode.namedChildren.at(-1).hasError, false);
    source = next;
  };
  edit('nocache', 'nocache=true', false);
  edit('true', '', true);
  edit('nocache=', 'nocache', false);
  edit('nocache', '', false);
  assert.deepEqual(parser().parse(source).rootNode.namedChildren.map(node => node.type), ['custom_tag', 'text', 'output', 'text', 'custom_tag', 'output']);
});
