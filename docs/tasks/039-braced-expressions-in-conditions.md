# 039 — Braced expressions in `if` and `elseif` conditions

**Status:** complete; independent implementation review accepted after documentation synchronization (2026-10-04).
**Type:** standard Smarty 5 expression syntax and block recovery.
**Depends on:** [005 condition operators](005-condition-operators.md), [006 foreach/if blocks](006-foreach-blocks.md), [032 word boolean operators](032-word-binary-boolean-operators.md), [034 word comparisons](034-word-comparison-operators.md), and [038 braced expressions in bracket indices](038-braced-expressions-in-bracket-indices.md).

**Scope revision (2026-10-04):** Section 6's malformed recovery probes were
revised to separate an unambiguous missing-header composition from an
inherently ambiguous one-close case, while preserving useful named-node
navigation without prescribing Tree-sitter `ERROR` boundaries. A second
separate reviewer accepted this revision; valid syntax requirements are
unchanged.

## Recovery expectation correction (2026-10-04)

Adding the condition-specific expression primary changes scanner recovery for
the existing Task 037 rejection `{widget value={ $x}}{$after}`. A focused
scanner trace shows recovery consumes the opening `{`, so the subsequent
`text` node begins at the whitespace. The old Task 037 expectation included a
`string_fragment` from a different recovery path. Pinned Smarty 5.8.4's
recorder and full compile both reject the source with `Unexpected " "`; this
is a recovery-tree correction only and does not accept inner-leading
whitespace. The revised tree keeps `ERROR` `[0,14)`, preserves the malformed
remainder as `text` `[14,20)`, and retains clean `{$after}` output `[20,28)`.
See the [Task 037 correction evidence](037-braced-generic-tag-attribute-values.md#recovery-expectation-correction-2026-10-04).

## Corpus motivation and pinned Smarty evidence

The committed Task 038 application report is
`/tmp/smarty-task038-application.json`, with parser SHA-256
`f372ef95587e65541a71436966b1ca21fe3c381999dd2e2a41fc3bb4855db107`. It
matches `src/parser.c` and reports 465/467 clean application files. One
remaining file, `view_certificate/actions_list.tpl`, has two reported errors.
The file hash is
`f922da77a95d5278dbffe103b2aa6fc2bf1035b41146057f75c2c28af367f511` and
matches the inspected CRLF source. Its line 41 condition is:

```smarty
{if {$sub_repair->get_attachments()->count()}>0}
```

The first report error is at UTF-16 range `[2340,2344)` (1-based line 41,
column 33), at the opening `{if ` of this condition. A second error at
`[3350,3380)` (line 54) covers the close tag `{/if}` and following indentation.
The latter is downstream recovery from the unrecognized line 41 opening, not
an independent close-tag grammar gap: replacing only the braced condition with
each of `{if $sub_repair->get_attachments()->count()>0}`, the whitespace
variant `{if $sub_repair->get_attachments()->count() > 0}`, and `{if true}`
makes this same full application file parse with no errors. Keep the exact
source hash and both reported ranges in the evidence record; do not count the
line 54 error as an independent feature.

Pinned Smarty 5.8.4 accepts the minimized forms `{if {$x}}Y{/if}` and
`{if {$x} > 0}Y{/if}`. Both the syntax recorder and the full engine in
compile-only mode accept them. The recorder emits an `output` event before the
`if` event for the braced expression; for a braced `elseif` operand it emits an
`output` event before `elseif`. This confirms recognition and event order only.
The recorder projection exposes neither the condition field nor ownership of
the braced expression. Full-engine compile-only acceptance confirms compiler
syntax, not generated PHP semantics, evaluated values, or equivalence with an
unbraced expression. Define ownership with manually specified Tree-sitter
trees.

Additional pinned probes confirm the boundary and composition needed here:
braced variables, method calls, modifier expressions, and arithmetic are
accepted as conditions; an expression inside braces may itself contain
operators, and operators may compose around a braced expression. The actual
line 41 method chain followed by `>0` compiles. `{if { $x}}` is rejected with
`Unexpected " "`, matching the existing rule that inner-leading whitespace is
not accepted for this braced-expression form. A missing right operand such as
`{if {$x} > }Y{/if}` is rejected with `Unexpected "}"`. Compile-only checks
also establish that an unclosed `if` and crossed `{foreach}` close are compiler
errors; the syntax recorder does not validate block pairing.

## Bounded scope and tree contract

Accept a complete braced Smarty expression as a primary operand inside the
existing expression grammar for `{if}` and `{elseif}` conditions. Represent
the braces as a nested `output(value: expression)` at that operand position.
The existing condition grammar owns the whole expression in the `condition`
field. Thus `{if {$x}}` has
`if_tag condition: output(value: variable)`, while in
`{if {$x} > 0}` the `condition` is a `binary_expression` whose `left` is that
`output` wrapper and whose `right` is the number. For `{elseif ...}`, apply the
same shape under `elseif_tag.condition`. This ownership is the proposed
contract; the recorder's event ordering is not evidence for it.

Retain the current `if_block` and `elseif_clause` nesting, branch body
ownership, `else_clause`, and matching `if_close_tag`. Do not flatten a braced
operand to text, promote it to a template-level sibling output, or let its
closing brace end the surrounding control tag. The wrapper's range includes
its two braces; its `value` excludes them. Existing direct conditions such as
`{if $x > 0}` stay unwrapped. Unknown tags, foreach sources, for headers,
attribute values, bracket indices, assignment targets, delimiters, plugin
semantics, and application-specific tag behavior are outside this task.

The condition after wrapping remains governed by the existing operator
contract: member/call and modifier precedence, prefix operators, multiplicative
and additive arithmetic, relational and equality comparisons, then boolean
operators. A wrapper is one primary operand; operators inside its braces use
their normal shared-expression precedence, and operators outside compose at
their existing outer levels. Preserve existing associativity, word-operator
spacing, comparison-chain restrictions, and `word_operator` fields. This task
does not add operator kinds or change precedence.

For `{if {$x} > 0}Y{/if}{$after}`, the required structure is a single
`if_block` with `if_tag.condition` holding a binary expression whose left is
`output(value: variable)` and whose right is `number`, followed by the body,
`if_close_tag`, and a root-level output for `$after`. For
`{if true}{elseif {$y} and $ready}Z{/if}{$after}`, retain the initial `if_tag`,
an `elseif_clause` with `elseif_tag.condition` holding a binary expression
whose left is the wrapper, then the clause body, the one matching close, and
the independent trailing output. Hand-authored trees must separately cover a
braced full condition, a wrapper composed with an outer comparison/boolean
operator, and an operator expression inside braces. Include a method-chain
condition matching the application form, a modifier-wrapped operand, and
arithmetic where precedence is visible. Preserve exact field ownership,
child order, and zero-based end-exclusive UTF-16 ranges for wrapper, value,
condition, `if_tag`/`elseif_tag`, containing block, closer, and trailing output.

For the exact source `{if {$x} > 0}Y{/if}{$after}`, assert the condition and
binary expression ranges `[4,12)`, the nested `output` `[4,8)`, its variable
value `[5,7)`, operator `[9,10)`, number `[11,12)`, `if_tag` `[0,13)`, body
text `[13,14)`, `if_block` `[0,19)`, `if_close_tag` `[14,19)`, and following
output `[19,27)`. In the full-condition control `{if {$x}}Y{/if}`, the
`if_tag.condition` and nested `output` both span `[4,8)`, the wrapper value is
`[5,7)`, the `if_tag` spans `[0,9)`, body text `[9,10)`, and the block is
`[0,15)`. Also assert source slices for these nodes so punctuation ownership
is unambiguous.

## Failing-first fixtures and checks

Before grammar edits, add hand-authored expected trees and a failing Node check.
Use dedicated Tree-sitter fixtures for valid examples and keep malformed
examples in Node checks or a separate error fixture so the ordinary reference
`fixtures(filename)` loader only receives valid source.

1. Pin `{if {$x}}Y{/if}`, `{if {$x} > 0}Y{/if}`, and direct control
   `{if $x > 0}Y{/if}`. Assert the wrapper is nested in `if_tag.condition`,
   braces are included only in the wrapper range, and direct conditions remain
   unwrapped. Add a corresponding valid `elseif` condition and preserve the
   `elseif_clause` and matching `if_close_tag` structure.
2. Exercise expression composition both inside and outside braces. At minimum,
   include `{$a + 1 * 2}` inside the braced operand, a braced method chain
   followed by `> 0`, and `{$x} and $ready` in an `elseif` condition. Check
   operator fields, precedence, and complete left/right trees, not only node
   counts. Include a modifier expression as a wrapped operand. A selected
   comparison plus logical operator case must preserve existing comparison and
   boolean precedence. Keep the requested cases bounded; do not create a
   Cartesian expression matrix.
3. Include a valid complete block with a braced `if` condition, nested `if` or
   `foreach`, branch body, matching close tags, and `{$after}` after the outer
   closer. This proves that both braces in the condition leave the outer block
   close boundary intact.
4. Pin the application-shaped minimized condition
   `{if {$repair->get_attachments()->count()}>0}Y{/if}` without application
   names. Check the nested method-call chain under the braced output and the
   outer comparison under `condition`. Also record the full corpus witness and
   its hash/ranges above; after implementation confirm both line 41 and the
   downstream line 54 error disappear, and inspect the resulting containing
   `foreach`/`if` tree through its closes.
5. Use `fixtures(filename)` from `test/helpers.mjs` to compare valid braced
   condition cases against the pinned recording adapter. Assert the exact
   recorder events, including the inner `output` before `if`/`elseif`, while
   stating in the check that these events do not prove `condition` ownership.
   Use `fullEngine(..., {mode: 'compile'})` for supported full-block examples;
   do not claim runtime values or PHP operator semantics from compile-only
   results.
6. Probe rejected leading inner whitespace and malformed condition/block
   boundaries. The pinned Smarty 5.8.4 rejection
   `{if { $x}}Y{/if}{$after}` must produce a real Tree-sitter error; preserve
   `{$after}` as a distinct error-free output node.

   For missing RHS `{if {$x} > }Y{/if}{$after}`, require an `if_tag` retaining
   the left braced `output` in its condition and a real localized error for the
   `>` operator; retain body text `Y`, the actual `if_close_tag`, and a distinct
   error-free output for `{$after}`. Preserve their source slices and order.
   Do not require a `binary_expression` or missing-RHS marker: the established
   Task 034 contract allows a retained left condition plus a sibling operator
   error. Header `[0,12)`, body `[12,13)`, close `[13,18)`, and trailing output
   `[18,26)` are the exact source boundaries for this probe.

   For the missing-header-close probe
   `{if {$x} and $ready{/if}{$after}`, require a real parse error and an
   `if_tag.condition` containing the nested `output(value: variable $x)` and
   the complete outer `binary_expression` for `$x and $ready`: the nested
   output is its left operand and `$ready` is its right operand. Preserve
   `{/if}` as a recognizable close or named recovery node, and preserve
   `{$after}` as a distinct error-free output. Do not prescribe the error
   extent, require an `if_block`, or require a header/body split.

   Keep `{if {$x}Y{/if}{$after}` as an explicitly ambiguous one-close recovery
   probe: require a real parse error, a recognizable close/recovery node for
   `{/if}`, and a distinct error-free `{$after}` output. Do not require a
   particular brace owner, `if_tag`, `if_block`, or header/body split.

   Also check unclosed `{if {$x} > 0}Y` and crossed close
   `{if {$x} > 0}Y{/foreach}{$after}`. For the unclosed form, require a real
   error or missing-close marker and preserve a recognizable `if_tag`, its
   condition, and body text. Pin these nodes' source slices/ranges and relative
   order; recovery may be rooted in `ERROR` and need not form an `if_block`.

   **Evidence-backed crossed-close recovery correction:** the second case has
   an `{if}` opener but no matching `{/if}`; do not require a completed
   `if_block` or synthesize an `if_close_tag`. The existing section recovery
   contract says crossed block closes can produce one root `ERROR` spanning
   the malformed region and `$after`, with block nodes, closers, and output
   retained as named descendants ([contract](../../test/CONTRACT.md#L145),
   [section recovery assertion](../../test/section-blocks.test.mjs#L125)). The
   current tree for the direct-condition analogue
   `{if $x}Y{/foreach}{$after}` is exactly:

   ```text
   (source_file
     (ERROR
       (if_tag condition: (variable name: (identifier)))
       (text)
       (ERROR (string_fragment))
       (output value: (variable name: (identifier)))))
   ```

   For the braced-condition case, require a recovery `ERROR` to retain the
   `if_tag` and its complete condition, the body text, a distinct error/recovery
   descendant for `{/foreach}`, and a distinct error-free `output` descendant
   spanning `{$after}`. The output need not be a root sibling: assert it is
   named, has no error, retains its exact source slice, and is a descendant of
   the recovery `ERROR`. Pin relevant source slices and named-node order, but
   not the recovery node's full extent. This follows the existing boundary
   instead of imposing root-sibling recovery on an unmatched `if` opener.

   Full-engine checks must confirm compiler rejection. The recorder may accept
   malformed block pairings, so it cannot be used as a block-validation oracle.
7. Add edit-boundary checks starting with `{if $x > 0}Y{/if}{$after}`:
   insert wrapper braces around the left operand, edit its expression to a
   method call/config variable, remove and restore the inner or outer closing
   brace, and compare each incremental snapshot with a fresh parse. Include an
   edit in an `elseif` condition and verify the following branch closer and
   trailing output remain stable.

Do not hand-edit generated parser files, auto-update expected trees, or use a
broad text fallback. After implementation run `npm test`, save application and
each upstream report outside `build/`, and structurally inspect newly clean
application files. Keep application, Smarty core, and demo results separate.

## Implementation and completion evidence (2026-10-04)

With the Task 037 recovery expectation correction applied, `npm test` passes:
349/349 Tree-sitter corpus trees, 489/489 Node checks, and all 18 deliberate
grammar mutations caught. Full output is
`/tmp/task039-final-corrected-contract.log` (SHA-256
`c934e5a96c84fc098e098e6c321633b8699e6b228947717931bcacb2484862b9`).

The candidate parser SHA-256 is
`bac0ebadfa4d0168a9ecf9228d380d982280dcb86c9fb4dcb1496804b2c572ce`. Its
hash-matched application report, `/tmp/task039-interim-application.json`, is
466/467 clean versus the Task 038 baseline of 465/467; only
`view_certificate/actions_list.tpl` is newly clean, with no regressions. The
upstream core report `/tmp/task039-interim-upstream-core.json` remains 31/33
clean and the upstream demo report `/tmp/task039-interim-upstream-example.json`
remains 0/1. Structural inspection of the newly clean application file confirms
the line 41 condition is a binary expression with nested
`output(value: method_call_expression)` on the left and a number on the right;
the containing nested blocks and foreach close tags through lines 53–54 are
error-free, and the root has no error. The independent completion review
verified the brief's syntax, composition, precedence, recovery, edit checks,
generated parser hash, and separate corpus reports. Its only finding was stale
feature, composition, and contract documentation; after those docs were
synchronized, the reviewer confirmed the finding was resolved. The broader
if/elseif feature remains Partial because other standard conditional syntax is
still incomplete.

## Task boundary and remaining gaps

This task covers only a braced expression used as an operand in `{if}` and
`{elseif}` condition expressions, with existing expression operators around
the wrapper. It does not expand the set of supported expression kinds or
operators, introduce dynamic expressions in other contexts, modify branch
pairing rules, or assert generated PHP/runtime behavior. The separate array
addition composition gap in `view_orders/new_article.tpl:5` remains Task 040.

## Task-creation review checklist

Independently confirm the Task 038 report hash and the application file hash,
CRLF-sensitive source boundaries, both error ranges, and that correcting only
the line 41 condition removes the later line 54 recovery error. Verify the
recorder and full compiler are pinned Smarty 5.8.4, the probes distinguish
acceptance from tree ownership and runtime behavior, and the proposed nested
`output` wrapper composes with the existing condition expression tree. Review
operator precedence, malformed wrapper/tag boundaries, the `if_close_tag`,
and following-output recovery requirements before implementation.
