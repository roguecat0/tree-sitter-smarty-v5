import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const examples = fixtures('for-loops.txt');
assert.equal(examples.length, 11);
for (const {name, source} of examples) test(`For loop reference projection: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expected = reference(source);
  assert.equal(expected.error, null);
  assert.deepEqual(observations(root), expected.events);
});

test('Bare trailing range shorthand is preserved by the parser and rejected only by full compilation', () => {
  const source = '{for $i=0 to 3 step}{$i}{/for}';
  const expected = reference(source);
  assert.equal(expected.error, null);
  assert.deepEqual(expected.events[0], {kind: 'tag', name: 'for', arguments: [
    {name: null}, {name: 'start'}, {name: 'to'},
  ]});
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const header = root.firstNamedChild.firstNamedChild.namedChildren[0];
  const bare = header.childForFieldName('argument');
  assert.deepEqual([bare.type, bare.text, bare.startIndex, bare.endIndex], [
    'identifier', 'step', source.indexOf('step'), source.indexOf('step') + 4,
  ]);
  const compiled = fullEngine(source, {mode: 'compile'});
  assert.equal(compiled.error?.type, 'Smarty\\CompilerException');
  assert.match(compiled.error?.message ?? '', /too many shorthand attributes/);
});

test('For header fields retain exact source text and boundaries', () => {
  const source = '{for $i=1 to 3 step 2 max=4 nocache}{$i}{/for}';
  const tag = parser().parse(source).rootNode.firstNamedChild.firstNamedChild;
  const header = tag.namedChildren[0];
  assert.equal(header.type, 'range_for_header');
  for (const [field, text] of [['target', '$i'], ['start', '1'], ['end', '3'], ['step', '2'], ['max', '4']]) {
    const node = header.childForFieldName(field);
    assert.equal(node.text, text);
    assert.equal(source.slice(node.startIndex, node.endIndex), text);
  }
  const keywordTokens = header.children.filter(child => child.type === 'to' || child.type === 'step');
  assert.deepEqual(keywordTokens.map(node => [node.type, node.text, node.startIndex, node.endIndex]), [
    ['to', 'to', source.indexOf('to'), source.indexOf('to') + 2],
    ['step', 'step', source.indexOf('step'), source.indexOf('step') + 4],
  ]);
  for (const token of keywordTokens) {
    assert.equal(source.slice(token.startIndex, token.endIndex), token.text);
  }
  const max = source.indexOf('max');
  const nocache = source.indexOf('nocache');
  for (const [needle, index] of [['max', max], ['nocache', nocache]]) {
    assert.equal(source.slice(index, index + needle.length), needle);
  }
  assert.deepEqual([header.startIndex, header.endIndex], [source.indexOf('$i'), nocache + 'nocache'.length]);
});

test('For C-style header keeps initializer order, separators, and update ranges', () => {
  const source = '{for $i=0,$j=1; $i<3; $i++}{$i}{/for}';
  const tag = parser().parse(source).rootNode.firstNamedChild.firstNamedChild;
  const header = tag.namedChildren[0];
  assert.equal(header.type, 'c_style_for_header');
  assert.deepEqual(header.childrenForFieldName('initializer').map(node => node.text), ['$i=0', '$j=1']);
  assert.equal(header.childForFieldName('condition').text, '$i<3');
  const update = header.childForFieldName('update');
  assert.equal(update.text, '$i++');
  assert.equal(update.childForFieldName('target').text, '$i');
  const operator = update.childForFieldName('operator');
  assert.deepEqual([operator.text, operator.startIndex, operator.endIndex], ['++', source.indexOf('++'), source.indexOf('++') + 2]);
  const semicolons = header.children.filter(child => child.type === ';');
  assert.deepEqual(semicolons.map(node => [node.text, node.startIndex, node.endIndex]), [
    [';', 14, 15], [';', 20, 21],
  ]);
  for (const semicolon of semicolons) {
    assert.equal(source.slice(semicolon.startIndex, semicolon.endIndex), ';');
  }
});

test('Range/C-style parse trees are structural; compiler validation remains distinct', () => {
  const valid = [
    '{for $i=0 to 2}{$i}{/for}',
    '{for $i=1 to 5 step 2 max=4}{$i}{/for}',
    '{for $i=0; $i<3; $i++}{$i}{/for}',
    '{for $i=0; $i<3; $i=$i+1}{$i}{/for}',
    '{for $i=3; $i>0; $i--}{$i}{/for}',
    '{for $a[$k]=0 to 3}{$a[$k]}{/for}',
    '{for $a[$k]=0; $a[$k]<3; $a[$k]++}{$a[$k]}{/for}',
    '{for $i=0; $i<3; $i++ nocache}{$i}{/for}',
  ];
  for (const source of valid) {
    assert.equal(reference(source).error, null, source);
    assert.equal(parser().parse(source).rootNode.hasError, false, source);
    assert.equal(fullEngine(source, {mode: 'compile'}).error, null, source);
  }

  const syntacticButCompilerInvalid = '{for $i=0; $i<3; $i++ max=2}{$i}{/for}';
  assert.equal(reference(syntacticButCompilerInvalid).error, null);
  assert.equal(parser().parse(syntacticButCompilerInvalid).rootNode.hasError, false);
  assert.equal(fullEngine(syntacticButCompilerInvalid, {mode: 'compile'}).error?.type, 'Smarty\\CompilerException');

  const parserInvalid = [
    '{for $i=1 to 3 max=4 step 2}{$i}{/for}',
    '{for $i=0 to}{$i}{/for}',
    '{for $i=0 $i<3; $i++}{$i}{/for}',
    '{for $i=0; $i<3 $i++}{$i}{/for}',
    '{for $i=0; $i<3; ++}{$i}{/for}',
  ];
  for (const source of parserInvalid) {
    assert.ok(reference(source).error, source);
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
  }
});

test('Full Smarty compiler validates for branch ownership the recorder skips', () => {
  const invalid = [
    '{forelse}',
    '{for $i=0 to 2}',
    '{for $i=0 to 2}{forelse}{forelse}{/for}',
    '{if $ok}{for $i=0 to 2}{/if}{/for}',
    '{for $i=0 to 2}{if $ok}{forelse}{/if}{/for}',
  ];
  for (const source of invalid) {
    assert.equal(reference(source).error, null, source);
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
    assert.equal(fullEngine(source, {mode: 'compile'}).error?.type, 'Smarty\\CompilerException', source);
  }
  const nested = '{for $i=0 to 1}{foreach $items as $item}{if $item}{$i}{/if}{foreachelse}none{/foreach}{forelse}zero{/for}';
  assert.equal(fullEngine(nested, {values: {items: []}}).error, null);
});

test('Malformed for syntax recovers independent following siblings and the right closer', () => {
  const malformedCStyle = 'before {for $i=0; $i<3; }bad{/for} after {if $ok}yes{/if} {$later}';
  const malformedCStyleTree = parser().parse(malformedCStyle).rootNode.toString();
  assert.equal(malformedCStyleTree,
    '(source_file (text) (ERROR (for_initializer target: (variable name: (identifier)) value: (number)) (binary_expression left: (variable name: (identifier)) right: (number)) (string_fragment) (text)) (if_block (if_tag condition: (variable name: (identifier))) (text) (if_close_tag)) (text) (output value: (variable name: (identifier))))');
  for (const source of [
    'before {for $i=0 to }bad{/for} after {$later}',
    'before {for $i=0; $i<3; }bad{/for} after {if $ok}yes{/if} {$later}',
    'before {for $i=0; ; $i++}bad{/for} after {$later}',
  ]) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError, true, source);
    assert.equal(root.namedChildren.at(-1).type, 'output', root.toString());
    assert.equal(root.namedChildren.at(-1).text, '{$later}');
    const descendants = node => [node, ...node.namedChildren.flatMap(descendants)];
    const nodes = descendants(root);
    if (source.includes('{if')) assert.ok(nodes.some(node => node.type === 'if_close_tag'), root.toString());
    else assert.ok(nodes.some(node => node.type === 'for_close_tag'), root.toString());
    assert.ok(nodes.some(node => node.type === 'text'), root.toString());
  }
});

test('Range and C-style boundary edits match fresh full recovery snapshots', () => {
  const p = parser();
  const edits = [
    ['{for $i=0 to 2}{forelse}none{/for} {$after}', 'to', '', true],
    ['{for $i=0  2}{forelse}none{/for} {$after}', '  ', ' to ', false],
    ['{for $i=0; $i<2; $i++}{forelse}none{/for} {$after}', ';', '', true],
    ['{for $i=0 $i<2; $i++}{forelse}none{/for} {$after}', ' $i<2', '; $i<2', false],
  ];
  for (const [initial, needle, replacement, hasError] of edits) {
    let source = initial;
    let tree = p.parse(source);
    const startIndex = source.indexOf(needle);
    assert.notEqual(startIndex, -1, initial);
    const next = source.slice(0, startIndex) + replacement + source.slice(startIndex + needle.length);
    tree.edit({startIndex, oldEndIndex: startIndex + needle.length, newEndIndex: startIndex + replacement.length,
      startPosition: {row: 0, column: startIndex}, oldEndPosition: {row: 0, column: startIndex + needle.length},
      newEndPosition: {row: 0, column: startIndex + replacement.length}});
    tree = p.parse(next, tree);
    assert.equal(tree.rootNode.hasError, hasError, next);
    assert.equal(tree.rootNode.namedChildren.at(-1).text, '{$after}');
    assert.deepEqual(snapshot(tree.rootNode), snapshot(p.parse(next).rootNode));
  }
});
