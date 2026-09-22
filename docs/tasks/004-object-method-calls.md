# 004 — Static object method calls

Status: complete (2026-09-22). Dependencies: 001–003. Implement before 005.

## Scope and motivation

Support statically named object methods with zero or more comma-separated
arguments drawn from the supported expression subset. Permit calls after a
variable/property chain, properties after calls, and repeated calls:

```smarty
{$user->get_name()}
{$app->template->get_buttons($id)}
{$user->find($id, #label#, 2 + 3)}
{$user->get_profile()->name}
{$user->get_profile()->get_name()}
```

`corpus/toolbar.tpl:5-7` supplies property receivers, one-argument calls and
modifier composition. `corpus/action_types/action_value_afmelden.tpl:45` supplies
`$action->get_user()->get_name()`. Reduce these to neutral names in tracked tests;
do not promise support for either full template. The last measured baseline is
15 clean / 452 failing out of 467 files; rerun it before implementation.

Exclude standalone functions, dynamic method names, static `::` calls/constants,
indexing, named arguments, argument unpacking, callable-expression invocation,
arbitrary parenthesized receivers, and runtime method/plugin validation. Bare
`true`/`false`/`null` literals and bare-word arguments need separate scope; use
already supported expressions here. Do not silently expand to PHP call syntax.

## Proposed tree contract

Add `method_call_expression` with `object`, `method: (identifier)`, and repeated
`argument` fields directly on the call node. Parentheses and commas are anonymous
children. `object` may be a variable, member expression or method call. Extend
`member_expression.object` to accept a method call without changing existing
property-only trees. Calls/properties form a left-nested chain and bind more
tightly than modifiers and arithmetic; call arguments retain complete trees.

```text
{$user->find($id, 2)}
(source_file
  (output value: (method_call_expression
    object: (variable name: (identifier))
    method: (identifier)
    argument: (variable name: (identifier))
    argument: (number))))
```

Allow the same static ASCII names as properties, including control keywords in
member position, subject to reference checks. This must not unreserve control
tag names. Method-name whitespace and whitespace inside parentheses must be
specified from Smarty observations, not guessed from PHP.

## Reference observations (Smarty 5.8.4, 2026-09-22)

The existing `reference(source)` accepts all five examples above and
`{$user->name ()}`. It rejects `{$user->name(1,)}`. Inspect `objectchain`,
`objectelement ::= PTR method`, `method`, and `params` in
`vendor/smarty/smarty/src/Parser/TemplateParser.y` before implementing.

A notable boundary: the adapter **accepts** `{$user->name(,1)}` because the empty
`params` production can precede `COMMA expr`. This task deliberately supports
ordinary argument lists only: require a Tree-sitter error for a leading comma,
but record Smarty's acceptance explicitly rather than asserting both reject it.
Do not broaden scope or remove the negative fixture to conceal this difference.

The adapter records neither method names nor their argument counts. Acceptance
and surrounding tag/modifier events are useful evidence; exact trees and range
checks must establish call structure. No adapter change is required merely to
imitate those tree assertions.

## Acceptance work

1. Add manual trees in `test/corpus/object-method-calls.txt` and a failing Node
   check before implementation. Include zero/multiple arguments, nested method
   arguments, property/call chains, and arithmetic/parenthesized arguments.
2. Check calls in outputs, unknown-tag positional arguments and attributes,
   modifier inputs/arguments, and if/elseif conditions. Include configs and
   comments in surrounding template structure. Use `fixtures(filename)` to opt
   these examples into a dedicated reference test.
3. Assert receiver nesting, exact method-name text/ranges, argument order/count,
   and punctuation. Check `{$user->get_name()|escape}` and a call in arithmetic.
   Preserve renamed unknown tags/modifiers and all property-only expectations.
4. Reject unfinished calls, missing arguments, trailing/leading commas and
   unsupported call forms. Distinguish subset exclusions from forms Smarty also
   rejects. Delete/restore `)` in a composed template and compare full incremental
   snapshots with fresh parses, preserving a preceding valid output.
5. Add a focused mutation that drops/mislabels call arguments and prove a manual
   tree catches it. Update the existing property negative check for
   `{$user->name()}`: it becomes positive coverage under this task. Explain that
   intentional support-boundary change; retain unrelated exclusion assertions.
6. Run `npm test` and before/after `npm run corpus:report`, saving reports outside
   `build/`. Compare file hashes, investigate regressions, and inspect call fields
   in newly clean files. Promote at least one minimized cited corpus example.
7. Update the contract, feature inventory, this status and completion evidence.
   Do not claim function calls or runtime correctness from this work.

## Completion evidence

Manual-tree/reference/edit test links; commands and outcomes; local report paths
and hash comparison; corpus provenance; argument-list discrepancy; changed
support-boundary assertion; remaining exclusions.

Implemented static calls and property/call chains with explicit receiver, method,
and argument fields. [Six manual trees](../../test/corpus/object-method-calls.txt)
failed before implementation (`/tmp/smarty-004-red.log`). Dedicated
[checks](../../test/object-method-calls.test.mjs) cover references, ranges,
whitespace/control names, renamed extensions, exclusions and incremental repair.
The method-argument mutation and existing property mutation both fail their
intended trees. No prior tree changed. The property negative assertion for
`{$user->name()}` was removed because this is now supported syntax.

`npm test` passes: 43 trees, 68 Node checks, six mutation checks
(`/tmp/smarty-004-green.log`). Calls bind above properties during reduction to
prevent a generic-tag call being split into a property and parenthesized argument;
the composed manual fixture exposed this before correction. The initial negative
candidate `{f(1)}` already overlaps generic-tag syntax, so standalone-call
exclusion is checked within an expression instead; no generic contract changed.
Leading-comma recorder acceptance is explicitly retained as a discrepancy.

Local reports `/tmp/smarty-004-before.json` and `/tmp/smarty-004-after.json` have
identical hashes for all 467 inputs: **15 → 27 clean**, **452 → 440 failing**,
no regressions. All 12 newly clean files were inspected for explicit method
receiver/name fields (19 zero-argument calls total). The tracked toolbar fixture
minimizes `corpus/toolbar.tpl:5-7`; repeated calls also minimize the cited action
example. Corpus acceptance does not establish runtime behavior. Dynamic names,
standalone calls, indexing, static access and the other listed exclusions remain.
