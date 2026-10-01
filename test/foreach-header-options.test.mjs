import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixtures, observations, parser, reference, fullEngine, snapshot} from './helpers.mjs';

const examples = fixtures('foreach-header-options.txt');
for (const {name, source} of examples) test(`Foreach header option tree/reference: ${name}`, () => {
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  assert.equal(reference(source).error, null);
  assert.deepEqual(observations(root), reference(source).events);
});

test('Modern foreach retains trailing attributes and options after binding fields', () => {
  const source = '{foreach $items as $key => $item properties="first,last" nocache=true item=$otherItem from=$other key="extra" name=rows}{$item}{/foreach}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError, false, root.toString());
  const tag = root.firstNamedChild.firstNamedChild;
  assert.equal(tag.type, 'foreach_tag');
  assert.deepEqual(['source','key','item'].map(name => tag.childForFieldName(name)?.text), ['$items','$key','$item']);
  const entries = tag.namedChildren.slice(3);
  assert.deepEqual(entries.map(node => node.type), ['attribute','attribute','attribute','attribute','attribute','attribute']);
  assert.deepEqual(entries.map(node => [node.childForFieldName('name').text,node.childForFieldName('value').text]), [
    ['properties','"first,last"'], ['nocache','true'], ['item','$otherItem'], ['from','$other'], ['key','"extra"'], ['name','rows'],
  ]);
  const expectedTexts = ['properties="first,last"','nocache=true','item=$otherItem','from=$other','key="extra"','name=rows'];
  let cursor = 0;
  for (const [node, text] of entries.map((node,index) => [node,expectedTexts[index]])) {
    const start = source.indexOf(text,cursor);
    assert.deepEqual([node.startIndex,node.endIndex],[start,start+text.length]);
    cursor = start+text.length;
    assert.equal(source.slice(node.startIndex,node.endIndex), text);
    const name = node.childForFieldName('name');
    const value = node.childForFieldName('value');
    const nameStart = source.indexOf(name.text,node.startIndex);
    const valueStart = source.indexOf(value.text,name.endIndex);
    assert.deepEqual([name.startIndex,name.endIndex],[nameStart,nameStart+name.text.length]);
    assert.deepEqual([value.startIndex,value.endIndex],[valueStart,valueStart+value.text.length]);
    assert.equal(source.slice(name.startIndex,name.endIndex), name.text);
    assert.equal(source.slice(value.startIndex,value.endIndex), value.text);
  }
  assert.deepEqual(observations(root).find(event => event.kind === 'tag' && event.name === 'foreach').arguments.map(arg => arg.name),
    ['properties','nocache','item','from','key','name','from','item','key']);
});

test('All compiler-declared modern options are structurally retained and compile', () => {
  const forms = [
    '{foreach $items as $item name="rows"}{/foreach}',
    '{foreach $items as $item key="alias"}{/foreach}',
    '{foreach $items as $item properties="first,last"}{/foreach}',
    '{foreach $items as $item from=$other item=$otherItem}{/foreach}',
    '{foreach $items as $item item=$otherItem from=$other}{/foreach}',
    '{foreach $items as $item nocache}{/foreach}',
    '{foreach $items as $item nocache="false"}{/foreach}',
  ];
  for (const source of forms) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError,false,source+'\n'+root.toString());
    assert.equal(reference(source).error,null,source);
    assert.equal(fullEngine(source,{mode:'compile'}).error,null,source);
  }
  const nested = '{foreach from=$items item=items nocache=false}{foreach $items as $item name="inner" nocache=0}{$item}{/foreach}{/foreach}';
  const nestedRoot = parser().parse(nested).rootNode;
  assert.equal(nestedRoot.hasError,false,nestedRoot.toString());
  assert.equal(fullEngine(nested,{mode:'compile'}).error,null,nested);
});

test('Valued nocache keeps exact value types in modern and legacy headers', () => {
  for (const syntax of ['modern','legacy']) for (const value of ['true','false','1','0','"true"',"'false'",'"1"',"'0'"]) {
    const source = syntax === 'modern'
      ? `{foreach $items as $item nocache=${value}}{/foreach}`
      : `{foreach from=$items item=$item nocache=${value}}{/foreach}`;
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError,false,source+'\n'+root.toString());
    const tag = root.firstNamedChild.firstNamedChild;
    const entries = tag.childForFieldName('source')
      ? tag.namedChildren.filter(node => node.type === 'attribute' || node.type === 'foreach_option')
      : tag.firstNamedChild.namedChildren;
    const nocache = entries.find(node => node.type === 'attribute' && node.childForFieldName('name')?.text === 'nocache');
    assert.ok(nocache,source+'\n'+root.toString());
    const valueNode = nocache.childForFieldName('value');
    const type = ['true','false'].includes(value) ? 'boolean'
      : ['1','0'].includes(value) ? 'number' : 'string';
    assert.equal(valueNode.type,type,source);
    assert.equal(source.slice(valueNode.startIndex,valueNode.endIndex),value,source);
    const compilerSource = syntax === 'legacy' ? source.replace('item=$item','item=item') : source;
    assert.equal(fullEngine(compilerSource,{mode:'compile'}).error,null,compilerSource);
  }
});

test('Nocache attributes accept spaces around equals with exact fields and ranges', () => {
  for (const [syntax,source,value] of [
    ['legacy','{foreach from=$items item=item nocache = "false"}{/foreach}','"false"'],
    ['legacy','{foreach from=$items item=item nocache= true}{/foreach}','true'],
    ['modern','{foreach $items as $item nocache = "false"}{/foreach}','"false"'],
    ['modern','{foreach $items as $item nocache= true}{/foreach}','true'],
  ]) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError,false,source+'\n'+root.toString());
    const tag = root.firstNamedChild.firstNamedChild;
    const attr = tag.childForFieldName('source') ? tag.namedChildren.at(-1) : tag.firstNamedChild.namedChildren.at(-1);
    assert.equal(attr.type,'attribute');
    assert.equal(attr.childForFieldName('name').text,'nocache');
    assert.equal(attr.childForFieldName('value').text,value);
    const valueNode = attr.childForFieldName('value');
    assert.deepEqual([valueNode.startIndex,valueNode.endIndex],
      [source.indexOf(value,source.indexOf('nocache')),source.indexOf(value,source.indexOf('nocache'))+value.length]);
    assert.equal(reference(source).error,null,source);
    assert.deepEqual(reference(source).events[0].arguments.map(arg=>arg.name),
      syntax==='legacy'?['from','item','nocache']:['nocache','from','item']);
    assert.equal(fullEngine(source,{mode:'compile'}).error,null,source);
  }
  const broken = '{foreach from=$items item=item nocache =}{/foreach}{$after}';
  const recovery = parser().parse(broken).rootNode;
  assert.equal(recovery.hasError,true,recovery.toString());
  assert.ok(recovery.toString().includes('(foreach_close_tag)'),recovery.toString());
  assert.ok(recovery.namedChildren.some(node=>node.type==='output'&&node.text==='{$after}'),recovery.toString());
});

test('Parser-valid nocache values remain visible when full compiler validation rejects them', () => {
  for (const [value, expectedText] of [['yes','yes'],['TRUE','TRUE'],['$flag','$flag']]) {
    for (const syntax of ['modern','legacy']) {
      const source = syntax === 'modern'
        ? `{foreach $items as $item nocache=${value}}{/foreach}`
        : `{foreach from=$items item=$item nocache=${value}}{/foreach}`;
      const root = parser().parse(source).rootNode;
      assert.equal(root.hasError,false,source+'\n'+root.toString());
      const tag = root.firstNamedChild.firstNamedChild;
      const entries = tag.childForFieldName('source') ? tag.namedChildren : tag.firstNamedChild.namedChildren;
      const attr = entries.find(node => node.type === 'attribute' && node.childForFieldName('name')?.text === 'nocache');
      assert.equal(attr?.childForFieldName('value')?.text,expectedText,source+'\n'+root.toString());
      assert.equal(reference(source).error,null,source);
      assert.equal(fullEngine(source,{mode:'compile'}).error?.type,'Smarty\\CompilerException',source);
    }
  }
  for (const source of ['{foreach $items as $item nocache=}{/foreach}{$after}',
                        '{foreach from=$items item=$item nocache=}{/foreach}{$after}']) {
    const root = parser().parse(source).rootNode;
    assert.equal(root.hasError,true,root.toString());
    assert.ok(root.toString().includes('(output value: (variable name: (identifier)))'),root.toString());
    assert.ok(root.toString().includes('(foreach_close_tag)'),root.toString());
  }
  const unknown = '{foreach $items as $item application_flag=true}{/foreach}';
  const unknownRoot = parser().parse(unknown).rootNode;
  assert.equal(unknownRoot.hasError,false,unknownRoot.toString());
  const unknownAttr = unknownRoot.firstNamedChild.firstNamedChild.namedChildren.at(-1);
  assert.equal(unknownAttr.type,'attribute');
  assert.deepEqual([unknownAttr.childForFieldName('name').text,unknownAttr.childForFieldName('value').text],['application_flag','true']);
  assert.equal(fullEngine(unknown,{mode:'compile'}).error?.type,'Smarty\\CompilerException');
});

test('Modern trailing events precede normalized foreach binding events', () => {
  const source = '{foreach $items as $key => $item name=rows key=alias from=$other item=other nocache}{/foreach}';
  const root = parser().parse(source).rootNode;
  assert.equal(root.hasError,false,root.toString());
  assert.deepEqual(observations(root),reference(source).events);
  assert.deepEqual(reference(source).events.filter(event => event.kind === 'tag' && event.name === 'foreach')[0].arguments.map(arg => arg.name),
    ['name','key','from','item',null,'from','item','key']);
});

test('Foreach header option insert, deletion, invalidation and repair match fresh parses', () => {
  const p=parser();
  let source='{$before}{foreach $items as $item nocache=true}{$item}{foreachelse}empty{/foreach}{if $after}{/if}{$tail}';
  let tree=p.parse(source);
  const edits=[
    {before:'nocache=true',after:'nocache=',error:true},
    {before:'nocache=',after:'nocache="false"',error:false},
    {before:'{foreach $items as $item ',after:'{foreach $items as $item name="rows" ',error:false},
    {before:'name="rows" ',after:'',error:false},
  ];
  for(const {before,after,error} of edits) {
    const startIndex=source.indexOf(before);
    assert.notEqual(startIndex,-1,before+' in '+source);
    const next=source.slice(0,startIndex)+after+source.slice(startIndex+before.length);
    tree.edit({startIndex,oldEndIndex:startIndex+before.length,newEndIndex:startIndex+after.length,
      startPosition:{row:0,column:startIndex},oldEndPosition:{row:0,column:startIndex+before.length},newEndPosition:{row:0,column:startIndex+after.length}});
    tree=p.parse(next,tree);
    assert.deepEqual(snapshot(tree.rootNode),snapshot(p.parse(next).rootNode),next);
    assert.equal(tree.rootNode.hasError,error,next);
    assert.ok(tree.rootNode.toString().includes('(foreach_close_tag)'),tree.rootNode.toString());
    assert.ok(tree.rootNode.toString().includes('(if_block'),tree.rootNode.toString());
    assert.ok(tree.rootNode.namedChildren.some(node=>node.type==='output'&&node.text==='{$tail}'),tree.rootNode.toString());
    source=next;
  }
});
