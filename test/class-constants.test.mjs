import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixtures,observations,parser,reference,snapshot} from './helpers.mjs';
const examples=fixtures('class-constants.txt');
assert.equal(examples.length,10);
for(const {name,source} of examples) test(`Class constant reference: ${name}`,()=>{
 const root=parser().parse(source).rootNode; assert.equal(root.hasError,false,root.toString());
 const expected=reference(source); assert.equal(expected.error,null,source); assert.deepEqual(observations(root),expected.events);
});
test('Class and constant fields retain exact names ranges and separator',()=>{
 const source='{Thing::ready}';const node=parser().parse(source).rootNode.firstNamedChild.childForFieldName('value');
 assert.equal(node.type,'class_constant_expression');
 for(const [field,text,start,end] of [['class','Thing',1,6],['constant','ready',8,13]]) {
  const child=node.childForFieldName(field);assert.deepEqual([child.type,child.text,child.startIndex,child.endIndex],['identifier',text,start,end]);
 }
 assert.deepEqual(node.children.filter(n=>!n.isNamed).map(n=>n.text),['::']);
});
test('Class constants retain key and value fields inside one array element',()=>{
 const source='{[State::KEY=>State::READY]}';
 const root=parser().parse(source).rootNode;
 assert.equal(root.hasError,false,root.toString());
 const element=root.descendantsOfType('array_element')[0];
 assert.equal(element.childForFieldName('key').type,'class_constant_expression');
 assert.equal(element.childForFieldName('key').childForFieldName('constant').text,'KEY');
 assert.equal(element.childForFieldName('value').type,'class_constant_expression');
 assert.equal(element.childForFieldName('value').childForFieldName('constant').text,'READY');
 const expected=reference(source);assert.equal(expected.error,null);assert.deepEqual(observations(root),expected.events);
});
test('Constant keyword contexts and names require no application registry',()=>{
 for(const className of ['if','else','elseif','foreach','foreachelse','true','FaLsE','NULL','self_widget','parental','Z9']) {
  const source=`{${className}::true}`; assert.equal(reference(source).error,null,source);assert.equal(parser().parse(source).rootNode.hasError,false,source);
 }
 for(const name of ['a','unknown_927','Z9']) {
  const source=`{${name} value=Unregistered::VALUE|${name}}{/other_${name}}`;
  const root=parser().parse(source).rootNode; assert.equal(root.hasError,false);
  assert.equal(root.descendantsOfType('class_constant_expression').length,1);
  const expected=reference(source);assert.equal(expected.error,null);assert.deepEqual(observations(root),expected.events);
 }
 for(const source of ['{if}','{else}','{foreach}','{if $ok}x{/other}']) assert.equal(parser().parse(source).rootNode.hasError,true,source);
});
test('Constant delimiters adjacency and explicit scope exclusions',()=>{
 for(const source of ['{::READY}','{Thing::}','{Thing:READY}','{Thing:::READY}','{Thing ::READY}','{Thing:: READY}','{Thing\n::READY}','{Thing::\nREADY}','{Thing::READY[0]}']) {
  assert.equal(parser().parse(source).rootNode.hasError,true,source);assert.ok(reference(source).error,source);
 }
 for(const name of ['self','SELF','SeLf','parent','PARENT','PaReNt']) {
  const source=`{${name}::READY}`;assert.equal(parser().parse(source).rootNode.hasError,true,source);assert.match(reference(source).error,/static class/);
 }
 for(const source of ['{\\App\\Thing::READY}','{Thing::READY->name}']) {
  assert.equal(reference(source).error,null,source);assert.equal(parser().parse(source).rootNode.hasError,true,source);
 }
 const methodSource='{Thing::READY()}';
 assert.equal(reference(methodSource).error,null,methodSource);
 const methodRoot=parser().parse(methodSource).rootNode;
 assert.equal(methodRoot.hasError,false,methodRoot.toString());
 assert.equal(methodRoot.firstNamedChild.childForFieldName('value').type,'static_method_call_expression');
 for(const source of ['{$class::READY}','{Thing::$member}']) assert.equal(parser().parse(source).rootNode.hasError,true,source);
});
test('Constant output boundary and broken colon edits match fresh trees',()=>{
 for(const [initial,before,after,error] of [['{$before}{State}{$after}','State','State::READY',false],['{$before}{if $status == State::READY}Y{/if}{$after}','::',':',true]]) {
  const p=parser();let source=initial,tree=p.parse(source);const startIndex=source.indexOf(before);
  for(const [removed,added,hasError] of [[before,after,error],[after,before,false]]) {
   const next=source.slice(0,startIndex)+added+source.slice(startIndex+removed.length);
   tree.edit({startIndex,oldEndIndex:startIndex+removed.length,newEndIndex:startIndex+added.length,startPosition:{row:0,column:startIndex},oldEndPosition:{row:0,column:startIndex+removed.length},newEndPosition:{row:0,column:startIndex+added.length}});
   tree=p.parse(next,tree);assert.equal(tree.rootNode.hasError,hasError,next);assert.equal(tree.rootNode.firstNamedChild.text,'{$before}');assert.equal(tree.rootNode.lastNamedChild.text,'{$after}');
   assert.deepEqual(snapshot(tree.rootNode),snapshot(parser().parse(next).rootNode));source=next;
  }
 }
});

test('Reserved class receivers remain ordinary custom tag names',()=>{
 for(const name of ['self','SELF','parent','PaReNt']) {
  const source=`{${name}}{/${name}}`;
  const root=parser().parse(source).rootNode;
  assert.equal(root.hasError,false,source);
  assert.deepEqual(root.namedChildren.map(n=>n.type),['custom_tag','custom_close_tag']);
  const expected=reference(source);assert.equal(expected.error,null);assert.deepEqual(observations(root),expected.events);
 }
});
