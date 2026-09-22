import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, observations, parser, reference, snapshot } from './helpers.mjs';
const examples = fixtures('object-method-calls.txt');
assert.equal(examples.length, 6);
for (const { name, source } of examples) test(`Method reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const expected = reference(source);
  assert.equal(expected.error, null);
  assert.deepEqual(observations(root), expected.events);
});
test('Method names, argument order, ranges and punctuation', () => {
  const source = '{$user->find($id, 2)}';
  const call = parser().parse(source).rootNode.firstNamedChild.childForFieldName('value');
  assert.equal(call.type, 'method_call_expression');
  assert.equal(call.childForFieldName('object').text, '$user');
  const method = call.childForFieldName('method');
  assert.deepEqual([method.type, method.text, method.startIndex, method.endIndex], ['identifier','find',8,12]);
  assert.deepEqual(call.childrenForFieldName('argument').map(n => n.text), ['$id','2']);
  assert.deepEqual(call.children.filter(n => !n.isNamed).map(n => n.text), ['->','(',',',')']);
});
test('Method whitespace and keyword names', () => {
  for (const gap of ['', ' ', '\t', '\n', '\r\n']) for (const name of ['f','if','else','elseif']) {
    const source = `{$a${gap}->${gap}${name}${gap}(${gap}1${gap},${gap}2${gap})}`;
    assert.equal(reference(source).error, null, source);
    assert.equal(parser().parse(source).rootNode.hasError, false, source);
  }
});
test('Method negative boundaries and explicit leading-comma discrepancy', () => {
  for (const source of ['{$a->f(}', '{$a->f(1,)}', '{$a->f(1,,2)}']) {
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
    assert.ok(reference(source).error, source);
  }
  assert.equal(reference('{$a->f(,1)}').error, null);
  for (const source of ['{$a->f(,1)}','{$a->f(f(1))}','{$a->$f()}','{$a::f()}','{$a->f(x:1)}','{$a->f(...$b)}','{($a)->f()}','{$a->f()[0]}'])
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
});
test('Method incremental delete and restore closing parenthesis', () => {
  const p = parser(); let source = '{$before}{if $a->f()}{$a->g()|escape}{/if}'; let tree = p.parse(source);
  const startIndex = source.indexOf(')');
  for (const [removed, added, error] of [[')', '', true], ['', ')', false]]) {
    const next = source.slice(0,startIndex)+added+source.slice(startIndex+removed.length);
    tree.edit({startIndex,oldEndIndex:startIndex+removed.length,newEndIndex:startIndex+added.length,startPosition:{row:0,column:startIndex},oldEndPosition:{row:0,column:startIndex+removed.length},newEndPosition:{row:0,column:startIndex+added.length}});
    tree = p.parse(next,tree);
    assert.equal(tree.rootNode.hasError,error);
    assert.equal(tree.rootNode.firstNamedChild.text,'{$before}');
    assert.deepEqual(snapshot(tree.rootNode),snapshot(parser().parse(next).rootNode)); source=next;
  }
});

test('Renamed generic attributes and modifiers keep method structure', () => {
  for (const name of ['a','extension_927','Z9']) {
    const source = `{${name} value=$a->f() other=$b->g()|${name}}{/different_${name}}`;
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError,false);
    assert.equal(root.descendantsOfType('method_call_expression').length,2);
    const expected = reference(source);
    assert.equal(expected.error,null);
    assert.deepEqual(observations(root),expected.events);
  }
});
