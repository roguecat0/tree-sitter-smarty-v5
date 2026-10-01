import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixtures,fullEngine,observations,parser,reference,snapshot} from './helpers.mjs';
const examples = fixtures('primitive-literals.txt');
assert.equal(examples.length, 7);
for(const {name,source} of examples) test(`Primitive reference: ${name}`,()=>{
 const root=parser().parse(source).rootNode; assert.equal(root.hasError,false,root.toString());
 const expected=reference(source); assert.equal(expected.error,null,source); assert.deepEqual(observations(root),expected.events);
});
test('Primitive types, spelling and ranges',()=>{
 const root=parser().parse('{TrUe}{FaLsE}{NuLl}').rootNode;
 assert.deepEqual(root.namedChildren.map(n=>{const v=n.childForFieldName('value');return [v.type,v.text,v.startIndex,v.endIndex,v.namedChildCount];}), [['boolean','TrUe',1,5,0],['boolean','FaLsE',7,12,0],['null','NuLl',14,18,0]]);
});
test('Primitive full-engine types and case independently verified',()=>{
 for(const expression of ['true === TRUE','false === FaLsE','null === NULL',"true !== 'true'","false !== 'false'","null !== 'null'",'true !== false','null !== false']) {
   const result=fullEngine(`{if ${expression}}T{else}F{/if}`); assert.equal(result.error,null); assert.equal(result.result,'T',expression);
 }
});
test('Bare primitive indices are excluded section names, not literal values',()=>{
 const values={a:{0:'zero',1:'one','':'empty'}};
 for(const word of ['true','false','null','TRUE','FaLsE','NuLl']) {
   const source=`{$a[${word}]}`;
   assert.equal(reference(source).error,null);
   const result=fullEngine(source,{values}); assert.equal(result.error,null); assert.equal(result.result,'empty');
   assert.equal(parser().parse(source).rootNode.hasError,true,source);
 }
 for(const [word,output] of [['true','one'],['false','zero'],['null','empty']]) {
   const source=`{$a[(${word})]}`; const result=fullEngine(source,{values}); assert.equal(result.error,null);assert.equal(result.result,output);
   assert.equal(parser().parse(source).rootNode.hasError,false);
 }
});
test('Primitive whole words and incomplete forms do not leak prefixes',()=>{
 for(const word of ['trueish','FALSEhood','nullary','TRUE_widget','null0']) {
   assert.equal(parser().parse(`{${word}}`).rootNode.firstNamedChild.type,'custom_tag');
   const source=`{$a->f(${word})}`, callRoot=parser().parse(source).rootNode;
   assert.equal(callRoot.hasError,false,`${source}: ${callRoot.toString()}`);
   const argument=callRoot.firstNamedChild.childForFieldName('value').childrenForFieldName('argument')[0];
   assert.deepEqual([argument.type,argument.text],['identifier',word]);
   assert.equal(reference(source).error,null,source);
   const tagValue = parser().parse(`{widget value=${word}}`).rootNode;
   assert.equal(tagValue.hasError,false,`{widget value=${word}}`);
   assert.equal(tagValue.firstNamedChild.namedChildren[1].childForFieldName('value').type,'identifier');
 }
 for(const source of ['{true ===}', '{!}', '{TRUE value=1}', '{/if}', '{if}', '{foreach}']) assert.equal(parser().parse(source).rootNode.hasError,true,source);
 const identifierArgument=parser().parse('{$a->f(tru)}').rootNode.firstNamedChild.childForFieldName('value').childrenForFieldName('argument')[0];
 assert.deepEqual([identifierArgument.type,identifierArgument.text],['identifier','tru']);
});
test('Primitive incremental opening tag and argument keyword boundaries',()=>{
 for(const [initial,before,after,error] of [['{$before}{true}{$after}','true','true_widget',false],['{$before}{$a->f(true)}{$after}','true','trueish',false]]) {
  const p=parser();let source=initial,tree=p.parse(source);const startIndex=source.indexOf(before);
  for(const [removed,added,hasError] of [[before,after,error],[after,before,false]]) {
   const next=source.slice(0,startIndex)+added+source.slice(startIndex+removed.length);
   tree.edit({startIndex,oldEndIndex:startIndex+removed.length,newEndIndex:startIndex+added.length,startPosition:{row:0,column:startIndex},oldEndPosition:{row:0,column:startIndex+removed.length},newEndPosition:{row:0,column:startIndex+added.length}});
   tree=p.parse(next,tree);assert.equal(tree.rootNode.hasError,hasError);assert.equal(tree.rootNode.firstNamedChild.text,'{$before}'); assert.equal(tree.rootNode.lastNamedChild.text,'{$after}');
   assert.deepEqual(snapshot(tree.rootNode),snapshot(parser().parse(next).rootNode));source=next;
  }
 }
});

test('Recorder observes deferred literal modifier lists and still rejects malformed arguments',()=>{
 const source='{true|unregistered_one:2|unregistered_two:false:null}';
 const expected=[{kind:'modifier',name:'unregistered_one',arguments:1},{kind:'modifier',name:'unregistered_two',arguments:2},{kind:'output'}];
 const result=reference(source); assert.equal(result.error,null); assert.deepEqual(result.events,expected);
 const root=parser().parse(source).rootNode; assert.equal(root.hasError,false); assert.deepEqual(observations(root),expected);
 assert.ok(reference('{true|unregistered_one:}').error);
});
