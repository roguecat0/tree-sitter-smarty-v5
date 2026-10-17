import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('output-nofilter.txt');
assert.equal(examples.length, 8);

for (const { name, source } of examples.slice(0, 7)) test(`Output nofilter reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  assert.equal(reference(source).error, null, source);
  if (source.includes('{widget')) return;
  const observed = observations(root);
  const expected = reference(source).events;
  if (source.startsWith('{isset(')) {
    assert.deepEqual(observed.filter(event => event.kind === 'output'), expected.filter(event => event.kind === 'output'));
    assert.equal(fullEngine('{isset($value) nofilter}', { mode: 'compile' }).error, null);
  } else {
    assert.deepEqual(observed, expected);
  }
});

test('Compiler-valid nofilter and mixed flags retain ordered direct attribute children', () => {
  for (const source of ['{$x nofilter}', '{$x nofilter=true}', '{$x nofilter=false}', '{$x nofilter=1}', '{$x nofilter=0}', '{$x nofilter="true"}', "{$x nofilter='false'}", '{$x nofilter=true nocache=false}', '{$x nocache nofilter}', '{$x nofilter nocache nofilter}']) {
    assert.equal(fullEngine(source, { mode: 'compile' }).error, null, source);
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    const output = root.firstNamedChild;
    assert.equal(output.type, 'output');
    assert.equal(output.childForFieldName('value')?.text, '$x');
    const attributes = output.namedChildren.filter(child => child.type === 'attribute');
    const expectedNames = source.match(/\b(?:nofilter|nocache)\b/gi);
    assert.deepEqual(attributes.map(node => node.childForFieldName('name').text.toLowerCase()), expectedNames.map(name => name.toLowerCase()));
    assert.deepEqual(attributes.map(node => node.text), expectedNames.map((name, index) => {
      const start = source.indexOf(name, index === 0 ? source.indexOf('$x') : source.indexOf(expectedNames[index - 1], source.indexOf('$x')) + expectedNames[index - 1].length);
      const end = index + 1 < expectedNames.length
        ? source.indexOf(expectedNames[index + 1], start + name.length)
        : source.indexOf('}', start);
      return source.slice(start, end).trim();
    }));
    assert.deepEqual(attributes.map(node => node.startIndex), expectedNames.map((name, index) => {
      const offset = source.indexOf('$x') + 2;
      return source.indexOf(name, index === 0 ? offset : source.indexOf(expectedNames[index - 1], offset) + expectedNames[index - 1].length);
    }));
    assert.ok(attributes.every(node => node.startIndex >= source.indexOf('$x') + 2));
  }
});

test('Compiler-invalid nofilter spelling and value stay syntactic, not parser errors', () => {
  for (const source of ['{$x NoFilter}', '{$x nofilter=$flag}', '{$x nofilter=TRUE}']) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    assert.equal(root.firstNamedChild.namedChildren.find(node => node.type === 'attribute').childForFieldName('name').text, source.match(/NoFilter|nofilter/)[0]);
    assert.ok(fullEngine(source, { mode: 'compile' }).error, source);
    assert.equal(reference(source).error, null, source);
  }
});

test('NoFilter suffix scope does not change generic tag arguments', () => {
  const sources = ['{widget nofilter}', '{widget nofilter=$flag}'];
  for (const source of sources) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    assert.deepEqual(observations(root), reference(source).events);
  }
});

test('Missing nofilter value errors locally and preserves a separate output', () => {
  const source = '{$value nofilter=}{$after}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.ok(reference(source).error);
  assert.ok(fullEngine(source, { mode: 'compile' }).error);
  const tail = root.namedChildren.at(-1);
  assert.equal(tail.type, 'output');
  assert.equal(tail.text, '{$after}');
  assert.equal(tail.hasError, false, tail.toString());
});

test('Unsupported extra output attribute errors while preserving following output', () => {
  const source = '{$value nofilter foo=1}{$after}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.ok(fullEngine('{$value nofilter foo=1}', { mode: 'compile' }).error);
  const tail = root.namedChildren.at(-1);
  assert.equal(tail.text, '{$after}');
  assert.equal(tail.hasError, false, tail.toString());
});

test('Modifier after nofilter remains a compiler error without changing suffix ownership', () => {
  const source = '{$x nofilter|escape}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.ok(fullEngine(source, { mode: 'compile' }).error);
});

test('Editing nofilter on and off matches fresh trees at every step', () => {
  const p = parser();
  let source = '{widget}A{$x nocache}B{$after}';
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
  edit('nocache', 'nofilter', false);
  edit('nofilter', 'nofilter=true', false);
  edit('nofilter=true', 'nofilter=', true);
  edit('nofilter=', 'nofilter', false);
  edit('nofilter', '', false);
});
