import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('shorthand-assignment-tags.txt');
const recoveryExamples = fixtures('shorthand-assignment-recovery.txt');
for (const {name, source} of examples) test(`Shorthand assignment reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expected = reference(source);
  assert.equal(expected.error, null, expected.error);
  assert.deepEqual(observations(root), expected.events);
});

test('Assignment fields, ranges, punctuation and no assignment output', () => {
  const source = "{$names[$index] = $source|escape nocache}{$name}";
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  assert.deepEqual(root.namedChildren.map(node => node.type), ['assignment_tag', 'output']);
  const assignment = root.namedChildren[0];
  const target = assignment.childForFieldName('target');
  const value = assignment.childForFieldName('value');
  assert.deepEqual([assignment.startIndex, assignment.endIndex], [0, source.indexOf('}{$name}') + 1]);
  assert.deepEqual([target.type, target.text], ['index_expression', '$names[$index]']);
  assert.deepEqual([value.type, value.text], ['modifier_expression', '$source|escape']);
  assert.deepEqual(assignment.children.filter(node => !node.isNamed).map(node => node.text), ['{', '=', '}']);
  const nocache = assignment.namedChildren.find(node => node.type === 'attribute');
  assert.equal(nocache.text, 'nocache');
  assert.deepEqual([nocache.startIndex, nocache.endIndex], [source.indexOf('nocache'), source.indexOf('nocache') + 7]);
  assert.equal(root.namedChildren[1].childForFieldName('value').text, '$name');
});

test('Controlled full engine assigns a value used by following output', () => {
  const rendered = fullEngine('{$name = $source}{$name}', { values: { source: 'assigned' } });
  assert.equal(rendered.version, '5.8.4');
  assert.equal(rendered.error, null, JSON.stringify(rendered.error));
  assert.equal(rendered.result, 'assigned');
  assert.equal(fullEngine('{$name = $source nocache}', {mode: 'compile'}).error, null);
  assert.equal(fullEngine('{$name = $source nocache=true}', {mode: 'compile'}).error, null);
});

test('Assignment accepts only the compiler-confirmed nocache option', () => {
  for (const source of ['{$x = 1 nocache}', '{$x = 1 nocache=true}', '{$x = 1 nocache nocache}']) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    assert.equal(fullEngine(source, {mode: 'compile'}).error, null, source);
  }
  const duplicate = parser().parse('{$x = 1 nocache nocache}').rootNode.firstNamedChild;
  assert.deepEqual(duplicate.descendantsOfType('attribute').map(node => node.childForFieldName('name').text), ['nocache', 'nocache']);
  for (const source of [
    '{$x = 1 foo}', '{$x = 1 nofilter}', '{$x = 1 max=2}',
    '{$x = 1 data-id="x"}', '{$x = 1 nocache max=2}',
    '{$x = 1 max=2 max=3}',
  ]) {
    assert.ok(fullEngine(source, {mode: 'compile'}).error, source);
    const root = parser().parse(`${source}{$after}`).rootNode;
    assert.equal(root.hasError, true, root.toString());
    assert.equal(root.namedChildren.at(-1).type, 'output', root.toString());
    assert.equal(root.namedChildren.at(-1).childForFieldName('value').text, '$after');
  }
  assert.ok(fullEngine('{$x = 1 nocache=$flag}', {mode: 'compile'}).error,
    'Smarty rejects the variable as a nocache flag value even though it is syntactically a valued option');
  const invalidFlagTree = parser().parse('{$x = 1 nocache=$flag}').rootNode;
  assert.equal(invalidFlagTree.hasError, false, invalidFlagTree.toString());
});

test('Assignment equals stays distinct from comparisons and generic tag arguments', () => {
  for (const source of ['{$a == $b}', '{$result = $a == $b}', '{$name}', '{widget $a}']) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, false, root.toString());
    assert.equal(reference(source).error, null, source);
  }
  const comparison = parser().parse('{$a == $b}').rootNode.firstNamedChild;
  assert.equal(comparison.type, 'output');
  const equalityRhs = parser().parse('{$result = $a == $b}').rootNode.firstNamedChild;
  assert.equal(equalityRhs.type, 'assignment_tag');
  assert.equal(equalityRhs.childForFieldName('value').type, 'binary_expression');
  assert.ok(reference('{widget $a = $b}').error, 'generic tags do not gain assignment grammar');
});

test('Malformed assignments recover the block, comment, later output and closer', () => {
  const cases = [
    ['{if $ok}{$name =}{* keep *}{$later}{/if}', ['$name']],
    ['{if $ok}{$name $value}{* keep *}{$later}{/if}', ['$name', '$value']],
    ['{if $ok}{$names[ = $value}{* keep *}{$later}{/if}', ['$names', '$value']],
    ['{if $ok}{$user->name = $value}{* keep *}{$later}{/if}', ['$user->name', '$value']],
  ];
  for (const [source, pieces] of cases) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, true, root.toString());
    const block = root.descendantsOfType('if_block')[0];
    assert.ok(block, root.toString());
    assert.ok(block.descendantsOfType('if_close_tag').length, root.toString());
    assert.ok(root.descendantsOfType('comment').some(node => node.text.includes('keep')), root.toString());
    assert.ok(root.descendantsOfType('output').some(node => node.childForFieldName('value')?.text === '$later'), root.toString());
    const recovery = block.namedChildren.find(node => node.type === 'assignment_recovery');
    assert.ok(recovery, root.toString());
    assert.equal(recovery.hasError, true, recovery.toString());
    assert.ok(recovery.endIndex <= source.indexOf('{* keep *}'), root.toString());
    assert.deepEqual(recovery.namedChildren.map(node => node.text), pieces, recovery.toString());
  }
  for (const [source] of cases.slice(0, 1)) {
    const result = fullEngine(source, {mode: 'compile'});
    assert.ok(result.error, source);
    assert.match(result.error.message, /Unexpected "}"/);
  }
  const tooMany = fullEngine(cases[1][0], {mode: 'compile'});
  assert.match(tooMany.error?.message ?? '', /too many shorthand attributes/i);
  for (const [source] of cases.slice(2)) assert.ok(fullEngine(source, {mode: 'compile'}).error, source);
});

test('Assignment edit across value and missing-RHS boundaries matches fresh parses', () => {
  const p = parser();
  let source = '{$before}{$name = $value}{$after}';
  let tree = p.parse(source);
  const from = source.indexOf('$value');
  for (const [removed, inserted, error] of [['$value', '', true], ['', "'literal'", false], ["'literal'", '$value', false]]) {
    const startIndex = from;
    const next = source.slice(0, startIndex) + inserted + source.slice(startIndex + removed.length);
    tree.edit({
      startIndex, oldEndIndex: startIndex + removed.length, newEndIndex: startIndex + inserted.length,
      startPosition: {row: 0, column: startIndex}, oldEndPosition: {row: 0, column: startIndex + removed.length},
      newEndPosition: {row: 0, column: startIndex + inserted.length},
    });
    tree = p.parse(next, tree);
    assert.equal(tree.rootNode.hasError, error, tree.rootNode.toString());
    assert.deepEqual(snapshot(tree.rootNode), snapshot(parser().parse(next).rootNode));
    assert.equal(tree.rootNode.namedChildren[0].text, '{$before}');
    assert.equal(tree.rootNode.namedChildren.at(-1).text, '{$after}');
    source = next;
  }
});
