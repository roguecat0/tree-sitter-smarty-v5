import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtures, fullEngine, observations, parser, reference, snapshot } from './helpers.mjs';
for (const {name,source} of fixtures('index-access.txt')) test(`Index reference: ${name}`, () => {
  const root=parser().parse(source).rootNode;
  assert.equal(root.hasError,false,root.toString());
  const expected=reference(source); assert.equal(expected.error,null,source);
  assert.deepEqual(observations(root),expected.events);
});
test('Index fields, ranges and anonymous punctuation', () => {
  const source="{$rows[1 + 2].name}";
  const outer=parser().parse(source).rootNode.firstNamedChild.childForFieldName('value');
  assert.equal(outer.type,'index_expression');
  const inner=outer.childForFieldName('object');
  assert.deepEqual([inner.type,inner.text,inner.startIndex,inner.endIndex],['index_expression','$rows[1 + 2]',1,13]);
  const key=outer.childForFieldName('index');
  assert.deepEqual([key.type,key.text,key.startIndex,key.endIndex],['identifier','name',14,18]);
  assert.equal(inner.childForFieldName('object').text,'$rows');
  assert.equal(inner.childForFieldName('index').type,'binary_expression');
  assert.equal(inner.childForFieldName('index').childForFieldName('operator').text,'+');
  assert.deepEqual(inner.children.filter(n=>!n.isNamed).map(n=>n.text),['[',']']);
  assert.deepEqual(outer.children.filter(n=>!n.isNamed).map(n=>n.text),['.']);
});
test('Index whitespace and contextual keys', () => {
  for (const source of ['{$a [ 0 ]}', '{$a[ $key + 1 ]}', '{$a.if}', '{$a.foreach}', '{$a.01.2}']) {
    assert.equal(reference(source).error,null,source);
    assert.equal(parser().parse(source).rootNode.hasError,false,source);
  }
});
test('Index malformed syntax and receiver boundaries', () => {
  for (const source of ['{$a[}', '{$a[1}', '{$a.}', '{$a .name}', '{$a. name}', '{$a. 0}', '{$a->f()[0]}', '{$a[0]->f()[0]}', '{#a#[0]->name}', '{#a#[0]->f()}']) {
    assert.ok(reference(source).error,source);
    assert.equal(parser().parse(source).rootNode.hasError,true,source);
  }
  assert.equal(reference('{$a[]}').error,null);
  assert.equal(parser().parse('{$a[]}').rootNode.hasError,true, 'Empty append indices remain outside this task.');
  // Smarty defines a bare ID in brackets as a section-name index; the former
  // rejection expectation was incorrect and is covered structurally by Task 030.
  const sectionName = parser().parse('{$a[key]}').rootNode;
  assert.equal(reference('{$a[key]}').error,null);
  assert.equal(fullEngine('{$a[key]}',{mode:'compile'}).error,null);
  assert.equal(sectionName.hasError,false,sectionName.toString());
  const sectionIndex = sectionName.descendantsOfType('section_index')[0];
  const sectionNameField = sectionIndex.childForFieldName('name');
  assert.equal(sectionNameField.text,'key');
  assert.deepEqual([sectionIndex.startIndex,sectionIndex.endIndex],[3,8]);
  assert.deepEqual([sectionNameField.startIndex,sectionNameField.endIndex],[4,7]);
  for (const source of ['{$a.$key}', '{$a.{$key}}', '{($a)[0]}', "{'x'[0]}", '{$a[0]=1}'])
    assert.equal(parser().parse(source).rootNode.hasError,true,source);
});
test('Index incremental broken bracket and dot-to-expression transition', () => {
  for (const [initial,before,after] of [['{$before}{$a->f($rows[0])}{$after}',']',''],['{$before}{$rows.name}{$after}','.name','[$key + 1]']]) {
    const p=parser(); let source=initial, tree=p.parse(source); const startIndex=source.indexOf(before);
    for (const [removed,added] of [[before,after],[after,before]]) {
      const next=source.slice(0,startIndex)+added+source.slice(startIndex+removed.length);
      tree.edit({startIndex,oldEndIndex:startIndex+removed.length,newEndIndex:startIndex+added.length,startPosition:{row:0,column:startIndex},oldEndPosition:{row:0,column:startIndex+removed.length},newEndPosition:{row:0,column:startIndex+added.length}});
      tree=p.parse(next,tree);
      assert.equal(tree.rootNode.hasError,added==='');
      assert.equal(tree.rootNode.firstNamedChild.text,'{$before}');
      assert.equal(tree.rootNode.lastNamedChild.text,'{$after}');
      assert.deepEqual(snapshot(tree.rootNode),snapshot(parser().parse(next).rootNode)); source=next;
    }
  }
});
