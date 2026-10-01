# 005 — Symbolic condition operators

Status: complete (2026-09-23). Dependencies: 004 for call composition tests.
Implement before 006. This task is one bounded operator-precedence expansion.

## Scope and motivation

Add symbolic comparisons `== != === !== < <= > >=`, boolean `&& ||`, and prefix
`! + -` to the existing expression subset. Allow them wherever expressions are
supported, not only inside `if`; retain the narrower modifier-argument boundary
unless independently verified (parentheses can carry a full expression).

`corpus/application/action_types/action_value_afmelden.tpl:2-3` supplies negated calls and
conjunctions. `corpus/application/menu_button.tpl:5` supplies comparisons against an empty
string, `&&`, and a numeric comparison; minimize to
`{if $button->get_icon() != '' && $level > 0}Y{/if}`. Static constants and
bitwise operators elsewhere in those files are not part of this task.

Exclude word aliases (`eq`, `and`, `not`, etc.), `is ...` tests, `xor`, bitwise
operators, assignment, increment/decrement, ternary/coalescing, casts, constants,
boolean/null literals and new numeric formats. Do not add bare identifiers as
expression fallbacks to make corpus conditions parse.

## Proposed tree contract

Reuse `binary_expression` with `left`, anonymous-token `operator`, and `right`
fields. Add `unary_expression` with anonymous-token `operator` and `argument`.
Keep unsigned numbers unsigned: `-2` is a unary expression containing a number.
Existing expression trees must retain their documented meaning.

Proposed binding order, tightest first:

1. Property/method chains and parentheses.
2. Modifier application, preserving the existing contract.
3. Prefix `! + -` (nested prefixes associate right).
4. Multiplicative arithmetic, then additive arithmetic.
5. Relational `< <= > >=`.
6. Equality `== != === !==`.
7. `&&`, then `||` (each left-associative).

Explicitly verify prefix/modifier interaction before fixing numeric precedence
levels. If real Smarty contradicts the proposal, document a minimal observation
and correct the contract before implementation, including any affected old tree.
Unparenthesized repeated relational or repeated equality operators are excluded;
parentheses can make their grouping explicit. Mixed relational/equality forms
must respect the separate levels.

```text
{if !$ready && $count >= 2}Y{/if}
(source_file
  (if_block
    (if_tag condition: (binary_expression
      left: (unary_expression argument: (variable name: (identifier)))
      right: (binary_expression
        left: (variable name: (identifier)) right: (number))))
    (text)
    (if_close_tag)))
```

Named-node corpus notation does not show anonymous operator tokens; Node checks
must assert each `operator` field's spelling and range.

## Reference observations and required precedence evidence

On 2026-09-22, Smarty 5.8.4's recorder accepts symbolic mixed conditions and
`{if -$a + +$b * 2 > 0}Y{/if}`. Inspect `expr`, `value ::= NOT value`,
`value ::= UNIMATH value`, `lop`, and lexer operator definitions. The compiler
concatenates many PHP expression fragments: recorder acceptance is **not** proof
of precedence, associativity, evaluation, or executable generated PHP.

A separate full Smarty `fetch` observation on fixed literal-only templates
`{if EXPRESSION}T{else}F{/if}` returned `T` for each of:

- `1 || 0 && 0`
- `1 == 2 < 3`
- `!2 + 1 == 1`
- `-2 * 3 == -6`

In contrast, `2 < 3 < 4` and `1 == 1 == 1` pass the recorder but full rendering
raises PHP `ParseError`. Do not cite the recorder as evidence that these chains
are valid executable Smarty. Require parser errors for these excluded chains;
retain positive tests for explicitly parenthesized comparisons.

During implementation add a small separate full-engine test adapter/helper for
fixed, controlled expressions and assigned primitive values, using a temporary
compile directory and no application plugins. Cover distinguishing cases for
**every adjacent precedence level**, including prefix/modifier binding and
explicit parentheses. Document which path checks acceptance versus execution;
do not silently change the meaning of the existing recording projection. Never
evaluate arbitrary corpus source to establish precedence.

## Acceptance work

1. Add hand-written `test/corpus/condition-operators.txt` trees and failing checks
   before grammar changes. Cover every operator, mixed levels, prefix nesting,
   unary versus binary `+/-`, and parenthesized overrides. Use inputs without
   spacing as well as LF/CRLF whitespace; maximal tokens must stay distinct.
2. Add dedicated `fixtures(filename)` reference tests plus the full-engine
   evidence above. Composition must include calls/properties, configs,
   if/elseif, outputs, generic tag arguments/attributes and parenthesized modifier
   arguments. Keep quoted operator text as strings and comment bodies opaque.
3. Preserve complete trees in unknown tags. Assert operator spelling/ranges,
   left/right/argument fields, and no accidental signed-number token collapse.
4. Reject dangling operators, absent operands and excluded comparison chains.
   Delete/restore an operand after `&&` in a nested conditional and compare full
   incremental/fresh snapshots through error and repair. Preserve valid neighbors.
5. Add a precedence mutation (for example swapping `&&` and `||`) and prove it
   generates but fails a distinguishing expected-tree fixture. Keep the existing
   arithmetic precedence mutation effective if its source anchor changes.
6. Run `npm test` and before/after corpus reports outside `build/`, compare
   identical file hashes, inspect newly clean expression structure, and minimize
   the cited corpus condition into a tracked fixture. No clean-file quota.
7. Update the contract, feature row, status and evidence. Record discrepancies
   between recorder acceptance and full execution instead of weakening checks.

## Completion evidence

- [24 manual trees](../../test/corpus/condition-operators.txt) and
  [reference/full-engine/range/edit checks](../../test/condition-operators.test.mjs).
  The first 23 fixtures failed before grammar changes (`/tmp/smarty-005-red.log`).
  Adjacent sign-pair exclusion also failed before its targeted fix.
- `npm test` passes 67 trees, 98 Node checks and 7 mutation checks
  (`/tmp/smarty-005-green.log`). A boolean-level swap generates successfully and
  fails its expected tree; the original arithmetic mutation remains effective.
- [Full-engine adapter](../../test/full-engine.php) and the helper in
  [helpers.mjs](../../test/helpers.mjs) keep setup/process errors distinct from
  compiler/PHP errors, use temporary directories, and test invalid mode failure.
  Only fixed fixtures, primitive values and plain objects containing primitive
  fields are used. No application template is executed.
- Full Smarty establishes every adjacent precedence boundary; in particular
  `{-2|strlen}` returns `-1`, `{(-2)|strlen}` returns `2`, and `{!0|strlen}`
  returns an empty string. The proposed precedence requires no correction.
  `0 == 2 < 3` is false while `(0 == 2) < 3` is true, independently
  distinguishing relational/equality binding (the earlier exploratory
  `1 == 2 < 3` observation alone does not distinguish those groupings).
  Same-level comparison chains produce PHP ParseError despite recorder
  acceptance. Adjacent sign pairs are not nested unary signs; spaced signs are.
- Task 011 corrected the old `Operators in unknown tags and modifier arguments`
  fixture: Smarty classifies `{widget ($a > 0)}` as a function output, not a
  generic tag with a parenthesized argument. The generic-tag operator, attribute,
  comment, and independent-closer coverage is retained using
  `{widget $a > 0 enabled=... value=...}`. The compiler accepts the original
  function-output-with-trailing-attributes source; 011 records it as a
  task-unsupported error/recovery case until output attributes receive their own
  tree contract. This is an expectation correction grounded in the pinned
  Smarty recorder and grammar, not a claim that the old full source is invalid.
- Reports `/tmp/smarty-005-before.json` and `/tmp/smarty-005-after.json` have
  identical hashes for all 467 inputs: **27 → 30 clean**, **440 → 437 failing**,
  no regressions. All three newly clean files have explicit operator nodes:
  `action_types/action_value_test_post.tpl` (`!`),
  `action_types/action_value_textarea.tpl` (`!=`), and `app_doc.tpl` (`==`).
  Local structure review is saved in `/tmp/smarty-005-review.json`.
- The tracked icon condition minimizes `corpus/application/menu_button.tpl:5`. Word aliases,
  bitwise operators, constants/literals, increment/decrement and the other scoped
  exclusions remain unsupported. Clean parsing is not runtime validation.
