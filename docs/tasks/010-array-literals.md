# 010 — Array literals

Status: complete (2026-09-30). Dependencies: 004–009 for expression
composition. Task creation owner: corpus audit `grammarSha256`
`a6a8d1263dd532a54c8e8b15da42ad46bc73df8ceed82fbe16049518a308afe7`, fixed
corpus manifest `913469d341dc4d60ec6d4ab2b2ba78ce5abee3313cd56eb48642e76eafe73c08`.

## Motivation and evidence

The hash-matched report measures 467 Smarty-accepted files: 98 clean and 369
failing. `get_url([` occurs in error snippets from 53 distinct failing files
(770 error entries, including overlapping errors). For example,
`corpus/view_wage_work/wage_work_repairs_params.tpl:30` calls
`$app->urls['go_page']->get_url(['view'=>'view_wage_work.edit_repair_param',
'param_id'=>$wage_work_repair_param->get_id()])`. The reduced
`{$user->find(["id"=>1, "active"=>true])}` currently produces an `ERROR` in
the grammar, but the Smarty 5.8.4 recording compiler accepts it and reports one
output event.

The pinned `vendor/smarty/smarty/src/Parser/TemplateParser.y` has explicit
`arraydef`, `arrayelements`, and `arrayelement` productions (around lines
1333–1364): short `[...]` and `array(...)` forms; empty, comma-separated and
trailing-comma lists; keyed entries with a `value` key or bare `ID` key; and
expression values. In the keyed production the left side is `value`, not a
general `expr`; compound keys need parentheses. The lexer recognizes `array (`
as an array token. This is evidence for native array syntax, not permission to
accept arbitrary bare words as expression values.

## Scope

Support both Smarty array literal forms, `[...]` and `array(...)`, as primary
expressions, including empty arrays, list entries, keyed entries, and a trailing
comma. Allow Smarty `value` forms as keys and existing supported full
expressions as values. Parenthesized full expressions are valid keys; bare
identifier keys are also valid as a special key form and do not become
standalone identifier expressions. Preserve source spelling and the distinction
between quoted and bare keys. Nested array literals are in scope. Array literals must compose
where the current expression grammar accepts primaries: output, method-call
arguments, generic-tag positional/named values, conditions, modifiers,
indices where legal, and nested arrays.

Do not add standalone function-call expressions, arbitrary bare-word values,
namespaced/static method calls, assignment, spread/unpack, or PHP runtime
semantics. Do not conflate array literals with bracket index suffixes: a literal
is a value, while `$rows[0]` remains an `index_expression`. Project-level
support for standalone calls remains a separate visible gap.

## Proposed tree contract

Add named `array_literal` and `array_element` nodes. Preserve delimiters as
anonymous punctuation. Every element has a `value` field. A keyed element also
has a `key` field. A bare identifier key is represented by an `identifier`
node in `key`; a quoted or expression key retains its normal expression node.
Do not encode keyed arrays as generic attributes or hide elements in text.

```smarty
{$user->find(["id"=>1, active=>true])}
```

```text
(source_file
  (output value: (method_call_expression
    object: (variable name: (identifier))
    method: (identifier)
    argument: (array_literal
      (array_element key: (string) value: (number))
      (array_element key: (identifier) value: (boolean))))))
```

Parentheses make a compound key a `value` according to Smarty's production:

```smarty
{$user->find([($x+1)=>"v"])}
```

```text
(source_file
  (output value: (method_call_expression
    object: (variable name: (identifier))
    method: (identifier)
    argument: (array_literal
      (array_element
        key: (parenthesized_expression
          (binary_expression left: (variable name: (identifier)) right: (number)))
        value: (string))))))
```

Do not accept an unparenthesized compound key such as `[$x+1=>"v"]`; the
Smarty recorder rejects it at `=>`. The right side remains a full expression,
so `$x+1` is valid as a value.

The corpus call should retain the object/index/call chain and distinguish both
key-value pairs:

```smarty
{$app->urls["go_page"]->get_url(["view"=>"edit", "param_id"=>$id])|escape}
```

```text
(source_file
  (output value: (modifier_expression
    value: (method_call_expression
      object: (index_expression
        object: (member_expression object: (variable name: (identifier))
          member: (identifier)) index: (string))
      method: (identifier)
      argument: (array_literal
        (array_element key: (string) value: (string))
        (array_element key: (string) value: (variable name: (identifier)))))
    name: (identifier))))
```

For list entries, omit `key` and retain `value`. For `array(1, 2)`, use the
same `array_literal` and `array_element` shape as ` [1, 2]`.

The Node checks independently assert anonymous delimiters and source ranges for
both forms, including the `array` keyword and parentheses in `array(...)`;
element order and element ranges are checked there as well.

The reviewed implementation tree uses the established method-call shape from
`index-access.txt`: `get_url` appears once as `method_call_expression.method`,
whose `object` is the indexed `$app->urls` expression. The initial proposal
above incorrectly wrapped that same `get_url` token in an additional
`member_expression`. The minimized source is still accepted by Smarty; the
tree correction follows the existing index-to-method contract and avoids
duplicating a source token.

## Reference boundary (Smarty 5.8.4)

The recording compiler accepts
`{$user->find(["id"=>1, "active"=>true])}`, `{widget value=[id=>$id]}`,
`{if ["x"=>1]}`, `{$user->find([])}`, `{$user->find([1,2,])}` and
`{$user->find(array(1,2))}` and `{$user->find([($x+1)=>"v"])}`. It rejects
`{$user->find([$x+1=>"v"])}` at `=>`, and rejects
`{$user->find(["x"=>])}` with an unexpected closing bracket. It also returns no
compiler error for unusual
leading/repeated comma forms (`[,1]`, `[1,,2]`); the recorder bypasses normal
compilation details and its output-event projection cannot establish their
runtime meaning. Do not use those forms as positive or negative tree contracts
without further full-engine observation. The recorder's output/tag events do
not expose array entries or argument values, so expected trees are the
structural authority.

## Acceptance work

1. Before grammar edits, hand-write `test/corpus/array-literals.txt` trees and
   add a focused `test/array-literals.test.mjs` failing check. Cover short and
   `array(...)` forms; empty/list/keyed/trailing-comma entries; quoted and bare
   identifier keys; nested values; a parenthesized compound key; and exact
   key/value fields. Assert that `[$x+1=>"v"]` stays a syntax error while
   `[($x+1)=>"v"]` has a parenthesized-expression key.
2. Include a minimized corpus call, a call with a nested array value, an array
   in an unknown tag's named and positional expressions, a modifier/comparison
   composition, and one composition inside an if/foreach body. Unknown tags
   remain independent, and their array values keep full expression detail.
3. Opt valid fixture sources into a reference comparison with
   `fixtures('array-literals.txt')`. Compare only event kinds, tag names,
   argument names/counts that the adapter exposes. Assert exact array node
   shape, element ordering, fields, delimiters, and source ranges independently.
4. Keep missing key values and missing closing delimiters in separate recovery
   checks. Require errors for confirmed malformed forms, then assert a valid
   neighboring output/tag remains structured. Do not treat the recorder's
   unusual comma recovery as evidence of a valid array tree.
5. Test a full-tree incremental edit that changes a keyed entry to a list entry
   and back, plus deletion/restoration of the array's closing delimiter inside
   a call; compare edited and fresh snapshots and preserve neighboring syntax.
6. Add a mutation only if a likely array structure defect could escape the
   positive/negative checks (for example, dropping `key` or flattening entries);
   state why it catches a distinct failure mode.
7. Run `npm test` and before/after hash-matched corpus reports saved outside
   `build/`. Inspect newly clean files and verify keyed/list elements remain
   explicit. Update the contract, this brief and inventory with exact results;
   do not claim runtime array values or broader function-call support.

## Completion evidence

Implemented in [grammar.js](../../grammar.js), with hand-written trees in
[array-literals.txt](../../test/corpus/array-literals.txt) and focused checks in
[array-literals.test.mjs](../../test/array-literals.test.mjs). The tree tests
cover short and `array(...)` forms, empty/list/keyed/nested values, trailing
commas, quoted and bare keys, parenthesized compound keys, generic tag named
and positional expressions, modifier arguments, comparisons, and `if` and
`foreach` bodies, plus an array expression used as a bracket-index value.
Separate recovery checks reject missing values and closing
brackets while preserving a neighboring custom tag. Full-tree edits change a
keyed element to a list element and back, and remove/restore the literal's
closing bracket; edited snapshots match fresh parses. No mutation was added:
the hand-authored trees and Node assertions already fail if entry nodes or
key/value fields are lost.

`npm test` passes: 108/108 corpus trees, 152/152 Node checks, and the mutation
suite. The required red run before the grammar change failed the five initial
array tree examples while the existing 100 corpus trees passed. (The final
fixture set has seven cases.) The reference adapter verifies only output/tag
event projections; array entries remain checked by explicit trees. The
unparenthesized key `[$x+1=>"v"]` is rejected by both Smarty 5.8.4 and the
grammar; `[$x+1]` remains valid as an expression value. Leading/repeated comma
forms remain excluded because the recorder does not establish their compile or
runtime behavior.

Hash-matched reports: baseline `/tmp/smarty-corpus-audit.json` has grammar hash
`a6a8d1263dd532a54c8e8b15da42ad46bc73df8ceed82fbe16049518a308afe7`, 467 files,
98 clean and 369 failing. After report `/tmp/smarty-array-after.json` has grammar
hash `0304cbe4b50d712ce545362f5679fcd1ebb3e78648dadb667589a5c8a82e5f64`, the
same 467 source hashes, 99 clean and 368 failing. There were no regressions;
`view_sap/article_details.tpl` newly parses without errors and its sole literal
was inspected: two explicit `array_element` nodes contain the expected method
calls. The remaining 368 errors are unresolved project gaps; the local corpus
is not clean and this task does not complete the overall parser goal.

## Brief review

The task creation reviewer initially requested that keyed expressions be
narrowed to Smarty's `value` forms and bare identifier keys. The brief was
revised to require parentheses around compound expression keys. The reviewer
independently confirmed that `($x+1)` is accepted and `$x+1` is rejected before
`=>` by Smarty 5.8.4, and accepted the revised tree contract. No other actionable
findings remained.

## Implementation review

The completion reviewer accepted the implementation after one test-only
revision. The reviewer requested independent anonymous-token and source-range
assertions for `array(...)`, since the initial focused test checked those only
for `[...]`. The test now checks the `array` keyword, parentheses, commas,
literal range, element order, and element ranges for both forms. The reviewer
reran `npm test`, verified the corpus evidence and newly clean tree, and found
no remaining issues.
