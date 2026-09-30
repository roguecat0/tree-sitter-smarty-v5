# 013 — `is div by` condition predicate

Status: brief accepted (2026-10-01); queued behind higher-priority tasks 014–015.
Independent brief review accepted (2026-10-01) after
one revision round. Dependencies: 005 symbolic condition operators, 011
standalone function calls, and 012 foreach item metadata. Task creation owner:
hash-matched local corpus report `/tmp/smarty-012-after.json`.

## Motivation and corpus evidence

The current report was generated with grammar hash
`e5a3e67725a10d3dbabe62ec0987a0b5b972821a4f7fc4a7a73ebb4a39ce530f` and records
467 inputs: 142 parse cleanly and 325 contain errors. Scanning the exact source
files for the case-insensitive phrase `is div by` finds 149 occurrences in 125
templates: 123 failing templates and two already-clean templates. A report error
falls within 20 source characters of 144 occurrences. The proximity count is
triage evidence, not proof that this phrase causes every nearby error. Reports
from tasks 011 and 012 have the same 467 input hashes.

The source occurrences are highly repetitive row-striping conditions, for
example `corpus/view_wage_work/wage_work_repairs_params.tpl:26`,
`corpus/action_types/action_value_replace_part.tpl:46`, and
`corpus/view_module/check_status.tpl:67`. They include both item metadata
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

Recognize the exact `is div by` predicate in existing condition expressions.
Represent it as a `binary_expression` with `left`, `operator`, and `right`
fields, preserving its existing operands. Use a named `div_by_operator` node for
the three-word operator so the spelling and source range can be tested; its text
must be `is div by`, with normal inter-word spacing retained in the source. The
left side accepts the currently supported expression grammar, including
`loop_metadata_expression` and `function_call_expression`. The right side is a
currently supported value, including unary `+`, `-`, and `!`, or a parenthesized
supported expression, matching the pinned Smarty production
`expr ::= expr tlop value`. Word `not` remains outside this task's supported
unary subset.

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

1. Before grammar edits, add `test/corpus/divisibility-predicate.txt` with the
   hand-written metadata and function-call trees above, plus a composed
   condition tree. Add `test/divisibility-predicate.test.mjs` with failing
   assertions. Keep `if`/`else` closers and adjacent text explicit.
2. Assert the operator node's exact `is div by` spelling/range and `left`,
   `operator`, and `right` fields, including a metadata left operand and a
   function-call left operand. For `0 < 4 is div by 2`, assert the outer `<`
   and its right-hand predicate; for `(0 < 4) is div by 2`, assert the outer
   predicate and parenthesized relational left operand. Check both `<` and
   `is div by` operator spellings/ranges. Assert the `+` operator and operand
   nesting in both arithmetic cases. Check full composition with `&&`, `||`,
   and parentheses. Use
   `fixtures('divisibility-predicate.txt')` for Smarty-visible event comparison
   and state that event agreement cannot establish the predicate tree.
3. Use fixed `fullEngine()` examples with numeric literals to reproduce the
   true/false, relational, and arithmetic outcomes in the reference section.
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
   `and`, and similar), other `is ...` predicates, bitwise operators, and
   non-condition expression contexts out of this task. They remain project
   gaps; do not broaden the grammar based on the shared lexer token.
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

Independent task-creation review accepted (2026-10-01) after one revision
round. The owner accepted and
addressed all three findings: the `<` case has an independently traced
relational-outer tree with the predicate on its right, plus the parenthesized
predicate-outer contrast; arithmetic on the left, after the RHS, and inside a
parenthesized RHS has explicit trees and exact full-engine results with the PHP
translation caveat; and the RHS includes a unary expression case grounded in
the `value` production and a full-engine observation. Incomplete examples now
say only that the full engine reports no error, not that it accepts their
syntax. Re-review accepted with no remaining findings.

## Implementation evidence (fill after implementation)

Tree/reference/full-engine/edit links; commands/results; corpus report paths and
hash comparison; newly clean tree review; changed expectations; and remaining
operator forms.
