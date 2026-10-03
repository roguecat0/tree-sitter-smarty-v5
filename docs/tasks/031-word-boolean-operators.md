# 031 — Prefix `not`

**Status:** complete; independent implementation review accepted on
2026-10-03. The prior combined operator candidate remains rejected; binary
aliases are tracked separately in Task 032.
**Type:** standard Smarty 5 prefix expression syntax.
**Depends on:** [005 symbolic condition operators](005-condition-operators.md),
[011 standalone function calls](011-standalone-function-calls.md), and
[013 shared expression operators](013-divisibility-predicate.md).
**Follow-up:** [032 word binary boolean operators](032-word-binary-boolean-operators.md).

## Why this is one task

The application corpus report after Task 030 is hash matched at 456 clean / 11
failing files. `corpus/application/message.tpl:1` contains the valid condition
`{if not isset($type)}`. Its minimized form is accepted by the pinned Smarty
5.8.4 recorder and renders `Y` when `type` is unset; the accepted Task 030
parser errors at `not`. This is a specific prefix-expression gap. Binary
aliases `and`, `or`,
and `xor` have separate token boundaries and precedence interactions with the
already-supported symbolic `&&` and `||`; they are moved to Task 032 so a
reviewer can isolate unary-token/context behavior before the binary ladder is
expanded.

The pinned lexer recognizes prefix `not` as `NOT`, and the parser has
`value ::= NOT value` in `vendor/smarty/smarty/src/Parser/TemplateParser.y`.
The desired node mirrors the established symbolic unary contract. This task
does not implement binary word operators and does not change symbolic operator
precedence.

## Required tree contract

In already-supported full-expression positions, a whitespace-delimited,
case-insensitive prefix `not` produces `unary_expression` with an explicit
`operator: (word_operator)` and `argument` fields. Preserve exact spelling and
source range. Bind it as a prefix to the following value, before the existing
binary expression levels. For example:

```smarty
{if not isset($type)}Y{/if}
```

```text
(source_file
  (if_block
    (if_tag condition: (unary_expression
      operator: (word_operator)
      argument: (function_call_expression name: (identifier)
        argument: (variable name: (identifier)))))
    (text)
    (if_close_tag)))
```

Use explicit trees and field/range assertions; the recorder cannot establish
operator structure or precedence. Verify the existing full-expression
compositions that the grammar claims to support: output, `if` and `elseif`
conditions, generic-tag positional and attribute values, function/method
arguments, array values, and parenthesized modifier arguments. Include at least
one combined expression such as `not $a && $b`, whose tree must place the
complete unary expression on the left of the existing symbolic binary node.
Do not broaden the set of expression contexts as part of this task.

## Token and recovery boundaries

- `NOT` requires whitespace after the keyword. `$not`, `notable`, and the
  function-call source `{not($a)}` retain their existing classifications.
- Bare `not` remains an identifier/value in `{not}`, `{widget not}`,
  `{widget value=not}`, and `{widget not=value}`. Strings and comments remain
  opaque.
- In `{if $a not $b}`, `not` is not a binary condition operator. The pinned
  parser can interpret a following positional expression through its generic
  tag-attribute route, but this route is not required for this prefix-expression
  task. Keep the behavior and any implementation decision visible as a
  separately reviewable tag-argument question; do not let a special `if` or
  `elseif` argument rule destabilize ordinary tag parsing to force it into this
  task.
- Reject/recover malformed `not` operands without swallowing a following
  comment, independent output, or block closer. Include incomplete and malformed
  interpolation/string neighbors if the lexer state can affect those paths.

## Failing-first fixtures and acceptance evidence

Before grammar changes, add hand-authored trees and failing checks for:

1. Prefix `not` over a variable, a function call, a parenthesized expression,
   and an existing unary expression; exact operator spelling, range, and
   argument ownership.
2. The corpus witness `{if not isset($type)}Y{/if}` and a nested `if`/`elseif`
   composition with symbolic `&&`/`||`.
3. Each supported expression context listed above, plus a generic tag whose
   bare identifier is literally `not`.
4. Case variants, `$not`, `notable`, `{not($a)}`, and occurrences in strings and
   comments, so contextual words remain distinct.
5. Missing operand and malformed prefix recovery with following independent
   syntax retained.
6. Change a valid word-operator boundary to a valid symbolic one and restore it
   (for example `{if not $a}` ↔ `{if !$a}`), comparing full incremental
   snapshots with fresh parses at each state. Separately delete the operand
   from `{if not $a}`, verify an error and retained neighboring syntax, then
   repair it and compare again. A binary-operator edit belongs in Task 032; do
   not assert that deleting `and` from `not $a and $b` creates a valid tree.

Use `fixtures(filename)` for dedicated recorder checks. The pinned full engine
must verify this discriminating pair for prefix binding against the existing
symbolic `&&` level:

```smarty
{if not 1 && 0}T{else}F{/if}       {* F: (!1) && 0 *}
{if not (1 && 0)}T{else}F{/if}    {* T: !(1 && 0) *}
```

The reference helper checks observable events only; it cannot prove the AST.
`spawnSync php EPERM` is an environment failure, not an acceptance exception.
The task remains blocked until a supported execution route runs the required
reference checks, controlled full-engine probes, and `npm test`; do not report
them as passing, silently skip them, or replace them with duplicated answers.

The entire existing acceptance suite must pass with no regressions. In
particular, the failed combined candidate changed four legacy results while its
nine new Task 031 corpus cases passed:

- the two generic-tag operator fixtures in
  `test/corpus/condition-operators.txt` became errors;
- malformed interpolation recovery changed from an error/text/output shape to
  an interpolated string with a missing `}` and a following output;
- `{widget ($a > 0)}` ceased to be the Task 011 function-output tree.

These are concrete no-regression witnesses, not permission to edit their
expectations. The candidate also asserted a successful parse after deleting
`and ` from `{if not $a and $b}`; the resulting `not $a$b` is malformed, so
that edit assertion must be replaced with the unary-operand deletion/repair
sequence above.

Run `npm test`, save separate before/after application, upstream-core, and
upstream-demo reports outside `build/`, compare matching source hashes, inspect
every newly clean tree, and report any remaining errors. A task-specific green
fixture subset is not an acceptance gate.

## Scope moved to Task 032

Binary `and`, `or`, and `xor` remain required standard Smarty syntax and stay in
the feature inventory and queue. Their exact spelling/ranges, case-insensitive
lexical boundary, left associativity, precedence against existing `&&`/`||`,
and the unusually low `xor` precedence are specified in Task 032. No operator
has been removed from the project target.

## Failed candidate record (not completion evidence)

The combined candidate included prefix `not`, binary `and`/`or`/`xor`, a
special trailing positional `not` branch on `if`/`elseif`, and scanner/parser
changes. Its recorded snapshot passed 9 Task 031 corpus cases but failed 4 of
280 Tree-sitter cases. Three bounded implementation attempts investigated an
explicit gap rule, an external whitespace token with serialized state,
scanner whitespace probing, and precedence adjustment; none cleared the four
regressions. The complete acceptance gate and corpus comparisons were not
accepted. Do not reuse its parser hash, earlier claimed test counts, or corpus
reports as evidence for either re-scoped task.

The prior combined brief's special `{if $a not $b}` / `{elseif $b not $c}`
trailing-argument contract is not part of this operator task. The pinned
`LDELIF expr + attributes` route remains an investigated Smarty behavior; if it
is promoted as a supported parser-tree contract, create and review a separate
bounded built-in-tag argument task with its own source, tree, and recovery
evidence. Do not claim that form as an implemented result based on the failed
candidate.

## Completed implementation and evidence

The candidate supports case-insensitive, whitespace-delimited prefix `not` in
the existing `_unary` expression route. It produces
`unary_expression(operator: (word_operator), argument: ...)`; strings,
comments, generic-tag bare names, and function-call spelling retain their
separate existing classifications. Binary `and`, `or`, and `xor` are not
implemented here.

Focused evidence:

- `node test/word-boolean-operators.test.mjs`: 20 checks passed, including
  reference checks, binding against symbolic boolean operators, supported
  contexts, boundaries, incremental `not`/`!` round-trip, and operand
  deletion/repair.
- `test/corpus/word-boolean-operators.txt`: 13 manually specified Task 031
  trees passed. The nested condition/elseif tree composes prefix `not` with
  both `&&` and `||`:
  `{if not $a && $b}{if not $c || $d}Y{/if}{elseif not $e && $f}Z{/if}`.
- `npm test`: `check:grammar` passed; 273/273 Tree-sitter cases and 386/386
  Node checks passed; all 18 deliberate grammar mutations were caught.
- The mutation anchor for “standalone function arguments lose their field” was
  updated to include `choice($.identifier, $._not_identifier)` as the function
  name. The mutation still changes the argument field to `value`; it was caught
  in both the standalone mutation run and the full acceptance gate.
- No expected trees were auto-updated or changed to mask a regression.

Malformed C-style recovery exposed by the prefix-token change is preserved by a
narrow alternative for an omitted condition. For
`before {for $i=0; ; $i++}bad{/for} after {$later}`, the exact tree is:

```text
(source_file (text) (for_block (for_tag (c_style_for_header initializer: (for_initializer target: (variable name: (identifier)) value: (number)) update: (for_update target: (variable name: (identifier))) (MISSING _output_attribute_error_marker))) (text) (for_close_tag)) (text) (output value: (variable name: (identifier))))
```

The missing internal marker is a genuine Tree-sitter error. The loop remains a
`for_block` with its own body text and `for_close_tag`, and the trailing text
and output remain separate siblings. Existing `test/for-loops.test.mjs`
assertions remain intact. This recovery alternative is included in the candidate
and needs independent review alongside the unary-token implementation.

Separate corpus reports were generated after the acceptance gate directly from
the final parser hash
`cfd11f02eca81aaafb63046f812091a98fa77e10b98e1a0840b24171a0824454`:

```sh
node scripts/corpus-report.mjs corpus/application /tmp/smarty-task031-final-application.json
node scripts/corpus-report.mjs corpus/upstream-smarty-v5.8.4-core /tmp/smarty-task031-final-upstream-core.json
node scripts/corpus-report.mjs corpus/upstream-smarty-v5.8.4-example /tmp/smarty-task031-final-upstream-example.json
```

| Corpus root | Before → after clean | Final report |
| --- | ---: | --- |
| Application (467 files) | 456 → 456 (11 errors) | `/tmp/smarty-task031-final-application.json` |
| Upstream Smarty core (33 files) | 29 → 29 (4 errors) | `/tmp/smarty-task031-final-upstream-core.json` |
| Upstream Smarty demo (1 file) | 0 → 0 (1 error) | `/tmp/smarty-task031-final-upstream-example.json` |

Each before/after pair has identical source-file hashes. There are no newly
clean files and no clean-to-error regressions, so there were no new clean trees
to promote. The application witness `corpus/application/message.tpl` now
parses `{if not isset($type)}` into the explicit unary/function-call structure;
that file still reports an error at a later assignment-output construct, so
the application total remains 456/467. The before reports were measured at the
Task 030 parser hash
`e8a98eb92ecc98f37b67b92218ffeb1564d50a291ef0947f3a2251451041e7f6`.

The implementation changes grammar, generated parser metadata, the Task 031
trees and checks, the contract/features evidence, and the mutation anchor.
Independent implementation review accepted the candidate on 2026-10-03 and
verified the required boundary edit, `&&`/`||` composition, evidence counts,
full test gate, generated-source hashes, and separate corpus reports. This
completes Task 031 only; Task 032 remains queued and the broader Smarty target
is not complete.
