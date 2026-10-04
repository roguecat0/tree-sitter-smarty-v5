# 013 — `is div by` expression predicate

Status: complete (2026-10-01). Independent brief review accepted after two
revision rounds; implementation review accepted with no actionable findings.
The previous condition-only brief was accepted, but
implementation exploration showed that scope conflicts with the pinned Smarty
production and shared expression ladder; that disposition is superseded by
this revision. Dependencies: 005 symbolic condition operators,
011 standalone function calls, and 012 foreach item metadata. Task creation
owner: hash-matched local corpus report `/tmp/smarty-012-after.json`.

## Motivation and corpus evidence

The task-creation baseline report, captured after Task 012, was generated with grammar hash
`e5a3e67725a10d3dbabe62ec0987a0b5b972821a4f7fc4a7a73ebb4a39ce530f` and records
467 inputs: 142 parse cleanly and 325 contain errors. Scanning the exact source
files for the case-insensitive phrase `is div by` finds 149 occurrences in 125
templates: 123 failing templates and two already-clean templates. A report error
falls within 20 source characters of 144 occurrences. The proximity count is
triage evidence, not proof that this phrase causes every nearby error. Reports
from tasks 011 and 012 have the same 467 input hashes. These counts are
historical task-creation motivation, not the current corpus status: Task 014
later reported 186 clean and 281 failing inputs. Before implementation, the
implementation owner must capture a fresh corpus baseline for the actual
starting grammar and compare it with a hash-matched after report.

The source occurrences are highly repetitive row-striping conditions, for
example `corpus/application/view_wage_work/wage_work_repairs_params.tpl:26`,
`corpus/application/action_types/action_value_replace_part.tpl:46`, and
`corpus/application/view_module/check_status.tpl:67`. They include both item metadata
(`$repair@index is div by 2`) and standalone calls
(`count($value_type->get_objects()) is div by 2`).

The minimized forms
`{if $item@index is div by 2}Y{/if}` and
`{if count($rows) is div by 2}Y{/if}` are accepted by the Smarty 5.8.4 recording
adapter and full compiler; the current parser reports errors at the word
operator. Fixed full-engine checks `{if 4 is div by 2}Y{else}N{/if}` and
`{if 5 is div by 2}Y{else}N{/if}` render `Y` and `N`. This establishes observed
runtime behavior for controlled numeric values. The full engine renders `T`
for `{if 4 is div by -2}T{else}F{/if}`, confirming a unary minus value on the
right in this controlled case. Precedence and grouping observations are detailed
below; runtime results do not by themselves establish the structural tree.

## Scope and proposed tree

Recognize the exact `is div by` predicate as a general expression operator
where the existing grammar accepts full expressions, not only in `if` and
`elseif` conditions. Output expressions provide the representative
non-condition case; other uses follow only where the current grammar already
uses its shared full-expression rule. This task does not add new expression
contexts. Do not add support for any other `tlop` spelling. The pinned
production is `expr ::= expr tlop value`; it is part of Smarty's general `expr`
grammar rather than an `if`-condition-only rule.

Represent it as a `binary_expression` with `left`, `operator`, and `right`
fields, preserving the public tree shape already used by supported operators.
Use a named `div_by_operator` node for the three-word operator so its spelling
and source range can be tested; whitespace between words is accepted as by
Smarty's lexer, and the node retains the exact source slice (normalize
whitespace to compare its spelling). The left side accepts the currently supported
expression grammar, including `loop_metadata_expression` and
`function_call_expression`. The right side is a currently supported value,
including unary `+`, `-`, and `!`, or a parenthesized supported expression,
matching the pinned production's `value`. Word `not` remains outside this
task's supported unary subset.

Add this manually specified non-condition tree for a minimized Smarty output
example. It distinguishes shared-expression scope from a condition-only
interpretation:

```smarty
{$n is div by 2}
```

```text
(source_file
  (output value: (binary_expression
    left: (variable name: (identifier))
    operator: (div_by_operator)
    right: (number))))
```

The Smarty 5.8.4 full engine compiles this output expression without error and
renders `1` with `n=4` and the empty string with `n=5`. The recording adapter
reports one output event for both cases; it cannot establish the expression
tree or inspect values. Use the manual tree and full-engine observations for
those separate claims.

An existing parenthesized full-expression position inside a modifier argument
also inherits the operator. A direct unparenthesized modifier argument remains
outside this task because the current grammar's `_modifier_argument` is narrower
than `_expression`; this scope boundary does not assert that Smarty rejects the
direct form, which remains a separate grammar gap to assess:

```smarty
{$x|default:($n is div by 2)}
```

```text
(source_file
  (output value: (modifier_expression
    value: (variable name: (identifier))
    name: (identifier)
    argument: (parenthesized_expression
      (binary_expression
        left: (variable name: (identifier))
        operator: (div_by_operator)
        right: (number))))))
```

The Smarty 5.8.4 recorder accepts this fixture and reports a `default`
modifier with one argument followed by output. The full engine compiles it and
renders `1` for `n=4` and empty output for `n=5`. The recorder does not expose
the modifier argument's expression tree or value.

```smarty
{foreach $items as $item}{if $item@index is div by 2}even{/if}{/foreach}
```

```text
(source_file
  (foreach_block
    (foreach_tag source: (variable name: (identifier)) item: (variable name: (identifier)))
    (if_block
      (if_tag condition: (binary_expression
        left: (loop_metadata_expression
          item: (variable name: (identifier))
          property: (identifier))
        operator: (div_by_operator)
        right: (number)))
      (text)
      (if_close_tag))
    (foreach_close_tag)))
```

Also hand-write trees for the call-based corpus reduction, relational left
composition, arithmetic left composition, arithmetic after the predicate, and
a unary RHS. For example, `{if 4 is div by -2}even{/if}` must retain a
`unary_expression` in the predicate's `right` field (assert the `-` operator
text/range directly in Node checks). Add a composed condition using the
predicate with existing `&&`/`||` operators and explicit parentheses. The
operator node's exact text/range and operand fields must be asserted in Node
checks; manually specified trees remain the structural contract.

The following additional hand-written trees pin the source structure; their
operator spelling and ranges are checked directly in Node assertions because
anonymous operator tokens are omitted from this notation:

```smarty
{if 0 < 4 is div by 2}T{/if}
```

```text
(source_file
  (if_block
    (if_tag condition: (binary_expression
      left: (number)
      right: (binary_expression
        left: (number)
        operator: (div_by_operator)
        right: (number))))
    (text)
    (if_close_tag)))
```

For the explicit parenthesized contrast, `{if (0 < 4) is div by 2}T{/if}`,
the expected condition instead has the `div_by_operator` on the outer
`binary_expression`, with a `parenthesized_expression` containing the relational
tree as its `left` field. Assert `<` as the outer operator in the first tree
and `is div by` as the outer operator in the parenthesized tree.

```text
(source_file
  (if_block
    (if_tag condition: (binary_expression
      left: (parenthesized_expression
        (binary_expression left: (number) right: (number)))
      operator: (div_by_operator)
      right: (number)))
    (text)
    (if_close_tag)))
```

```smarty
{if 4 + 2 is div by 3}F{/if}
{if 4 is div by 2 + 1}T{/if}
{if 4 is div by -2}T{/if}
```

```text
(source_file
  (if_block
    (if_tag condition: (binary_expression
      left: (binary_expression left: (number) right: (number))
      operator: (div_by_operator)
      right: (number)))
    (text)
    (if_close_tag))
  (if_block
    (if_tag condition: (binary_expression
      left: (binary_expression
        left: (number)
        operator: (div_by_operator)
        right: (number))
      right: (number)))
    (text)
    (if_close_tag))
  (if_block
    (if_tag condition: (binary_expression
      left: (number)
      operator: (div_by_operator)
      right: (unary_expression argument: (number))))
    (text)
    (if_close_tag)))
```

For the second condition, the left `binary_expression` is the `is div by`
predicate; the outer `binary_expression` is `+ 1`. Assert those operator
fields as `is div by` and `+` respectively. For the final condition, assert the
right unary operator is `-`. These trees are structural contracts; the
full-engine outcomes in the reference section document Smarty's emitted PHP
behavior, including where PHP operator precedence changes the result.

## Smarty reference boundary

The pinned lexer `vendor/smarty/smarty/src/Lexer/TemplateLexer.plex` defines
`tlop = ~\\s+is\\s+(not\\s+)?(odd|even|div)\\s+by\\s+~` around line 326, and
maps it to `TLOGOP` around line 496. The parser production
`expr ::= expr tlop value` and `tlop` translation are around lines 655 and 1302
of `vendor/smarty/smarty/src/Parser/TemplateParser.y`. The left operand is an
`expr`; the right operand is a `value`. The `value` productions at lines 721 and
726 accept unary `+`, `-`, and Smarty's `NOT` token, so `-2` and `!2` are valid
right operands. The pinned `NOT` token also includes word `not`; that spelling
remains a separate project gap outside this task. The operator translation
builds a modulo-based PHP fragment. The recorder
confirms surrounding tag/output/call events but cannot inspect expression nodes
or values. Use hand-authored trees for structure and fixed full-engine cases
for truth-value checks; do not execute application templates.

Fixed full-engine probes render `T` for `0 < 4 is div by 2` and `F` for
`(0 < 4) is div by 2`. The pinned generated parser trace confirms the unparenthesized
tree is relational outer, with the `is div by` expression as its right operand:
on `0 < 4 is div by 2`, the parser reduces `expr ::= expr tlop value` before
`expr ::= expr lop expr`. In the parenthesized form, it reduces the relational
expression before wrapping it as `value ::= OPENP expr CLOSEP`, then reduces the
`tlop` expression outside. The local traces are `/tmp/smarty-013-trace-0.txt`
and `/tmp/smarty-013-trace-1.txt`; generated rule names are listed in
`vendor/smarty/smarty/src/Parser/TemplateParser.php` (`yyRuleName`, rules 72 and
73). The resulting structures match the full-engine branch outcomes. This
source trace, rather than an inference from output alone, determines the two
expected trees.

Arithmetic probes expose an important translation caveat. The full engine
renders `F` for `4 + 2 is div by 3`, but `T` for `(4 + 2) is div by 3`;
structurally, the unparenthesized form uses the supported addition expression
as the predicate's `left`. It renders `T` for `4 is div by 2 + 1`, but `F` for
`4 is div by (2 + 1)`; structurally, the unparenthesized `+ 1` follows the
predicate because its RHS is a `value`, while the parenthesized arithmetic is
one RHS value. Smarty emits a PHP fragment without preserving every source
grouping boundary. The pinned `tlop` action concatenates `!(`, the left
expression text, `%`, the right value text, and `)`. Thus the first arithmetic
case effectively emits `!(4 + 2 % 3)`, where PHP applies `%` before `+`; the
parenthesized case emits `!((4 + 2) % 3)`. Similarly, arithmetic after the RHS
value is outside the predicate, while parentheses keep it in that value. PHP's
operator precedence therefore affects those runtime results. These are
controlled observations about Smarty's translation and execution, not a
replacement for the source-derived Tree-sitter structure or a claim that the
two are semantically equivalent.

The full engine completes `{if 4 is div by}Y{/if}` and
`{if 4 isdivby 2}Y{/if}` without reporting an error. These observations do not
establish that Smarty's parser recognizes either intended expression form. The
event-only recorder also cannot inspect the condition tree. Malformed or
near-miss inputs therefore must not be described as Smarty syntax acceptance or
rejection based on these adapters. Test parser error recovery for a missing
right operand and edits that break/repair the phrase, while stating this
reference limitation.

## Acceptance work

1. Keep the seven existing hand-written TDD fixtures intact. Before grammar
   edits, add the output-expression and parenthesized-modifier trees above to
   `test/corpus/divisibility-predicate.txt`, retaining the existing metadata,
   function-call, precedence, unary and composition trees. Add or extend
   `test/divisibility-predicate.test.mjs` with a failing assertion for the
   output tree. Keep `if`/`else` closers and adjacent text explicit.
2. Assert the operator node's exact `is div by` spelling/range and `left`,
   `operator`, and `right` fields, including a metadata left operand and a
   function-call left operand. For `0 < 4 is div by 2`, assert the outer `<`
   and its right-hand predicate; for `(0 < 4) is div by 2`, assert the outer
   predicate and parenthesized relational left operand. Check both `<` and
   `is div by` operator spellings/ranges. Assert the `+` operator and operand
   nesting in both arithmetic cases. Check full composition with `&&`, `||`,
   and parentheses. Assert that the output expression's `value` is the
   `binary_expression` and that its operator's normalized spelling and exact
   raw source range match the condition cases. Assert the modifier's direct
   argument remains a `parenthesized_expression` whose inner expression has
   the predicate tree. Preserve the exact text and
   source ranges of neighboring `+`, `-`, and `==` operator nodes and foreach
   item bindings in regression checks; adding the new expression production
   must not shift existing token boundaries or field ranges. Use
   `fixtures('divisibility-predicate.txt')` for Smarty-visible event comparison
   and state that event agreement cannot establish the predicate tree.
3. Use fixed `fullEngine()` examples with numeric literals to reproduce the
   true/false, relational, arithmetic, output-expression, and parenthesized
   modifier-argument outcomes in the reference section. For both
   `{$n is div by 2}` and `{$x|default:($n is div by 2)}`, assert successful
   compilation and results for `n=4` and `n=5` as recorded above. Use
   `fixtures('divisibility-predicate.txt')`/`reference()` for both non-condition
   forms and state that recorder agreement cannot establish their inner trees.
   Add parentheses to make the comparison cases explicit. Assert structural
   precedence from the hand-authored trees and pinned parser production, not
   from emitted PHP's runtime behavior or the recording adapter.
4. Add an incomplete/edit recovery case that removes the right operand or
   breaks one word in the condition, preserves surrounding text and the closing
   `{/if}`, then repairs it. Compare full incremental snapshots with fresh
   parses. Do not assert that Smarty rejects a case unless the pinned parser or
   a reliable full-engine observation establishes that.
5. Add a focused mutation only if the explicit field/text checks can miss losing
   the operator or an operand. Preserve an existing mutation's fault if source
   anchors need an update.
6. Keep `is not div by`, `is even/odd [by]`, symbolic and word aliases (`eq`,
   `and`, and similar), other `is ...` predicates, and bitwise operators out of
   this task. They remain project gaps; do not broaden the grammar based on the
   shared lexer token. The exact `is div by` operator applies only in existing
   full-expression positions. Do not expand narrower grammar positions such as
   direct modifier arguments or bare array keys merely to make them accept this
   form; existing parenthesized full expressions in those positions inherit
   the operator through the shared expression rule.
7. Run `npm test` and hash-matched before/after corpus reports outside `build/`.
   Inspect all newly clean file trees and regressions. Preserve all corpus
   inputs; report actual counts and remaining errors, with no clean-file quota.
   After acceptance, update the contract, feature row, task status, and evidence.

## Scope decisions for review

- Exact-source corpus evidence makes `is div by` a higher-value next step than
  broad, merely lexical bitwise/switch/literal hints. The word predicate is
  intentionally limited to this exact variant; the pinned token family does
  not imply that the variants listed above are in scope.
- The proposed named `div_by_operator` node keeps a multiword operator visible
  without changing the common `binary_expression` operand fields. Review may
  propose a better shape, but the exact spelling and range must remain
  inspectable.
- The full engine's lack of a reported error for incomplete/near-miss examples
  is an explicit reference limitation, not evidence to auto-accept arbitrary
  text. Keep parser recovery useful for editors and avoid unsupported Smarty
  acceptance or rejection claims.

## Brief-review disposition

The previous condition-only brief was accepted on 2026-10-01, then superseded
after implementation exploration showed that a parallel condition grammar
conflicted with shared expression rules and shifted operator/foreach source
ranges. The revised brief makes this one exact operator in the shared
expression ladder, consistent with the pinned `expr ::= expr tlop value`
production. It adds a manually specified output-expression tree and verified
Smarty compiler/reference observation as the non-condition proof. Review also
identified that existing parenthesized modifier arguments inherit the shared
expression rule; that tree and its reference observation are explicit, while
direct unparenthesized modifier arguments remain excluded. The seven original
TDD fixtures remain intact. Independent task creation review accepted the
revision after two rounds (2026-10-01), with no remaining findings.

## Later syntax boundary update (Task 043)

Task 013's implementation initially asserted that `is odd by` and `is even by`
were unsupported. That was accurate for Task 013's narrow scope, but became
obsolete when Task 043 added the four binary `is [not] odd/even by` forms. The
old negative examples were removed from the Task 013 boundary check only after
the pinned Smarty 5.8.4 recorder and full engine accepted
`{if 5 is odd by 2}T{else}F{/if}` and
`{if 5 is even by 2}T{else}F{/if}`, and Task 043 added explicit tree, compiler,
and precedence checks. Task 013 continues to reject `is div by2` and
`is not div by 2`; `is not div by`, unary `is [not] odd/even`, `is [not] in`,
`matches`, and other predicates remain separate gaps.

## Implementation evidence

`grammar.js` adds one left-associative shared arithmetic production whose named
`div_by_operator` token spans the exact lower-case `is ... div ... by` source
spelling, including its original inter-word whitespace. As in Smarty's pinned
lexer, whitespace is required before the right value; that trailing separator
is outside the named operator range. Its left operand uses the current
arithmetic grammar and its right operand uses the current unary/value grammar.
The public shape is `binary_expression` with `left`, `operator`, and `right`
fields. This follows the pinned `expr ::= expr tlop value` production in all
existing full-expression positions. It does not add new direct
`_modifier_argument` or other narrower contexts; an existing parenthesized
modifier argument inherits the predicate through its inner full expression.
Generated sources are current.

Hand-authored trees in [divisibility-predicate.txt](../../test/corpus/divisibility-predicate.txt)
cover foreach metadata and call operands, relational and arithmetic grouping,
unary RHS, boolean composition, an output expression, and a parenthesized
modifier argument. [Node checks](../../test/divisibility-predicate.test.mjs)
assert operator text/ranges and fields, output/modifier tree shape, reference
events, full-engine outcomes, missing-operand recovery, and incremental edit
equivalence. Event comparisons verify only Smarty-visible names/counts; manual
trees establish expression structure. Full-engine cases verify controlled
rendering but the PHP translation's precedence can differ from the source tree.
Other `tlop` forms (`is not div by`, `is even/odd by`) remain unsupported; the
direct modifier-argument and bare array-key forms remain outside this task. No
existing expectation changed.

Test-first proof: before the grammar change, `npm test` reported 133 successful
and 9 failing corpus parses; all nine new manually specified trees failed, while
the existing 133 passed. Final `npm test` passes 142 corpus trees, 211 Node
checks, and all 11 mutation checks. Hash-matched reports
`/tmp/smarty-013-before-v2.json` and `/tmp/smarty-013-after-v2.json` preserve the
same 467 source hashes and show 186 clean / 281 failing before and 240 clean /
227 failing after, with no regressions. The parser hashes are
`e6e522b8203e05dfa4e601284cc91e4b4d4e848f3ef67a947e505c5ae4c66963` before and
`829aa943ed57457b277c998f2e6478d4029e147282c925442e7df5dae08574b6` after.
All 54 newly clean trees were structurally inspected: together they contain 63
`div_by_operator` nodes under `binary_expression` nodes with explicit left/right fields;
the left nodes are loop metadata or method calls, and the right nodes are
numbers. The full list and per-file node counts were recorded in the owner's
handoff. The corpus still has 227 parse failures, which remain unresolved
completeness gaps.

## Implementation-review disposition

Independent implementation review accepted (2026-10-01) with no actionable
findings. The reviewer reproduced `npm test` and the hash-matched corpus report,
verified the generated parser, checked all 54 newly clean trees for structured
operator nodes, confirmed the manual tree and range assertions against the
pinned Smarty grammar and precedence traces, and verified recovery/edit and
reference-limit evidence. The orchestrator marked this task complete after
review acceptance.
