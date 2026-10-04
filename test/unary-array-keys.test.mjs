import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';

const parse = source => parser().parse(source);

for (const { name, source } of fixtures('array-literals.txt').filter(example => example.name.startsWith('unary'))) {
  const root = parse(source).rootNode;
  assert.equal(root.hasError, false, `${name}: ${root.toString()}`);
  const expected = reference(source);
  assert.equal(expected.error, null, `${name}: pinned Smarty rejected fixture`);
  assert.deepEqual(observations(root), expected.events, `${name}: Smarty event projection`);
}

const standalone = '{array(-1=>"v")}{array(not $x=>"v")}';
const standaloneRoot = parse(standalone).rootNode;
const keys = standaloneRoot.descendantsOfType('array_element').map(element => element.childForFieldName('key'));
assert.deepEqual(keys.map(key => key.type), ['unary_expression', 'unary_expression']);
assert.equal(keys[0].childForFieldName('operator')?.text, '-', 'symbolic operator field and range');
assert.deepEqual([keys[0].startIndex, keys[0].endIndex], [7, 9]);
assert.equal(keys[0].childForFieldName('argument')?.text, '1');
assert.equal(keys[1].childForFieldName('operator')?.type, 'word_operator');
assert.equal(keys[1].childForFieldName('operator')?.text, 'not');
assert.equal(keys[1].childForFieldName('argument')?.text, '$x');

for (const key of ['+1', '!$x', '-$x']) {
  const source = `{array(${key}=>"v")}`;
  const root = parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  assert.equal(reference(source).error, null, source);
  const keyNode = root.descendantsOfType('array_element')[0].childForFieldName('key');
  assert.equal(keyNode.type, 'unary_expression', keyNode.toString());
  assert.equal(keyNode.text, key);
}

const tagSource = '{html_options options=array(-1=>" ")+$yes_no_options selected=$selected}{$after}';
const tagRoot = parse(tagSource).rootNode;
assert.equal(tagRoot.hasError, false, tagRoot.toString());
assert.deepEqual(tagRoot.namedChildren.map(node => node.type), ['custom_tag', 'output']);
const tag = tagRoot.namedChildren[0];
assert.equal(tag.childForFieldName('name').text, 'html_options');
const attributes = tag.namedChildren.filter(node => node.type === 'attribute');
assert.deepEqual(attributes.map(node => node.childForFieldName('name').text), ['options', 'selected']);
const expression = attributes[0].childForFieldName('value');
assert.equal(expression.type, 'binary_expression');
assert.equal(expression.childForFieldName('operator').text, '+');
assert.deepEqual([expression.startIndex, expression.endIndex], [22, 52]);
assert.equal(tagSource.slice(expression.startIndex, expression.endIndex), 'array(-1=>" ")+$yes_no_options');
const array = expression.childForFieldName('left');
assert.equal(array.type, 'array_literal');
assert.deepEqual([array.startIndex, array.endIndex], [22, 36]);
assert.equal(tagSource.slice(array.startIndex, array.endIndex), 'array(-1=>" ")');
const element = array.namedChildren[0];
assert.deepEqual([element.startIndex, element.endIndex], [28, 35]);
assert.equal(tagSource.slice(element.startIndex, element.endIndex), '-1=>" "');
assert.equal(element.childForFieldName('key').type, 'unary_expression');
assert.equal(element.childForFieldName('value').text, '" "');
assert.deepEqual([tag.startIndex, tag.endIndex], [0, tagSource.indexOf('}{$after}') + 1]);
assert.deepEqual([attributes[0].startIndex, attributes[0].endIndex], [14, 52]);
assert.deepEqual([element.childForFieldName('key').startIndex, element.childForFieldName('key').endIndex], [28, 30]);
assert.deepEqual([attributes[1].startIndex, attributes[1].endIndex], [53, 71]);
assert.equal(tagSource.slice(attributes[1].startIndex, attributes[1].endIndex), 'selected=$selected');
const tailOutput = tagRoot.namedChildren.at(-1);
assert.deepEqual([tailOutput.startIndex, tailOutput.endIndex], [72, 80]);
assert.equal(tagSource.slice(tailOutput.startIndex, tailOutput.endIndex), '{$after}');
assert.equal(reference('{html_options options=array(-1=>" ")}').error, null);
const completeTag = tagSource.slice(0, tagSource.indexOf('}{$after}') + 1);
assert.equal(reference(completeTag).error, null);
assert.equal(fullEngine(completeTag, { mode: 'compile' }).error, null);
const applicationLine = readFileSync(new URL('../corpus/application/view_orders/new_article.tpl', import.meta.url), 'utf8')
  .split(/\r?\n/)[4];
const applicationTag = applicationLine.match(/\{html_options[^}]+\}/)?.[0];
assert.ok(applicationTag, 'application-shaped html_options tag exists on line 5');
assert.equal(reference(applicationTag).error, null, 'pinned recorder accepts exact application tag');

for (const source of [
  '{html_options options=array(-=>"v") selected=$selected}{$after}',
  '{html_options options=array(-1=>) selected=$selected}{$after}',
]) {
  const root = parse(source).rootNode;
  assert.equal(root.hasError, true, root.toString());
  assert.ok(reference(source).error, `recording compiler accepted malformed source ${source}`);
  assert.ok(fullEngine(source, { mode: 'compile' }).error, `full compiler accepted malformed source ${source}`);
  const tail = root.namedChildren.at(-1);
  assert.equal(tail.type, 'output', root.toString());
  assert.equal(tail.text, '{$after}');
  assert.equal(tail.hasError, false, tail.toString());
}

const acceptedCompound = '{array((1+2)=>"v")}';
assert.equal(parse(acceptedCompound).rootNode.hasError, false);
assert.equal(reference(acceptedCompound).error, null);
assert.equal(fullEngine(acceptedCompound, { mode: 'compile' }).error, null);
const rejectedCompound = '{array(1+2=>"v")}';
assert.equal(parse(rejectedCompound).rootNode.hasError, true);
assert.ok(reference(rejectedCompound).error);
assert.ok(fullEngine(rejectedCompound, { mode: 'compile' }).error);

const p = parser();
let source = '{array(1=>"v")}{after $value}';
let tree = p.parse(source);
for (const [before, after, hasError] of [
  ['1=>"v"', '-1=>"v"', false],
  ['-1=>"v"', '-=>"v"', true],
  ['-=>"v"', '-2=>"v"', false],
]) {
  const startIndex = source.indexOf(before);
  const nextSource = source.slice(0, startIndex) + after + source.slice(startIndex + before.length);
  tree.edit({
    startIndex, oldEndIndex: startIndex + before.length, newEndIndex: startIndex + after.length,
    startPosition: { row: 0, column: startIndex }, oldEndPosition: { row: 0, column: startIndex + before.length },
    newEndPosition: { row: 0, column: startIndex + after.length },
  });
  tree = p.parse(nextSource, tree);
  assert.equal(tree.rootNode.hasError, hasError, tree.rootNode.toString());
  assert.deepEqual(snapshot(tree.rootNode), snapshot(parse(nextSource).rootNode));
  assert.equal(tree.rootNode.namedChildren.at(-1).text, '{after $value}');
  source = nextSource;
}
