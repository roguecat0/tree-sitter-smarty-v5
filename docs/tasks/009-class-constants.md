# 009 — Static class constant expressions

Status: complete (2026-09-29). Dependencies: 004–008 for composition fixtures.

## Scope and motivation

Support adjacent `ClassName::CONSTANT_NAME` expressions with static ASCII
identifier names, including lower-case spellings and contextual keyword names.
Class and constant names are syntax, not a registry of application symbols.

```smarty
{State::READY}
{if $action->get_status() == State::READY}Y{/if}
{$user->find(State::ready, true)}
{widget value=State::READY|escape}
```

Exclude namespaces, dynamic class names, static methods/properties, object or
index suffixes on constants, bare global constants, `self`/`parent` class receivers
(case-insensitively), runtime existence/visibility checks, and bitwise operators.
Do not combine static method calls into this task simply because they share `::`.

On 2026-09-22 raw lexical hints for `word::UPPERCASE_NAME` occurred in 228 of
467 local `.tpl` files. These overlapping hints include comments/strings and are
not failing-file diagnoses or promised clean-file improvements.
`corpus/action_types/action_value_afmelden.tpl:1,43-44` supplies class constants
in conditions; reduce to the `State::READY` condition above.
`corpus/menu_button.tpl:5` composes constants with bitwise `&`; that entire
expression remains unsupported and belongs in a later operator brief.

## Tree contract

Add `class_constant_expression` with `class: (identifier)` and
`constant: (identifier)` fields; `::` is anonymous punctuation. Both identifiers
retain exact spelling. It is a primary value and composes with modifiers and
all previously supported operators. Do not represent the expression as a custom
tag or conceal it inside text.

```text
{State::READY}
(source_file
  (output value: (class_constant_expression
    class: (identifier)
    constant: (identifier))))
```

Distinguish `{State}` (a generic tag) from `{State::READY}` (an expression output).
Contextual keywords in `if::READY` and `State::if` are identifier fields without
making malformed ordinary if tags fall back to generic tags. Exact `self` and
`parent` class names are outside this subset; `self_widget` remains an identifier.

## Reference observations (Smarty 5.8.4, 2026-09-22)

The existing recorder accepts `{Thing::READY}`, `{thing::ready}`, `{Thing::true}`,
`{if::READY}`, `{Thing::if}` and the mixed condition above without requiring an
application class definition. It rejects `{Thing :: READY}`, `{Thing ::READY}`
and `{Thing:: READY}`: keep the class, separator and name adjacent.
It rejects `{self::READY}` and `{parent::READY}` through the class-access compiler
restriction, not ordinary lexer rejection. Inspect `value ::= ns1 DOUBLECOLON
static_class_access`, `ns1`, and `static_class_access ::= ID` in the vendored parser.

The recorder accepts namespaced `{\App\Thing::READY}`; namespaces are valid
Smarty but deliberately excluded. Syntax acceptance is not evidence of class
existence or successful execution. Do not execute application templates or add
an application-specific symbol allowlist. The recorder does not expose class or
constant fields; their structure needs explicit tree and range checks.

## Acceptance work

1. Add manual `test/corpus/class-constants.txt` trees and failing Node checks.
   Cover lower/mixed/upper identifiers, contextual keywords, output-versus-tag
   boundaries and constant values in calls, indices, attributes, modifiers,
   if/elseif and a composed foreach body. Promote the minimized corpus condition.
2. Opt valid fixtures into dedicated reference tests. Assert exact identifier
   text/ranges, `::` punctuation, and operator/modifier binding with full trees.
   Unknown tags must preserve these complete expression values.
3. Reject missing class/member, single/triple colon separators, internal
   whitespace and excluded namespaces/dynamic/static-call/property/suffix forms.
   Distinguish Smarty rejection from valid-but-excluded syntax. Preserve ordinary
   modifier colons, named attributes and built-in keyword reservation.
4. Edit `{State}` into `{State::READY}` and back, then delete/restore one separator
   colon inside a conditional. Compare full incremental/fresh snapshots through
   error and repair, preserving unrelated valid neighbors.
5. Add a focused mutation dropping one field or misclassifying constant outputs
   if that failure could escape existing checks; prove the explicit tree catches
   it. Explain changed prior static-access exclusions only for supported constants.
6. Run `npm test` and before/after corpus reports outside `build/`, compare input
   hashes, inspect newly clean constant structure and investigate regressions.
   Update contract, feature row, task status and evidence. No runtime class or
   complete bitwise-condition support may be inferred from clean parsing.

## Completion evidence (2026-09-29)

- Nine manually specified [trees](../../test/corpus/class-constants.txt) and
  fourteen [Node checks](../../test/class-constants.test.mjs) cover reference
  acceptance, exact fields/ranges, contextual names, composition, exclusions,
  and incremental edits across tag/constant and malformed separator boundaries.
  Before implementation, eight new tree cases failed; the quoted-string case
  already passed. No existing expected trees or negative assertions changed.
- `npm test` passes: **100 trees, 151 Node checks, ten mutation checks**.
  The added [mutation](../../test/mutations.mjs) changes the constant field and
  is caught by the manually specified output tree.
- Reference checks confirm adjacent contextual names and reject internal spaces
  and case-insensitive `self`/`parent` receivers. Ordinary tags with those names
  remain supported. Namespaced constants and static calls are valid Smarty
  forms deferred to separate receiver/call contracts, rather than claimed
  invalid language. No application symbol lookup or execution was added.
- `npm run corpus:report -- ./corpus /tmp/smarty-009-after.json` compared with
  `/tmp/smarty-009-before.json`: **71 → 98 clean**, **396 → 369 failing**,
  identical hashes for all 467 templates and no clean-to-failing regressions.
  All 27 newly clean files were inspected for explicit class/constant fields:
  145 constant nodes, recorded in `/tmp/smarty-009-review.json`. These temporary
  reports are local evidence, not portable test dependencies. The minimized
  status condition above is retained in the tracked fixtures.
- The [contract](../../test/CONTRACT.md) and [inventory](../features.md) record
  the supported tree. Remaining namespaces, dynamic receivers, static methods/
  properties, suffixes, global constants and bitwise operators need separate
  bounded tasks. Runtime existence/visibility validation is outside parser scope.
  The 369 failing templates remain triage work; clean counts are not a language
  coverage percentage.
