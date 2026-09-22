# 006 — Modern foreach blocks

Status: ready; not implemented. Dependencies: 004–005 for composition fixtures.

## Scope and motivation

Recognize structurally nested modern loops with a supported source expression,
a simple variable binding, optional key binding, and at most one `foreachelse`:

```smarty
{foreach $items as $item}{$item}{/foreach}
{foreach $items as $key => $item}{$key}{$item}{/foreach}
{foreach $items as $item}{$item}{foreachelse}Empty{/foreach}
```

`corpus/toolbar.tpl:5-16` supplies a method-call source and a loop body containing
outputs, modifiers and comments. Reduce it to neutral identifiers. Key binding
and `foreachelse` are reference-backed synthetic cases; no local provenance is
claimed for those forms. The initial lexical report found `foreach` in 244
failing files, which is not a prediction of how many this task will clear.

Exclude legacy `{foreach from=... item=...}` headers, extra header attributes,
loop metadata (`$item@index`, `$smarty.foreach...`), `break`/`continue` semantics,
destructuring, dynamic bindings, by-reference bindings and runtime iteration
validation. Existing generic acceptance of other names does not confer built-in
semantics. Do not add generic custom-block pairing or application allowlists.

## Proposed tree contract

Add `foreach_block`, `foreach_tag`, `foreachelse_clause`, `foreachelse_tag`, and
`foreach_close_tag`, following the existing if-block structure:

- `foreach_tag` fields: `source` (supported expression), optional `key`
  (simple `variable`), and `item` (simple `variable`). Source order remains
  `source`, `key`, `item` when a key is present.
- Body nodes are direct block children after the opening tag.
- Optional `foreachelse_clause` contains its opening tag and body nodes.
- Every block ends with `foreach_close_tag`; nested if/foreach blocks retain
  their own branch ownership and close tags.

```text
{foreach $items as $key => $item}{$item}{foreachelse}Empty{/foreach}
(source_file
  (foreach_block
    (foreach_tag
      source: (variable name: (identifier))
      key: (variable name: (identifier))
      item: (variable name: (identifier)))
    (output value: (variable name: (identifier)))
    (foreachelse_clause (foreachelse_tag) (text))
    (foreach_close_tag)))
```

Reserve `foreach` and `foreachelse` in control-tag positions so incomplete or
excluded headers cannot fall back to generic tags. Preserve ordinary property/
method names, variables and identifiers such as `foreach_widget`. Treat `as`
as a contextual header keyword, not a globally forbidden custom-tag name.

## Reference observations (Smarty 5.8.4, 2026-09-22)

The recorder accepts all three examples above and rejects a bare binding in
`{foreach $items as item}x{/foreach}`. Inspect `LDELFOREACH ... AS` productions
and the foreach/foreachelse/foreachclose compiler classes before implementation.
Legacy attribute headers are valid Smarty but deliberately excluded here.

Projection detail: the recorder normalizes source to argument name `from` and
emits `from`, `item`, then `key` for a key/item header, **not source order**.
Extend `observations()` to emit matching foreach events and ordinary body events;
assert the different source order with exact trees rather than changing the
recorder to resemble Tree-sitter. Branch/close events are named `foreachelse` and
`foreachclose`, with no arguments for this subset.

The adapter bypasses block validation: `{foreachelse}` and an unclosed
`{foreach $items as $item}` both produce no adapter error. A separate full Smarty
`compileTemplateSource()` observation rejects them as unexpected closing tag and
unclosed foreach respectively. It also rejects duplicate `foreachelse` clauses.
Preserve this distinction in tests. Use a small full-compiler helper for these
controlled templates, temporary compile output and no runtime application data;
do not claim the existing recorder proves pairing.

## Acceptance work

1. Add manually specified `test/corpus/foreach.txt` trees and failing checks before
   implementation. Cover simple/keyed loops, empty bodies, optional empty branch,
   nested loops, if inside foreach and foreach inside if/else. Include a method
   source, a condition from 005, configs, comments and unknown opening/closing
   tags that stay independent inside the body.
2. Opt fixtures into a dedicated reference test and extend the event projection
   as described. Verify source/key/item ranges and types; unknown argument
   expressions must keep full detail. Add a minimized toolbar fixture.
3. Verify header whitespace, `as` token boundaries and `=>` against Smarty.
   `foreach_widget` and `{as}` must retain generic-tag behavior; keyword-named
   properties/methods must keep the behavior established by earlier tasks.
4. Require errors for missing `as`/binding/source, dangling `=>`, missing close,
   standalone/duplicate `foreachelse`, misplaced branches and crossed if/foreach
   closes. Check legacy/extra-attribute headers cannot escape as generic tags.
   Document which failures are subset exclusions, parser syntax errors, or
   full-compiler block errors. Never assert the recorder rejects unclosed loops.
5. Delete/restore `{/foreach}` in a nested composed template and edit a binding
   across `=>`. Compare full incremental/fresh snapshots, including recovery and
   valid neighboring outputs. Add a mutation that loses the `source`/`item` field
   or flattens the block and demonstrate the manual fixture catches it.
6. Run `npm test` and before/after reports saved outside `build/`. Match corpus
   hashes, inspect every newly failing previously clean file, and review loop
   structure in newly clean ones. Newly reserved legacy headers may expose
   earlier generic over-acceptance: document any such correction with a minimal
   example instead of restoring a broad fallback.
7. Update the contract, feature inventory, task status and evidence. If existing
   generic foreach trees exist, explain their explicit structural replacement;
   never auto-update expectations or claim all built-in blocks are supported.

## Completion evidence (fill when implemented)

Tree/reference/full-compiler/edit/mutation links; projection ordering checks;
commands/results; hash-matched corpus comparison and minimized provenance;
changed generic expectations if any; remaining legacy/metadata exclusions.
