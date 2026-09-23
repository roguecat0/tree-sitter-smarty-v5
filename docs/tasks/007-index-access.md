# 007 — Dot and bracket read access

Status: ready; not implemented. Dependencies: 004–006. Implement before 008.

## Scope and motivation

Add dot keys and bracket read indices while preserving each receiver and index:

```smarty
{$rows.name}{$rows.0}
{$rows[0]['name']}{$rows[$key + 1]}
{$row['module']->get_status()}
{$user->rows[0].name}
{$user->get_profile()->rows[$key]->get_name()}
{#settings#.name}{#settings#[0]}
```

Allowed receiver paths are deliberately narrower than unrestricted postfix
expressions. A variable may take repeated dot/bracket indices, then property or
method segments. A static property segment may take repeated indices, followed
by another property/method segment. A method segment may be followed by a
property/method segment, but **not directly by an index**. Config variables may
have repeated indices but cannot acquire an object chain. Parenthesized values,
literals and arbitrary expression results are not receivers in this task.

Dot keys are adjacent static ASCII identifiers or unsigned integer tokens.
Bracket indices use the supported expression subset, including strings, variables,
parenthesized expressions and arithmetic. Exclude bare identifier section indices,
empty append indices, dynamic dot keys, braced dot expressions, assignments,
array literals, section/foreach metadata semantics and dynamic config names.

On 2026-09-22, raw lexical searches over all 467 local `.tpl` files found dot
access hints in 187 files and variable-bracket hints in 35. These overlap and
include strings/comments; they are not failing-file counts or coverage estimates.
`corpus/action_types/action_value_afmelden.tpl:23-24` supplies the minimized
`{$row['module']->get_status()}`; `corpus/history.tpl:35` supplies a property with
an indexed value followed by a call inside commented-out template code; it is
provenance for a syntax example, not evidence of an active parse failure. `corpus/toolbar.tpl:4` supplies a static dot
chain through `$smarty.const`. Treat that chain syntactically; no special-variable
runtime support is claimed.

## Proposed tree contract

Add `index_expression` with `object` and `index` fields. Dot and bracket forms
share this node; anonymous punctuation distinguishes them. A static dot key is
an `identifier` or `number`; a bracket key retains its complete expression tree.
Each access wraps the previous receiver, preserving source order and left nesting.
Existing member and method nodes retain their fields, with newly allowed indexed
receivers. Binding is tighter than modifiers and all operators.

```text
{$row['module']->get_status()}
(source_file
  (output value: (method_call_expression
    object: (index_expression
      object: (variable name: (identifier))
      index: (string))
    method: (identifier))))
```

Do not model a dot key as an object property or flatten an index into variable
text. `{#settings#.name}` has a `config_variable` receiver. The same tree shape
may occur in a tag attribute, modifier argument, condition or foreach source.

## Reference observations (Smarty 5.8.4, 2026-09-22)

The existing recording adapter accepts the examples above, `$rows[0][1].name`,
`$rows.name[0]`, `$a.if`, `$a [0]` and `$a[ $key + 1 ]` in output tags. It rejects
`$a .name`, `$a. name`, `$rows. 0`, `$user->get_rows()[0]`,
`$rows[0]->find()[0]`, and both `#rows#[0]->name` / `#rows#[0]->find()`.
Dot punctuation and its key must stay adjacent to the preceding receiver.
Bracket whitespace is allowed. Inspect `arrayindex`, `indexdef`, `varindexed`,
`configvariable`, `objectelement` and `method` in the vendored parser.

The recorder accepts `$rows[ ]` and `$rows[key]`; these are intentionally excluded
append/section forms, not malformed Smarty. Never claim both parsers reject them.
Its projection does not expose index structure or values. Explicit trees and
field/range assertions are the structural authority; ordinary reference event
comparisons establish surrounding syntax only.

## Acceptance work

1. Write manual `test/corpus/index-access.txt` trees and failing Node checks before
   implementation. Cover repeated/mixed indices, config receivers, integer dot
   keys (including `$a.1.2`), keyword keys, expression indices and all receiver
   transitions listed above. Preserve existing property/call-only trees.
2. Opt valid fixtures into dedicated reference checks with `fixtures(filename)`.
   Test outputs, unknown tags, attributes, modifiers, if/elseif and foreach,
   retaining full expression detail and nearby opaque comments/strings.
3. Assert exact `object`/`index` fields, text/ranges and punctuation; distinguish
   `$a.0` from decimal numbers and `$a[1 + 2]` from swallowed index text. Check
   modifier/operator binding and keyword keys without weakening tag reservation.
4. Reject missing indices/closers, illegal dot spacing, direct call-result
   indexing and config-to-object chains. Separate Smarty rejection from subset
   exclusions. Delete/restore `]` inside a method argument, and change a static
   dot access to a bracket expression; compare full incremental/fresh snapshots
   through error and repair with valid neighbors preserved.
5. Add a focused mutation losing the index field or a chain receiver and prove
   an explicit tree fails. Update prior indexing exclusions only for newly
   supported forms, explaining each intentional support-boundary change.
6. Run `npm test` and hash-matched before/after corpus reports outside `build/`.
   Inspect regressions and newly clean access structure, promote the cited
   minimized examples, and update contract, feature row, status and evidence.
   No clean-file quota; no implicit runtime `$smarty` semantics.

## Completion evidence (fill when implemented)

Trees/reference/range/edit/mutation links; commands and outcomes; saved report
paths and hash comparison; cited minimized examples; changed exclusions; remaining
append, dynamic, section and direct method-result indexing boundaries.
