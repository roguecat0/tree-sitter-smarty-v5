import assert from 'node:assert/strict';
import { test } from 'node:test';
import {fixtures, observations, parser, reference, fullEngine, snapshot} from './helpers.mjs';

const examples = fixtures('foreach.txt');
assert.equal(examples.length, 8);
for (const {name,source} of examples) test(`Foreach reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError,false,root.toString());
  const expected = reference(source);
  assert.equal(expected.error,null);
  assert.deepEqual(observations(root),expected.events);
});

test('Foreach source order and field ranges differ deliberately from reference argument order', () => {
  const source = '{foreach $items as $key => $item}{/foreach}';
  const tag = parser().parse(source).rootNode.firstNamedChild.firstNamedChild;
  assert.equal(tag.type,'foreach_tag');
  for(const [field,text,start,end] of [['source','$items',9,15],['key','$key',19,23],['item','$item',27,32]]) {
    const node = tag.childForFieldName(field);
    assert.equal(node.type,'variable');
    assert.deepEqual([node.text,node.startIndex,node.endIndex],[text,start,end]);
  }
  assert.deepEqual(tag.namedChildren.map(n=>n.text),['$items','$key','$item']);
  assert.deepEqual(reference(source).events[0].arguments,[{name:'from'},{name:'item'},{name:'key'}]);
});

test('Foreach required whitespace and contextual as keyword', () => {
  for(const gap of [' ','\t','\n','\r\n']) {
    const source = `{foreach${gap}$items${gap}as${gap}$key=>${gap}$item}{/foreach}`;
    assert.equal(reference(source).error,null,source);
    assert.equal(parser().parse(source).rootNode.hasError,false,source);
  }
  for(const source of ['{foreach$items as $item}{/foreach}','{foreach $items as$item}{/foreach}']) {
    assert.ok(reference(source).error,source);
    assert.equal(parser().parse(source).rootNode.hasError,true,source);
  }
  const legacy = '{foreach $items asdf $item}{/foreach}';
  assert.equal(reference(legacy).error,null);
  const legacyTree=parser().parse(legacy).rootNode;
  assert.equal(legacyTree.hasError,false,legacy);
  assert.deepEqual(legacyTree.firstNamedChild.firstNamedChild.firstNamedChild.childrenForFieldName('argument').map(n=>n.text), ['$items','asdf','$item']);
  const legacyError=fullEngine(legacy,{mode:'compile'}).error;
  assert.equal(legacyError?.type,'Smarty\\CompilerException');
  assert.match(legacyError.message,/key.*illegal value/i);
});

test('Foreach malformed modern forms and compiler-invalid positional values stay distinct', () => {
  const cases = ['{foreach $items as }{/foreach}','{foreach $items as $key =>}{/foreach}',
    '{foreach $items as item}{/foreach}'];
  for(const source of cases) assert.equal(parser().parse(source).rootNode.hasError,true,source);
  for(const source of ['{foreach $items item}{/foreach}','{foreach $items item key loop}{/foreach}',
    '{foreach from=$items item=item}{/foreach}']) {
    assert.equal(reference(source).error,null,source);
    assert.equal(fullEngine(source,{mode:'compile'}).error,null,source);
    const root=parser().parse(source).rootNode;
    assert.equal(root.hasError,false,source);
    const header=root.firstNamedChild.firstNamedChild.firstNamedChild;
    assert.equal(header.type,'legacy_foreach_header');
    assert.ok(header.namedChildren.length >= 2);
  }
  const positionalVariable='{foreach $items $item}{/foreach}';
  const positionalTree=parser().parse(positionalVariable).rootNode;
  assert.equal(positionalTree.hasError,false,positionalVariable);
  assert.deepEqual(positionalTree.firstNamedChild.firstNamedChild.firstNamedChild.childrenForFieldName('argument').map(n=>n.text), ['$items','$item']);
  const positionalError=fullEngine(positionalVariable,{mode:'compile'}).error;
  assert.equal(positionalError?.type,'Smarty\\CompilerException');
  assert.match(positionalError.message,/item.*illegal value/i);
});

test('Full compiler validates branch ownership that recording deliberately bypasses', () => {
  for(const source of ['{foreachelse}', '{foreach $items as $item}',
    '{foreach $items as $item}{foreachelse}{foreachelse}{/foreach}',
    '{if $ok}{foreach $items as $item}{/if}{/foreach}',
    '{foreach $items as $item}{if $ok}{foreachelse}{/if}{/foreach}']) {
    assert.equal(reference(source).error,null,source);
    assert.equal(parser().parse(source).rootNode.hasError,true,source);
    const result = fullEngine(source,{mode:'compile'});
    assert.equal(result.error?.type,'Smarty\\CompilerException',source);
  }
  const source = '{foreach $items as $key => $item}{$key}:{$item};{foreachelse}Empty{/foreach}';
  for(const [items,expected] of [[[10,20],'0:10;1:20;'],[[],'Empty']]) {
    const result = fullEngine(source,{values:{items}});
    assert.equal(result.error,null);
    assert.equal(result.result,expected);
  }
});

test('Foreach close and key-arrow edits match fresh recovery trees', () => {
  const p = parser();
  let source = '{$before}{if $ok}{foreach $items as $key => $item}{$item}{/foreach}{/if}';
  let tree = p.parse(source);
  for(const [before,after,error] of [['{/foreach}','',true],['{/if}','{/foreach}{/if}',false],['=>','',true],['$key  $item','$key => $item',false]]) {
    const startIndex = source.indexOf(before);
    assert.notEqual(startIndex,-1);
    const next = source.slice(0,startIndex)+after+source.slice(startIndex+before.length);
    tree.edit({startIndex,oldEndIndex:startIndex+before.length,newEndIndex:startIndex+after.length,
      startPosition:{row:0,column:startIndex},oldEndPosition:{row:0,column:startIndex+before.length},newEndPosition:{row:0,column:startIndex+after.length}});
    tree=p.parse(next,tree);
    assert.equal(tree.rootNode.hasError,error,next);
    assert.equal(tree.rootNode.firstNamedChild.text,'{$before}');
    assert.deepEqual(snapshot(tree.rootNode),snapshot(parser().parse(next).rootNode));
    source=next;
  }
});
