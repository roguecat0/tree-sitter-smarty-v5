# 007 — Dot and bracket read access

Status: complete (2026-09-23). Dependencies: 004–006.

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
parenthesized expressions and arithmetic. This task covered read access only;
shorthand assignments were unimplemented then, not rejected by Smarty. Task 033
now supports assignment targets with direct variables and nonempty indices using
the existing index-expression subset. Empty append indices, bare identifier
section indices, array literals,
section/foreach metadata semantics and dynamic config names remain outside this
read-access task.

The original task excluded dynamic dot expressions because they were not yet
implemented. Task 035 later confirmed the standard `.{$expr}` production against
Smarty 5.8.4 and added its structural support; this historical boundary is
superseded by [Task 035](035-dynamic-dot-index.md).

On 2026-09-22, raw lexical searches over all 467 local `.tpl` files found dot
access hints in 187 files and variable-bracket hints in 35. These overlap and
include strings/comments; they are not failing-file counts or coverage estimates.
`corpus/application/action_types/action_value_afmelden.tpl:23-24` supplies the minimized
`{$row['module']->get_status()}`; `corpus/application/history.tpl:35` supplies a property with
an indexed value followed by a call inside commented-out template code; it is
provenance for a syntax example, not evidence of an active parse failure. `corpus/application/toolbar.tpl:4` supplies a static dot
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

The recorder accepts `$rows[ ]` and `$rows[key]`; these are intentionally
excluded append/section forms, not malformed Smarty. In particular, Smarty also
accepts them as shorthand-assignment targets (`{$rows[] = $value}` and
`{$rows[key] = $value}`), as verified while creating [Task 033](033-shorthand-assignment-tags.md).
They remain required project syntax gaps, not rejected forms; a future task must
model them structurally in index reads and assignment targets. Never claim
Smarty rejects them. The recorder projection does not expose index structure
or values. Explicit trees and field/range assertions are the structural
authority; ordinary reference event comparisons establish surrounding syntax
only.

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

## Completion evidence (2026-09-23)

- [Nine manual trees](../../test/corpus/index-access.txt) and
  [reference/field/range/boundary/edit checks](../../test/index-access.test.mjs).
  Minimized module access and `$smarty.const.LABEL` promote the cited local
  examples; no runtime special-variable behavior is implied.
- Initial `npm test` failed all nine new fixtures; final `npm test` passes
  84 trees, 124 Node checks and nine mutations. The added mutation changes the
  bracket index field and fails the mixed-index tree. The prior property mutation
  anchor now includes indexed receivers while preserving the identical fault.
- Hash-matched reports: `/tmp/smarty-007-before.json` and
  `/tmp/smarty-007-after.json`: 467 templates, **46 → 57 clean**, **421 → 410
  failing**, no regressions. `/tmp/smarty-007-review.json` records explicit
  object/index inspection in all eleven newly clean files (60 index nodes).
- Removed only the prior property checks rejecting `$user.name` and
  `$user->name[0]`; positive exact trees now cover both. Existing expected trees
  remain unchanged. Append, section/bare-name, dynamic-dot and direct method-result
  indexing remain excluded, as do config-to-object chains.

- The initial read-access scope listed assignments as excluded because their
  syntax was not implemented. This was not a Smarty rejection: the pinned
  recorder and full compiler both accept `{$a[0]=1}` as an `assign` event with
  `value` and `var` arguments. Task 033 adds the structural assignment tree for
  this compact spelling and for nonempty expression indices. Empty append and
  bare identifier section-index targets remain future structural gaps.
