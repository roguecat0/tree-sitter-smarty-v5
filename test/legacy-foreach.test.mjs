import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixtures, observations, parser, reference, fullEngine, snapshot} from './helpers.mjs';

const examples = fixtures('legacy-foreach.txt');
for (const {name, source} of examples) test(`Legacy foreach tree/reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  assert.equal(reference(source).error, null);
  assert.deepEqual(observations(root), reference(source).events);
});

test('Legacy foreach headers preserve named fields, source order, ranges and option identity', () => {
  const source = '{foreach from=$items item=$item key=$key name=rows properties="first,last" nocache}{/foreach}';
  const tag = parser().parse(source).rootNode.firstNamedChild.firstNamedChild;
  assert.equal(tag.type, 'foreach_tag');
  const header = tag.firstNamedChild;
  assert.equal(header.type, 'legacy_foreach_header');
  const entries = header.namedChildren;
  assert.deepEqual(entries.map(node => node.type), ['attribute','attribute','attribute','attribute','attribute','foreach_option']);
  assert.deepEqual(entries.slice(0,5).map(node => [node.childForFieldName('name')?.text,node.childForFieldName('value')?.text]), [
    ['from','$items'],['item','$item'],['key','$key'],['name','rows'],['properties','"first,last"'],
  ]);
  for (const [node, text] of entries.slice(0,5).map((node, i) => [node, ['from=$items','item=$item','key=$key','name=rows','properties="first,last"'][i]])) {
    assert.equal(source.slice(node.startIndex,node.endIndex), text);
  }
  const option = entries.at(-1);
  assert.equal(option.text,'nocache');
  assert.deepEqual([option.startIndex,option.endIndex],[source.indexOf('nocache'),source.indexOf('nocache')+7]);
});

test('Legacy positional arguments retain source order without compiler normalization', () => {
  const source = '{foreach $items item key loop}{/foreach}';
  const header = parser().parse(source).rootNode.firstNamedChild.firstNamedChild.firstNamedChild;
  const arguments_ = header.childrenForFieldName('argument');
  assert.deepEqual(arguments_.map(node => node.text), ['$items','item','key','loop']);
  assert.deepEqual(header.childrenForFieldName('argument').map(node => node.type), ['variable','identifier','identifier','identifier']);
  assert.deepEqual(arguments_.map(node => source.slice(node.startIndex,node.endIndex)), ['$items','item','key','loop']);
});

test('Empty legacy foreach header is parser syntax; required attributes are compiler validation', () => {
  const source = '{foreach}x{/foreach}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError,false,root.toString());
  assert.equal(root.firstNamedChild.firstNamedChild.type,'foreach_tag');
  assert.equal(root.firstNamedChild.firstNamedChild.childForFieldName('source'),null);
  assert.equal(root.firstNamedChild.firstNamedChild.namedChildCount,0);
  assert.equal(reference(source).error,null);
  assert.equal(fullEngine(source,{mode:'compile'}).error?.type,'Smarty\\CompilerException');
  for (const [source, fragment] of [
    ['{foreach from=$items}{/foreach}',"missing 'item' attribute"],
    ['{foreach item=item}{/foreach}',"missing 'from' attribute"],
    ['{foreach from=$items item=item extra=x}{/foreach}',"Unexpected 'extra' attribute"],
  ]) {
    const tree = parser().parse(source).rootNode;
    assert.equal(tree.hasError,false,tree.toString());
    const result = fullEngine(source,{mode:'compile'});
    assert.equal(result.error?.type,'Smarty\\CompilerException',JSON.stringify(result));
    assert.ok(result.error.message.toLowerCase().includes(fragment.toLowerCase()),result.error.message);
  }
  const valid = '{foreach from=$items item=item key=key name=rows properties="first,last" nocache}{/foreach}';
  assert.equal(fullEngine(valid,{mode:'compile'}).error,null);
});

test('Legacy foreach source syntax errors recover without losing adjacent syntax', () => {
  const broken = '{foreach from=$items item=}x{/foreach}{$after}{if $ok}{/if}';
  assert.ok(reference(broken).error);
  const root = parser().parse(broken).rootNode;
  assert.equal(root.hasError,true,root.toString());
  assert.ok(root.toString().includes('(output value: (variable name: (identifier)))'),root.toString());
  assert.ok(root.toString().includes('(if_block'),root.toString());
  for(const source of ['{foreach from=','{foreach from=$items item=', '{foreach from=$items key=}']) {
    const tree = parser().parse(source+'}{$tail}').rootNode;
    assert.equal(tree.hasError,true,tree.toString());
    assert.ok(tree.toString().includes('(output'),tree.toString());
  }
});

test('Full compiler validates foreach branch ownership for legacy and modern loops', () => {
  const bad = [
    '{foreachelse}',
    '{foreach from=$items item=item}',
    '{foreach from=$items item=item}{foreachelse}{foreachelse}{/foreach}',
    '{for $i=0 to 1}{foreach from=$items item=item}{/for}{/foreach}',
    '{foreach from=$items item=item}{if $ok}{foreachelse}{/if}{/foreach}',
  ];
  for (const source of bad) {
    assert.equal(reference(source).error,null,source);
    const result = fullEngine(source,{mode:'compile'});
    assert.equal(result.error?.type,'Smarty\\CompilerException',source+': '+JSON.stringify(result));
  }
  for (const source of ['{foreach from=$items item=item}{foreachelse}empty{/foreach}',
                        '{foreach $items as $item}{foreachelse}empty{/foreach}']) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError,false,root.toString());
    assert.equal(root.firstNamedChild.namedChildren.filter(n=>n.type==='foreachelse_clause').length,1);
    assert.equal(fullEngine(source,{mode:'compile'}).error,null);
  }
  const boundaries = [
    ['{foreach from=$items item=item}{forelse}{/foreach}', true],
    ['{for $i=0 to 1}{foreachelse}{/for}', true],
    ['{if $ok}{foreachelse}{/if}', true],
  ];
  for(const [source,hasError] of boundaries) assert.equal(parser().parse(source).rootNode.hasError,hasError,source);
});

test('Legacy/modern foreach and for blocks nest and own their branches', () => {
  for (const source of [
    '{foreach from=$rows item=row}{foreach $row as $cell}{$cell}{foreachelse}empty{/foreach}{/foreach}',
    '{foreach $rows as $row}{foreach from=$row item=cell}{$cell}{foreachelse}empty{/foreach}{/foreach}',
    '{for $i=0 to 1}{foreach from=$rows item=row}{/foreach}{/for}',
    '{foreach from=$rows item=row}{for $i=0 to 1}{/for}{/foreach}',
  ]) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError,false,root.toString());
    assert.equal(fullEngine(source,{mode:'compile'}).error,null,source);
  }
});

test('Legacy foreach header and closer edits match fresh parse snapshots', () => {
  const p=parser();
  let source='{$before}{foreach from=$items item=$item key=$key name=rows}{if $item}{$item}{/if}{/foreach}{if $after}{/if}{$tail}';
  let tree=p.parse(source);
  const edits=[
    {target:'header',before:'from=$items',after:'from=',error:true},
    {target:'header',before:'from=',after:'from=$items',error:false},
    {target:'header',before:'item=$item',after:'item=',error:true},
    {target:'header',before:'item=',after:'item=$item',error:false},
    {target:'header',before:'key=$key',after:'key=',error:true},
    {target:'header',before:'key=',after:'key=$key',error:false},
    {target:'closer',before:'{/foreach}',after:'',error:true},
    {target:'neighbor',before:'{if $after}',after:'{/foreach}{if $after}',error:false},
  ];
  for(const {target,before,after,error} of edits) {
    const headerStart=source.indexOf('{foreach');
    const headerEnd=source.indexOf('}',headerStart)+1;
    const startIndex=target==='header'
      ? source.indexOf(before,headerStart)
      : target==='closer'
        ? source.indexOf(before,headerEnd)
        : source.indexOf(before,source.indexOf('{/if}',headerStart)+5);
    assert.notEqual(startIndex,-1,`${target} ${before} in ${source}`);
    if(target==='header') assert.ok(startIndex+before.length<=headerEnd,`${before} stays within foreach header`);
    assert.equal(source.slice(startIndex,startIndex+before.length),before,`${target} boundary is exact`);
    const next=source.slice(0,startIndex)+after+source.slice(startIndex+before.length);
    assert.equal(next.slice(0,startIndex),source.slice(0,startIndex),'edit prefix is unchanged');
    assert.equal(next.slice(startIndex+after.length),source.slice(startIndex+before.length),'edit suffix is unchanged');
    tree.edit({startIndex,oldEndIndex:startIndex+before.length,newEndIndex:startIndex+after.length,
      startPosition:{row:0,column:startIndex},oldEndPosition:{row:0,column:startIndex+before.length},newEndPosition:{row:0,column:startIndex+after.length}});
    tree=p.parse(next,tree);
    assert.deepEqual(snapshot(tree.rootNode),snapshot(p.parse(next).rootNode),next);
    assert.equal(tree.rootNode.hasError,error,next);
    assert.equal(tree.rootNode.firstNamedChild.text,'{$before}');
    const contains=(node,type,text)=>node.type===type&&node.text===text||node.namedChildren.some(child=>contains(child,type,text));
    assert.ok(contains(tree.rootNode,'output','{$tail}'),tree.rootNode.toString());
    assert.ok(contains(tree.rootNode,'if_block','{if $after}{/if}'),tree.rootNode.toString());
    source=next;
  }
});
