# 016 — Loop metadata as a modifier argument

Status: implementation. Task-creation reviewer accepted the brief on 2026-10-01
after requiring a concrete composition tree,
malformed modifier-context cases, and incremental edits across `@index`.
Dependencies: Task 012 loop
metadata and Task 015's composition audit. The former priority deferral is
resolved: Task 024 has added a pinned, separately reported upstream Smarty
syntax corpus, and the orchestrator has resumed this task after that corpus
became reviewable. The exact composition remains project-owned because it is
not present in the selected upstream sources.

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

Task 024's auxiliary corpus adds context but does not replace the minimized
proof above. Its selected upstream fixtures include separate foreach-metadata
examples and ordinary modifier examples, but no direct loop-metadata modifier
argument. In the materialized corpus, the nested-metadata fixture
`TemplateSource/TagTests/Foreach/templates/027_foreach.tpl` also exercises
metadata in nested loops, while its parse report errors at the surrounding
`{strip}` construct; other clean metadata fixtures were structurally inspected.
These files establish useful neighboring syntax and parser-completeness
context, not support or upstream validation of the exact composition. Keep the
Task 015 minimized Smarty 5.8.4 observation and its explicit Tree-sitter
expectation as this task's direct evidence. See [Task 024](024-upstream-core-syntax-corpus.md)
for corpus provenance, report hashes, and limitations.

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
3. Add this same-output composition fixture, including its explicit tree shape:

   ```smarty
   {foreach $items as $item}{$item|default:$fallback:$item@index|escape}{/foreach}
   ```

   Expected named structure (write the actual corpus expectation in standard
   Tree-sitter form, with all punctuation/ranges represented by the parser):

   ```text
   (source_file
     (foreach_block
       (foreach_tag source: (variable name: (identifier)) item: (variable name: (identifier)))
       (output value:
         (modifier_expression
           value: (modifier_expression
             value: (variable name: (identifier))
             name: (identifier)
             argument: (variable name: (identifier))
             argument: (loop_metadata_expression item: (variable name: (identifier)) property: (identifier)))
           name: (identifier)))
       (foreach_close_tag)))
   ```

   This checks an ordinary variable argument and the metadata argument on
   `default`, then a chained `escape` modifier around that result. Confirm the
   pinned reference event sequence is `foreach`, `default` with 2 arguments,
   `escape` with 0 arguments, `output`, and `foreachclose`, with no error. The
   recorder confirms syntax and event counts only; the tree is the structural
   contract.
4. Add malformed fixtures in the modifier-argument context, each followed by
   an independent valid output and the enclosing foreach closer:

   ```smarty
   {foreach $items as $item}{$item|default:$fallback:$item@}{$after}{/foreach}
   {foreach $items as $item}{$item|default:$fallback:$item @index}{$after}{/foreach}
   ```

   For both fixtures, assert the pinned Smarty reference reports an error (the
   missing-property case expects an identifier after `@`; the spaced case
   rejects `@` after the separated variable). In Tree-sitter, assert an error
   at the malformed metadata argument while retaining the following `$after`
   output and `foreach_close_tag` as distinct nodes. These are syntax and
   recovery checks, not an attempt to accept either malformed form.
5. Add an edit check starting from the valid same-output composition. Remove
   and restore the complete `@index` suffix inside the `default` modifier
   argument, and compare the full incremental `snapshot()` with a fresh parse
   after each edit. The suffix-free intermediate must be represented as the
   ordinary `$item` argument; the restored snapshot must again contain the
   `loop_metadata_expression` and match the original tree. Also delete only
   `index` to create the incomplete `$item@` form, assert the incremental tree
   retains an error and following output/foreach closer, then restore `index`
   and require the recovered full snapshot to match a fresh parse. This covers
   both boundary transitions and recovery without comparing Tree-sitter node
   identity or `hasChanges` metadata.
6. Keep the direct minimized fixture from Motivation as an independent focused
   case, and keep ordinary modifier arguments and chained modifiers explicit
   in the trees/checks. Run the required project gates and record corpus
   evidence. Any corpus gains
   must be inspected structurally; do not count swallowed syntax as support.

## Exclusions

Other modifier arguments remain governed by the current contract. This task
does not add arbitrary expressions or plugin semantics to modifier arguments,
validate loop properties, or change the grammar's handling of metadata in any
other expression context.

## Brief-review revision response

- **Same-output composition:** Added a concrete output combining ordinary and
  loop-metadata arguments to `default`, followed by chained `escape`, plus its
  intended nested `modifier_expression` tree and pinned recorder event shape.
- **Malformed modifier arguments:** Moved missing-property and whitespace
  cases into modifier arguments; required pinned-reference rejection and
  Tree-sitter recovery of the adjacent output and foreach closer.
- **Incremental boundary/recovery:** Required remove/restore edits for `@index`,
  full snapshots compared with fresh parses at each stage, and an incomplete
  `$item@` intermediate that must recover when `index` is restored.

## Implementation evidence

Status: **complete**. Independent implementation review accepted on
2026-10-01 after requiring executable source-range assertions for the direct
metadata node, item variable, and property identifier. The reviewer reproduced
the checks and found no remaining issues.
The grammar change adds `loop_metadata_expression` only to
`_modifier_argument`; it keeps the existing item/property fields and does not
broaden other modifier arguments. The two manually written corpus trees cover
the minimized direct argument and the same-output `default` arguments followed
by `escape`. The direct-fixture Node check asserts exact ranges for the
`loop_metadata_expression`, item variable and property identifier; both valid
fixture checks compare against Smarty 5.8.4 recorder events.
The recorder confirms syntax and event sequence/counts only, not argument
values or runtime binding. Two malformed modifier-argument checks require
Smarty rejection and retain the following `$after` output and foreach closer
in Tree-sitter recovery. The edit check removes/restores `@index`, then removes
and restores only `index`; every incremental full snapshot matches a fresh
parse, and the incomplete state retains the following output and closer.

Failing-first evidence: before the grammar change, the expected direct and
composition trees both failed because the parser ended the output after the
plain `$item` modifier argument and reported the metadata suffix as an error.
After implementation, `npm test` exited 0: 221 expected trees, 306 Node checks,
and all 14 deliberate grammar mutations were caught. The exact full output is
`/tmp/smarty-016-npm-test.log`. `git diff --check` passed. `grammar.js` SHA-256
is `7be93e55730e9256245a89955c0f40d25e220e2586b0c6ebc4c9c7614de2378d` at
workspace revision `c5a52804129d2e006e8086954d38144fc81278a6` (uncommitted task
work).

Application corpus commands were `npm run corpus:report -- ./corpus
/tmp/smarty-016-before.json` before the grammar edit and
`npm run corpus:report -- ./corpus /tmp/smarty-016-after.json` afterward. Both
reports covered the same 467 files with identical input path/SHA-256 pairs.
Before and after results are 449 parse-clean and 18 failing. Their generated
grammar hashes were `04cafb5d5214b5de784cb156a80d55adf69f92ff7a8f24dec7194d9bbdf27255`
and `c1cb194d78c7fb8bfe535e33e89c248ee84377a15d59fe0772c958fca0a9fb4a`,
respectively. There are no newly clean or newly failing files, so this change
has no application-corpus gain or regression to structurally promote. The fixed remaining failures are listed in the reports; leading
examples include `{for}`, `break`/`continue`, `isset(...)`, comparisons/config
variables, dot access, and literal blocks. Those are not attributed to this
modifier-argument change. The local report files remain outside the repository
at `/tmp/smarty-016-before.json` and `/tmp/smarty-016-after.json`.

Deviation: none. No scanner, reference adapter, expected-tree mutation, or
additional modifier-argument form changed.
