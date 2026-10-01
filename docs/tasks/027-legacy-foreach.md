# 027 — Standard legacy `{foreach}` headers

Status: complete (independent implementation review accepted on 2026-10-01).
Dependencies: [006 modern foreach blocks](006-foreach-blocks.md),
[012 loop metadata](012-loop-metadata.md), [016 modifier composition](016-loop-metadata-modifier-argument.md),
and [026 for loops](026-for-loops.md). The 006 decision to exclude legacy headers
was a task boundary; Smarty confirms these are standard syntax and they remain in
the project target.

## Motivation and current corpus evidence

The fixed application corpus report `/tmp/smarty-task026-after.json` records
467 files, 455 clean, 12 failing, at grammar SHA-256
`3f46681999d891872d0389516e1a0f98db54f59d912ec064d5cc5ba0dfc9580d`.
The report file SHA-256 is
`a1b17cce6407a57a2c83df2d5a7a9e94a04f718761c247ac6d35f85374c57c9f`.
The input manifest includes the two failure cases below:

| Application path | Source SHA-256 | Failure evidence |
| --- | --- | --- |
| `view_admin/debug/search_debug.tpl` | `20040e710cb57567df0e86f24b8fcce3047632e97358f9342a7e5c034e6083eb` | Line 20, column 25 opens `{foreach from=$debug_types key=type_int item=type_name}`; line 22 reports recovery through `{/foreach}`. |
| `view_labels/cable_label.tpl` | `9044de7a58087d54a9be91e1ef9fbb2394da1e473c84a4ab7426b6d5d57ffcc6` | Lines 59 and 63 contain `{foreach from=$label_types_count key=key item=value}` and its close. An earlier independent error at line 35 starts `{html_options ... options=$heatshrink_printer->get_label...}`; this task does not claim that the file will become clean. |

These are direct source witnesses, not a promised clean-file gain. The current
upstream core corpus also contains a positive nested legacy example: pinned
Smarty v5.8.4 fixture
`tests/UnitTests/TemplateSource/TagTests/Foreach/templates/028_foreach.tpl`,
tracked as `TemplateSource/TagTests/Foreach/templates/028_foreach.tpl` in
`test/upstream-smarty-v5.8.4/manifest.json` (SHA-256
`5d2875d61cebc68405ca707251d6c47948d8616f79200569fa68716373f38e0e`). The
manifest ties it to the successful upstream PHPUnit method
`CompileForeachTest::testForeachNestedNamed_28`. It uses `from`, `item`, `key`, `name`,
and nested legacy loops. Preserve this upstream provenance; the ignored
corpus itself is optional local data.

## Pinned Smarty syntax and compiler boundary

The lockfile pins Smarty v5.8.4 at commit
`94a27cbbc7820198d7adc17a2be8d457fb267753`. In
`vendor/smarty/smarty/src/Parser/TemplateParser.y` (SHA-256
`549769dd1cf7c61dad9909ddcec03cf17c6cf2096611b824e876f2250a1c3189`), the
relevant productions are:

```text
tag ::= LDELFOREACH SPACE expr AS varvar attributes
tag ::= LDELFOREACH SPACE expr AS varvar APTR varvar attributes
tag ::= LDELFOREACH attributes
```

The first two productions define modern source-as-binding headers, with and
without key binding. The third is the legacy entry point: Smarty parses the
same ordinary attribute list used by other tags. Do not infer legacy syntax
from the examples alone or implement it as a generic tag; it is a recognized
built-in block with its own `foreachelse` and close ownership.

`vendor/smarty/smarty/src/Compile/Tag/ForeachTag.php` (SHA-256
`df7714bf3f42aa4bb9d18d06be7b56a0da81a1bad75f02065e3870e37557e21c`) declares
required attributes `from` and `item`, optional attributes `name`, `key`, and
`properties`, and positional short-tag order `from`, `item`, `key`, `name`.
The generic attribute grammar also accepts the `nocache` option; the full
compiler accepts it for foreach, and the designer documentation lists it as a
foreach option flag. Include these standard header forms and options in this
task. Preserve `properties` as syntax; no loop-property/runtime behavior is
claimed. The compiler validates missing required attributes and unknown
attributes after parsing, so do not confuse those compiler validation errors
with parser syntax errors.

The pinned designer documentation
`language-function-foreach.md` (SHA-256
`e2e7feeee03f374af0d3cf6be345b2a0d22e5d171307bb28062061676cc0e4b0`) explicitly
documents the Smarty 2 form `{foreach from=$myarray key="mykey" item="myitem"}`
as still supported, plus the `{foreachelse}` branch. The full compiler accepts
these reduced examples, including the ordinary positional shorthand admitted
by the parser and `shorttag_order`:

```smarty
{foreach from=$items item=item}{$item}{/foreach}
{foreach item="item" from=$items key="key" name="loop"}{$item@key}{foreachelse}empty{/foreach}
{foreach $items item}x{/foreach}
{foreach from=$items item=item key=key name=loop properties="first,last" nocache}x{/foreach}
```

The recording compiler accepts all four and reports tag events, but cannot
inspect attribute values, variable bindings, option semantics, loop execution,
or branch ownership. The focused Node/reference checks must therefore inspect
hand-authored trees, while controlled `fullEngine(..., {mode: 'compile'})`
checks verify selected compiler validation and block-stack behavior.

The empty legacy attribute list is parser-valid too:

```smarty
{foreach}x{/foreach}
```

The recording compiler emits `foreach` and `foreachclose` with no arguments
and no error. Full compilation rejects this with `missing 'from' attribute`.
Tree-sitter should retain the recognized built-in block while representing the
empty attribute list by absence: `foreach_tag` has no
`legacy_foreach_header` child. Do not alias the closing brace or another token
as a synthetic empty-header node.

`{foreachelse}` is the shared empty-loop branch for modern and legacy foreach.
It belongs directly to its foreach block. The pinned compiler rejects an
orphan, duplicate branch, missing foreach close, and crossed ownership. It also
rejects `{foreachelse}` encountered while an inner `{if}` remains open; this
distinguishes direct branch placement from mere source nesting. `{forelse}` is
the distinct `{for}` branch implemented in Task 026. Keep foreach and for
branch nodes separate. `break`/`continue` are independently recognized
standard tags, but their scope/control-flow behavior is a separate gap and is
not bundled here.

## Scope and proposed tree contract

Add a legacy header alternative beneath the already established `foreach_tag`
and preserve the existing `foreach_block`, `foreachelse_clause`, and
`foreach_close_tag` ownership model. Modern header trees from Task 006 must
remain unchanged. The legacy subtree must preserve source order and identify
the distinct syntactic entries so an editor can inspect the declared header:

- When at least one legacy header entry is present, a named
  `legacy_foreach_header` contains named `attribute` nodes in source order.
  Each `attribute` retains generic `name` and `value` fields, so `from`, `item`,
  `key`, `name`, and `properties` stay distinguishable by exact name token and
  value tree. For parser-valid empty `{foreach}`, omit the wrapper entirely;
  there is no zero-child header node.
- Bare positional entries are repeated `argument` fields in source order;
  preserve their full expression/identifier structure rather than assigning
  roles based on eventual compiler normalization. The compiler's positional
  `from,item,key,name` interpretation is a compiler behavior, not a reason to
  reorder syntax children.
- Represent the `nocache` option as an explicit `foreach_option` leaf, preserving
  its source range. It must not be mistaken for an attribute with a value.
- Values remain syntax values. Do not resolve quoted `item`/`key` spellings,
  validate runtime variable bindings, interpret `properties`, or execute a
  loop in the grammar.
- The one optional direct `foreachelse_clause` remains a child of the owning
  `foreach_block` for either header form. Nested modern/legacy foreach, for,
  and if blocks own their own bodies and closes.

Illustrative positive tree for a keyed legacy header and its empty branch:

```smarty
{foreach from=$items key=$key item=$item name="rows"}{$key}:{$item}{foreachelse}empty{/foreach}
```

```text
(source_file
  (foreach_block
    (foreach_tag
      (legacy_foreach_header
        (attribute name: (identifier) value: (variable name: (identifier)))
        (attribute name: (identifier) value: (variable name: (identifier)))
        (attribute name: (identifier) value: (variable name: (identifier)))
        (attribute name: (identifier) value: (string (string_fragment)))))
    (output value: (variable name: (identifier)))
    (text)
    (output value: (variable name: (identifier)))
    (foreachelse_clause (foreachelse_tag) (text))
    (foreach_close_tag)))
```

For `{foreach}x{/foreach}`, retain the built-in block and omit the empty header
node:

```text
(source_file
  (foreach_block
    (foreach_tag)
    (text)
    (foreach_close_tag)))
```

The field contract above illustrates that named header values retain ordinary
expression trees; implementation fixtures should use the actual attribute
spellings in the source and assert exact names, text, ranges, and source order.
Tree-sitter expected trees omit anonymous punctuation as usual.

Also specify a modern+legacy nesting composition, plus foreach nested in `{for}`
and `{for}` nested in foreach. Example:

```smarty
{foreach from=$rows item=row}{foreach $row as $cell}{$cell}{foreachelse}no cells{/foreach}{/foreach}
```

```text
(source_file
  (foreach_block
    (foreach_tag (legacy_foreach_header
      (attribute name: (identifier) value: (variable name: (identifier)))
      (attribute name: (identifier) value: (variable name: (identifier)))))
    (foreach_block
      (foreach_tag source: (variable name: (identifier)) item: (variable name: (identifier)))
      (output value: (variable name: (identifier)))
      (foreachelse_clause (foreachelse_tag) (text))
      (foreach_close_tag))
    (foreach_close_tag)))
```

## Required fixtures and checks

1. Before grammar changes, add manually authored trees and a focused failing
   `test/legacy-foreach.test.mjs`. Include minimal named `from`/`item`, keyed
   attributes with order permutations, quoted static binding values, optional
   `name` and `properties`, `nocache`, positional short-tag order, and the
   manifest's upstream nested legacy shape in minimized neutral form. Include
   modern and legacy loops nested both ways, one direct `foreachelse` for each
   style, and mixed nesting with `{for}` and `{if}`. Do not copy the licensed
   upstream fixture into tracked tests; cite its pinned provenance and retain
   minimized hand-written examples.
2. Add `test/corpus/legacy-foreach.txt` with the header and block trees written
   by hand. Verify field/name/text/source ranges for named attributes, ordered
   positional `argument` children, and the option token. Reference checks via
   `fixtures('legacy-foreach.txt')` should compare only tag/argument-name events;
   they cannot validate attribute values or order semantics beyond visible names.
   Include `{foreach}x{/foreach}` with no `legacy_foreach_header` child under
   `foreach_tag`; assert that the recorder parses it without an error and that
   full compilation fails on the missing required `from` attribute. Do not
   alias `}` or synthesize an empty wrapper to represent the empty list.
3. Cover source syntax error `{foreach from=$items item=}x{/foreach}` (Smarty's
   recorder reports `Unexpected "}"`). Also cover incomplete/open headers and
   preserve following output and a neighboring valid block in the Tree-sitter
   recovery tree. Do not require Tree-sitter parser errors for compiler-only
   invalid forms such as missing required `item` or an unknown `extra` attribute:
   the recorder parses those, while full compilation rejects them as missing or
   unexpected attributes. Distinguish syntax rejection from compiler validation.
4. Use the full compiler to check required attribute validation (`from` and
   `item`), an invalid unknown attribute, one valid `properties`/`nocache`
   combination, and parser-accepted vs compiler-accepted boundaries. Use a
   valid named loop to observe that `name` is retained in the tree; do not test
   `$smarty.foreach` runtime values as parser behavior.
5. Confirm one `foreachelse` is structurally owned by legacy and modern loops.
   Full-compiler cases must cover orphan and duplicate `foreachelse`, missing
   `{/foreach}`, a crossed `{for}`/`{/foreach}` closer, and `{foreachelse}`
   while an inner `if` is still open. Do not rely on the recording compiler to
   reject these; it bypasses block validation. Add negative boundary checks
   proving `{forelse}` belongs only to `for` and `{foreachelse}` does not become a
   foreach alias for other block kinds.
6. Test parser recovery and incremental edits across `from=`, `item=`, `key=`,
   and closing tags. Break and repair a named attribute value and remove/restore
   the owning `{/foreach}`; compare complete incremental snapshots against fresh
   parses and verify adjacent valid output/block nodes survive. Add a focused
   mutation only if exact-field assertions would not otherwise catch flattening
   the legacy header or dropping `item`/`from` identity.
7. Run `npm test`, save before/after application reports outside `build/`, verify
   identical source hashes, inspect regressions, and structurally inspect every
   newly clean application tree. Investigate whether header support alone makes
   `search_debug.tpl` clean; do not count `cable_label.tpl` as expected clean
   while its earlier line 35 error persists. Keep every remaining standard
   syntax failure visible and classify it into a separate task where needed.
8. Update the foreach contract, feature row, task status and evidence only after
   implementation/review gates pass. Preserve the existing Task 006 modern
   header contract and tree shapes; document the legacy extension as additive.

## Scope decisions and known separate gaps

- Include both named legacy attributes and compiler-supported positional
  short-tag syntax from the generic `LDELFOREACH attributes` production. Do not
  restrict the grammar to only the two corpus spellings.
- Include standard compiler-declared optional attributes `name`, `key`, and
  `properties`, and the `nocache` option. The Tree-sitter grammar retains their
  syntax; it does not implement their runtime semantics.
- Unknown plugin attributes may be syntactically retained as attributes but
  remain subject to compiler rejection. Do not imply arbitrary plugin behavior
  is supported.
- This is one bounded task in the project-wide standard syntax target. Confirmed
  standard syntax is not excluded because it is difficult; ordering and task
  decomposition are the only effects of implementation difficulty. Modern
  foreach binding validation/runtime semantics, metadata evaluation, and
  arbitrary iteration values are not parser syntax-tree claims. `break` and
  `continue` syntax/control-flow still require their own task; they remain
  project gaps rather than intentional exclusions.
- The next standard foreach-header task must add attributes/options after modern
  `as` bindings (including `name` and `nocache`) and the valued legacy forms
  `nocache=true` and `nocache=false`. Smarty 5.8.4's recorder and full compiler
  accept these forms, but this task's parser currently rejects them.
- `view_labels/cable_label.tpl:35` has an independent earlier custom-tag
  argument error. Legacy header work is not evidence that this file is clean.

## Brief evidence and review

### Changed existing expectations

Task 006 explicitly left legacy headers out of scope, so its regression checks
expected legacy-shaped headers such as `{foreach from=$items item=item}` to be
Tree-sitter errors. Those expectations are obsolete now that pinned Smarty
confirms `LDELFOREACH attributes` as standard syntax. The focused suite replaces
them with explicit legacy-header trees, source-order argument assertions, and
separate parser/compiler checks. This is an additive project-target correction;
the existing modern header trees remain unchanged.

Pinned Smarty 5.8.4 observations distinguish parsing from compiler validation:
the recording parser and full compiler accept `{foreach $items item}{/foreach}`;
the recording parser accepts `{foreach $items asdf $item}{/foreach}`, while the
full compiler rejects its variable-valued positional key with `key ... illegal
value`; and both parser projections retain `{foreach $items $item}{/foreach}`
as syntax while the full compiler rejects the variable-valued positional item
with `item ... illegal value`. The last two cases must not become Tree-sitter
syntax errors: they demonstrate compiler-only value validation. These checks
are reproduced in `test/foreach.test.mjs` and
`test/legacy-foreach.test.mjs` using the installed recorder and controlled full
engine.

Task-creation evidence is pinned to the current installed package and the
upstream fixture manifest. Source hashes above identify the grammar production,
compiler attribute definitions, and designer documentation used for scope.
Minimal recorder/full-compiler observations can be reproduced through
`reference()` / `fullEngine(..., {mode: 'compile'})` in `test/helpers.mjs`.
The recorder accepts the valid named, shorthand, options, and branch examples,
and exposes legacy entry names/order without values. Full compilation accepts
valid examples and independently rejects malformed syntax, missing required
attributes, unknown attributes, and invalid block ownership as described above.
Neither projection proves Tree-sitter fields; the hand-authored trees are the
structural contract. Independent task-creation review accepted the revised
empty-header absence shape and the Task 027 implementation scope.

## Implementation evidence (independent review accepted 2026-10-01)

- Grammar adds `legacy_foreach_header` under `foreach_tag` for nonempty legacy
  attribute/positional lists, preserves positional `argument` fields in source
  order, exposes `foreach_option` for `nocache`, and gives the modern contextual
  `as` token lexical priority over bare positional identifiers. The empty
  `{foreach}` header parses with `foreach_tag` and no header child because a
  zero-width named repeat node cannot be represented by Tree-sitter.
- Hand-authored trees and `test/legacy-foreach.test.mjs` cover named attributes
  and order permutations, quoted bindings, `name`, `properties`, `key`, the
  `nocache` option, positional entries and source ranges, empty headers, branch
  ownership and mixed modern/legacy/for/if composition. Tests distinguish
  parser/recorder acceptance from full-compiler required-attribute and
  positional-value validation, exercise malformed/incomplete recovery, and
  compare incremental edits against complete fresh snapshots. The incremental
  sequence replaces and restores the exact `from=$items`, `item=$item`, and
  `key=$key` spans, then removes the owning `{/foreach}` and restores it directly
  before the neighboring `{if $after}`. Each edit asserts the exact lookup
  boundary, unchanged source prefix/suffix, expected error state, preserved
  neighboring output and if block, and full snapshot equivalence with a fresh
  parse.
- Existing Task 006 expectations that treated legacy forms as parser errors
  were corrected in `test/foreach.test.mjs`. The pinned recording parser accepts
  `{foreach $items item}` and the full compiler compiles it. The recorder also
  accepts `{foreach $items $item}` and `{foreach $items asdf $item}` as syntax,
  but full compilation rejects the variable-valued positional `item` or `key`
  (`illegal value`). These are syntax trees with compiler-level value failures,
  not Tree-sitter errors. `test/foreach.test.mjs` and this brief record the
  changed expectation and the exact distinction.
- Focused command `node --test test/legacy-foreach.test.mjs test/foreach.test.mjs`:
  **20 tests passed, 0 failed**. `npx tree-sitter test`: **235 expected trees
  passed, 0 failed**. Required acceptance command `npm test`: **exit 0**, grammar
  typecheck passed, **235/235 Tree-sitter parses**, **332/332 Node checks**, and
  all **16 deliberate mutations were caught**.
- Application reports used the same 467 source files and matching per-file
  hashes. Before: `/tmp/smarty-task027-before.json`, SHA-256
  `a1b17cce6407a57a2c83df2d5a7a9e94a04f718761c247ac6d35f85374c57c9f`, 455
  clean / 12 failing, grammar SHA-256
  `3f46681999d891872d0389516e1a0f98db54f59d912ec064d5cc5ba0dfc9580d`. After:
  `/tmp/smarty-task027-after-report.json`, SHA-256
  `01bb239f8c3d0cd63e9510469538e97ee75fd1863085a3bd8eed3b4072922dc0`, 456
  clean / 11 failing, grammar SHA-256
  `d8fcfa7802d9bd785a2be2713e1baaac85bc2831ae29920b51da14129b69ddd7`. There
  was one gain and no regression: `view_admin/debug/search_debug.tpl` (source
  SHA-256 `20040e710cb57567df0e86f24b8fcce3047632e97358f9342a7e5c034e6083eb`)
  now parses without errors. Its reviewed loop tree retains distinct source-
  ordered `from`, `key`, and `item` attributes, body text/output/if structure,
  and its own close tag. `view_labels/cable_label.tpl` remains failing on the
  earlier unrelated custom-tag argument at line 35. The other 10 failing files
  remain visible in the local report as unresolved work for subsequent tasks.
- Independent task-creation review accepted the brief on 2026-10-01, including
  the empty-header absence representation. Independent implementation review
  accepted the grammar, trees, compiler distinctions, recovery/composition/edit
  checks, and corpus evidence on 2026-10-01. `git diff --check` passed. No
  existing Tree-sitter expected tree was changed; the old Node assertions that
  treated legacy headers as syntax errors were corrected as described above.
