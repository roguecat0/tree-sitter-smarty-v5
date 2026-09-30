# 016 — Loop metadata as a modifier argument

Status: brief draft; task-creation review required. Depends on Task 012 loop
metadata and Task 015's composition audit.

## Motivation and evidence

Task 015 found a composition gap in the existing loop-metadata production.
Smarty 5.8.4 accepts this minimized expression inside a modern foreach body:

```smarty
{foreach $items as $item}{$item|default:$item@index}{/foreach}
```

The pinned recording compiler reports no error and emits the foreach, `default`
modifier, output, and foreach-close events. The current Tree-sitter grammar
reports an error at the `index` suffix because `loop_metadata_expression` is
not included in `_modifier_argument`. This is a syntax/parser gap; it makes no
claim about runtime item binding or modifier values.

## Scope

Allow a loop-metadata expression as a direct modifier argument. Keep its
existing shape: `loop_metadata_expression` with `item: (variable)` and
`property: (identifier)`. Do not broaden other modifier-argument forms, add a
property-name allowlist, validate the active loop binding, or change ordinary
modifier precedence.

## Acceptance

1. Add the hand-authored expected tree for the source above and a Node check
   that asserts the `modifier_expression` argument is a
   `loop_metadata_expression`, with the item/property fields and source range
   preserved.
2. Add a Smarty-reference check for that fixture. The reference recorder
   verifies syntax/event order only; it does not validate the metadata value or
   runtime loop binding.
3. Retain negative checks for a missing property and whitespace between the
   item and `@`; verify an adjacent valid output and the foreach closer recover.
4. Cover composition with an ordinary modifier argument and chained modifiers
   in the same output. Keep the tree structure explicit.
5. Run the required project gates and record corpus evidence. Any corpus gains
   must be inspected structurally; do not count swallowed syntax as support.

## Exclusions

Other modifier arguments remain governed by the current contract. This task
does not add arbitrary expressions or plugin semantics to modifier arguments,
validate loop properties, or change the grammar's handling of metadata in any
other expression context.
