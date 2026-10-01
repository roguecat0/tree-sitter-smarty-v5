# 028 — Modern foreach header options and valued `nocache`

Status: complete (2026-10-02; implementation accepted by independent review). Additive follow-up to [027 legacy foreach headers](027-legacy-foreach.md); also depends on [006 modern foreach blocks](006-foreach-blocks.md), [012 loop metadata](012-loop-metadata.md), and [016 modifier composition](016-loop-metadata-modifier-argument.md).

## Motivation and current corpus evidence

Task 027 structurally supports legacy headers and their bare `nocache` flag, and the current grammar preserves modern `source`, optional `key`, and `item` fields. Two remaining standard forms are absent: attributes/options after a modern `as` binding, and boolean-valued `nocache` in legacy headers. Pinned Smarty parser/compiler sources confirm them.

Keep all three local corpus roots and their reports separate. The baselines
below use the same parser SHA-256
`d8fcfa7802d9bd785a2be2713e1baaac85bc2831ae29920b51da14129b69ddd7`; never
add their counts together:

| Root | Baseline report | Report SHA-256 | Files | Clean / errors |
| --- | --- | --- | ---: | ---: |
| `corpus/application/` | `/tmp/smarty-task028-followup-before-application.json` | `01bb239f8c3d0cd63e9510469538e97ee75fd1863085a3bd8eed3b4072922dc0` | 467 | 456 / 11 |
| `corpus/upstream-smarty-v5.8.4-core/` | `/tmp/smarty-task028-followup-before-core.json` | `9c2514171c331a71b4e905e2ab6c245753adf3868a134d5028e41cdc1d3459bb` | 33 | 24 / 9 |
| `corpus/upstream-smarty-v5.8.4-example/` | `/tmp/smarty-task028-followup-before-example.json` | `ec674263505b04547e5f3db5bb3e982feb8e62c9a301ed28c5e3387e71455823` | 1 | 0 / 1 |

A source scan found no modern foreach header with trailing `name`, `key`,
`properties`, or `nocache` options in the 467-file application corpus. The
upstream core corpus also contains legacy/nested foreach fixtures
`027_foreach.tpl` and `028_foreach.tpl`. Their first reported parse error begins
at the assignment (`{$x = ...}`) on source line 2; the preceding `{strip}` on
line 1 is accepted as a generic tag, which is not evidence of structural
`strip` support. This task is not expected to make those whole files clean. The
official positive 025/026 option
fixtures cited below are not members of the selected 33-file tracked manifest
corpus. These are still required standard-syntax tests; do not combine corpus
counts or promise a whole-file clean gain. Re-run and hash-match each report
during implementation because the shared grammar is under active task work.

The official Smarty v5.8.4 source tests include two minimal modern examples:

- `tests/UnitTests/TemplateSource/TagTests/Foreach/templates/025_foreach.tpl`
  contains `{foreach $foo as $x nocache}{$x} {/foreach}` (blob
  `fe5193af3ac7494b01966f0155cb94d8ddafe371`, SHA-256
  `f85427e3a7f164b5a5add358062e640eb9f83486385629a9384b4d50e2439e96`);
  `CompileForeachTest::testForeachNocacheTag1_025` exercises it.
- `tests/UnitTests/TemplateSource/TagTests/Foreach/templates/026_foreach.tpl`
  contains `{foreach $foo as $x name=bar}{$x} {/foreach}` (blob
  `9a2b698be0e5f5e1d1e0b52ea07db0b97d75b019`, SHA-256
  `ee27c7ce9597414b6a15a962dc93051f1098bd55d5e5d1f5b8c8eb1ee07d69a4`);
  `CompileForeachTest::testForeachCache1_26` exercises it.

Both methods are in `tests/UnitTests/TemplateSource/TagTests/Foreach/CompileForeachTest.php`
(blob `7370de5b787c9999061ddd4f2f0b4ae106dd2507`, SHA-256
`7fe2ebd95f451a38126cb53b82e77d809281813d1d47877e49e1c1978b5b69da`).

These official source fixtures are pinned evidence, not dependencies of public
tests. They are not currently entries in the tracked upstream manifest. Do not
copy upstream templates into tracked tests; add minimized, hand-authored local
trees.

## Pinned parser/compiler evidence and exact accepted set

The project pins Smarty v5.8.4, commit
`94a27cbbc7820198d7adc17a2be8d457fb267753`. Relevant sources and hashes:

- `vendor/smarty/smarty/src/Parser/TemplateParser.y`, SHA-256
  `549769dd1cf7c61dad9909ddcec03cf17c6cf2096611b824e876f2250a1c3189`.
  Both modern productions include trailing attributes:
  `LDELFOREACH SPACE expr AS varvar attributes` and the keyed variant with
  `APTR varvar attributes`. The legacy production is
  `LDELFOREACH attributes`. Generic attributes accept a named attribute with
  an expression/value or a bare identifier option.
- `vendor/smarty/smarty/src/Compile/Tag/ForeachTag.php`, SHA-256
  `df7714bf3f42aa4bb9d18d06be7b56a0da81a1bad75f02065e3870e37557e21c`.
  It requires `from,item`, declares optional `name,key,properties`, and
  inherits the `nocache` option flag from `Compile\\Base`.
- `vendor/smarty/smarty/src/Compile/AttributeCompiler.php`, SHA-256
  `eaee4170ab6147b6e5c2f83af9ff42834a1b1a26716b4cf593da7e448e4c55fc`.
  It normalizes a named `nocache` option value through the exact map
  `true/false/1/0`; values are strings trimmed of surrounding quotes before
  lookup. Thus `true`, `false`, `1`, `0`, and their single-/double-quoted
  string spellings compile. These values are not case-insensitive: `TRUE`,
  `False`, `yes`, or a variable value do not compile. Bare `nocache` is the
  option flag and means true to the compiler. Parser acceptance alone does not
  prove that the compiler accepts a flag value.
- The pinned designer page
  `language-function-foreach.md` (SHA-256
  `e2e7feeee03f374af0d3cf6be345b2a0d22e5d171307bb28062061676cc0e4b0`) lists
  `nocache` as a foreach option but says modern `as` syntax does not accept
  named attributes. This prose conflicts with the pinned parser production
  and executable compiler: the minimal modern `name=bar` fixture above parses
  and full-compiles, as do modern `key` and `properties` attributes. Record
  the discrepancy rather than treating the stale prose as a Smarty rejection.

The exact compiler-declared attribute/option set for the task is: modern source
and item (plus optional key) are synthesized by the modern header; trailing
`name`, `key`, and `properties` attributes are accepted, as are redundant
trailing `from` and `item` attributes. Keep the synthesized `source`/`item`
fields and the additional named `attribute` children as distinct syntax: the
attribute children follow them in physical source order and do not replace
those fields. The compiler accepts the redundant names, but this task does not
assign runtime meaning or add duplicate-attribute validation. `nocache` may
appear as a bare option or as a named boolean option with `true`, `false`, `1`,
or `0` (quoted or unquoted). The same `nocache` values are accepted in legacy
attribute headers. Preserve names and values structurally. Do not infer
cache/runtime behavior, loop-binding validity, or property-list behavior from
compilation alone. Other unknown attribute names may be parser-accepted, but the
full compiler rejects them; they are not part of the compiler-supported set
and do not acquire plugin semantics.

I reproduced the following with `reference()` and
`fullEngine(source, {mode: 'compile'})` on the pinned package:

| Minimal source | Recorder | Full compiler |
| --- | --- | --- |
| `{foreach $items as $item name="loop"}{/foreach}` | accepts; emits `name,from,item` argument names | accepts |
| `{foreach $items as $item nocache}{/foreach}` | accepts; emits unnamed option then `from,item` | accepts |
| `{foreach $items as $item key="k" properties="first,last" nocache}{/foreach}` | accepts; reports named args and unnamed option | accepts |
| `{foreach $items as $item from=$other item=$otherItem}{/foreach}` | accepts; emits trailing `from,item` before synthesized `from,item` | accepts |
| `{foreach $items as $item item=$otherItem from=$other}{/foreach}` | accepts; emits trailing `item,from` before synthesized `from,item` | accepts |
| `{foreach from=$items item=item nocache=true}{/foreach}` | accepts; reports `from,item,nocache` | accepts |
| `{foreach from=$items item=item nocache=false}{/foreach}` | accepts; reports `from,item,nocache` | accepts |
| `{foreach from=$items item=item nocache=1}{/foreach}` / `nocache=0` | accepts | accepts |
| `{foreach from=$items item=item nocache=yes}{/foreach}` | accepts syntactically | rejects: illegal value for option flag |
| `{foreach from=$items item=item nocache=$flag}{/foreach}` | accepts syntactically | rejects: illegal value for option flag |
| `{foreach from=$items item=item nocache=}{/foreach}` | rejects: unexpected closing brace | rejects parser syntax |

The recorder only exposes ordered argument names/counts; it cannot inspect
attribute/option values, the Tree-sitter fields, cache behavior, or runtime
loop values. Explicit trees and focused Node checks are the structure contract.
Use full compile checks to distinguish parser-valid/compiler-invalid option
values. Do not claim the recorder rejects a compiler-only invalid value.

## Scope and proposed tree contract

This task adds ordinary trailing attributes/options to modern foreach and adds
valued `nocache` attributes to both modern and legacy header trees. Keep
Task 027's empty legacy shape (`foreach_tag` with no `legacy_foreach_header`
child) and nonempty legacy wrapper unchanged.

For modern form, retain current `foreach_tag` fields `source`, optional
`key`, and `item`; after these children, retain trailing `attribute` and
`foreach_option` nodes in their lexical source order. Do not wrap modern
trailing options in `legacy_foreach_header`. For legacy form, keep the
`legacy_foreach_header` wrapper and its source-ordered entries. A bare
`nocache` remains a `foreach_option` leaf. A valued `nocache=...` is an
ordinary `attribute` node with `name: (identifier)` and a `value` retaining
its existing type (boolean, number, string, variable, etc.); compiler validation
does not flatten or erase its source structure.

Redundant modern `from` and `item` attributes remain visible after the
synthesized binding fields, in their actual lexical order:

```smarty
{foreach $items as $item item=$otherItem from=$other}{/foreach}
```

```text
(source_file
  (foreach_block
    (foreach_tag
      source: (variable name: (identifier))
      item: (variable name: (identifier))
      (attribute name: (identifier) value: (variable name: (identifier)))
      (attribute name: (identifier) value: (variable name: (identifier))))
    (foreach_close_tag)))
```

The attributes' name fields identify `item` then `from`; they do not overwrite
the `item` and `source` fields. No duplicate-attribute winner or runtime
binding behavior is part of this tree contract.

Illustrative modern tree with a named attribute and bare option:

```smarty
{foreach $items as $item name="rows" nocache}{$item}{/foreach}
```

```text
(source_file
  (foreach_block
    (foreach_tag
      source: (variable name: (identifier))
      item: (variable name: (identifier))
      (attribute name: (identifier) value: (string (string_fragment)))
      (foreach_option))
    (output value: (variable name: (identifier)))
    (foreach_close_tag)))
```

Illustrative keyed modern ordering and a false-valued legacy option:

```smarty
{foreach $items as $key => $item properties="first,last" nocache="false"}{$item}{/foreach}
{foreach from=$items item=$item nocache=false}{$item}{/foreach}
```

```text
(source_file
  (foreach_block
    (foreach_tag
      source: (variable name: (identifier))
      key: (variable name: (identifier))
      item: (variable name: (identifier))
      (attribute name: (identifier) value: (string (string_fragment)))
      (attribute name: (identifier) value: (string (string_fragment))))
    (output value: (variable name: (identifier)))
    (foreach_close_tag))
  (foreach_block
    (foreach_tag
      (legacy_foreach_header
        (attribute name: (identifier) value: (variable name: (identifier)))
        (attribute name: (identifier) value: (variable name: (identifier)))
        (attribute name: (identifier) value: (boolean)))
    (output value: (variable name: (identifier)))
    (foreach_close_tag)))
```

Fixture source order is the public Tree-sitter contract. Smarty's recorder
orders modern header events differently because its parser compiles trailing
attributes before appending normalized `from,item,key` arguments. Extend
`observations()` to emit modern trailing attribute/option events first in
their physical source order, followed by normalized `from,item,key`; retain
the existing source-order-vs-recorder distinction for the tree. Legacy recorder
events retain parsed attribute order. Assert exact field names, values, and
UTF-16 source ranges in Node checks; reference comparison covers only the
observable argument names/order.

Keep expression composition bounded but representative: attach options to a
modern method-call source, cover a modern keyed header with multiple trailing
entries and an optional `foreachelse`, and nest a legacy valued-option loop in
a modern one (and vice versa) so the trailing-entry boundary is checked without
breaking block/branch ownership. Existing modifier and loop-metadata trees
remain unchanged.

## Required fixtures and checks

1. Before grammar changes, add hand-authored trees in
   `test/corpus/foreach-header-options.txt` and a failing
   `test/foreach-header-options.test.mjs`. Cover modern `name`, `key`, and
   `properties` attributes, bare `nocache`, modern/legacy valued option
   `true,false,1,0` in unquoted and quoted forms, and a combined modern header.
   Assert named/unnamed node kinds, original spelling/value node type, physical
   source order, exact field text and ranges. Include a direct empty branch and
   mixed modern/legacy nesting.
2. Use `fixtures('foreach-header-options.txt')` for recorder comparisons. Extend
   `observations()` so modern attribute/option events precede normalized
   `from,item,key` in the event projection, as observed. Do not assert that
   these event names prove option values or cache effects.
3. Keep compiler validation distinct from parse syntax. Trees for `nocache=yes`,
   `nocache=TRUE`, and `nocache=$flag` should preserve the parser-accepted
   attribute/value structure without Tree-sitter errors; full-engine compile
   checks must show their option validation rejection. Check `nocache=` as a
   parser syntax error and preserve a later independent output/closer after
   recovery. Verify at least one unexpected named attribute similarly remains
   structurally visible while full compile rejects it as not declared.
4. Test modern option/attribute boundary directly against the pinned full
   compiler because designer prose conflicts. Check `name`, `key`,
   `properties`, redundant trailing `from` and `item`, bare `nocache`, and a
   valid valued option. Assert that trailing `from`/`item` remain ordinary
   source-ordered `attribute` children after synthesized `source`/`item` fields;
   recorder events list those attributes before synthesized `from,item`.
   Do not turn that minimal compile evidence into runtime caching or loop
   semantics claims.
5. Compose modern attributes with a supported method-call source, a key binding,
   an output modifier/metadata expression, `foreachelse`, and a nested legacy
   option loop. Tests need only selected combinations, not a Cartesian product.
6. Add an edit crossing the boundary: insert/delete `name="rows"` and change
   `nocache=true` to incomplete `nocache=` and back. Compare complete
   incremental snapshots to fresh parses through error and repair and assert
   neighboring outputs and the foreach closer remain navigable. A focused
   mutation should target loss/flattening of a trailing attribute or value only
   if exact tree and field checks would not catch that failure mode.
7. Run `npm test`. Save separate before/after JSON reports outside `build/` for
   `corpus/application/`, `corpus/upstream-smarty-v5.8.4-core/`, and
   `corpus/upstream-smarty-v5.8.4-example/`, using explicit roots for both
   upstream reports. Match each root's source hashes independently, inspect
   regressions, and structurally inspect every newly clean file. Keep the three
   root counts and report hashes separate in the completion report; never
   combine them. Baselines are application 456/467 clean, core 24/33 clean, and
   example 0/1 clean. The core foreach files 027/028 currently first fail at
   the assignment on line 2 after generic acceptance of `{strip}`, and the
   application scan found no direct modern trailing-option instances, so do not
   promise a corpus gain or treat absent examples as a reason to exclude
   confirmed standard syntax. Report all three after counts,
   source-hash comparisons, newly clean tree inspections, and remaining errors.
8. Update contract, foreach feature row, this task's status and evidence only
   after implementation and independent review acceptance. Correct the modern
   foreach subset additively; preserve all modern/legacy header tree contracts
   from Tasks 006 and 027, including the empty legacy header shape.

## Scope and project-target decisions

- Task 028 is the next bounded extension, not the outer limit of foreach syntax.
  All syntax confirmed standard in pinned Smarty remains a project target
  regardless of implementation difficulty; difficulty changes scheduling and
  decomposition only.
- Include all compiler-declared standard optional attributes for modern headers
  (`name`, `key`, `properties`) and all accepted `nocache` values. Do not
  narrow to just the two immediate corpus/brief witnesses.
- Preserve parser-accepted unknown named attributes as syntax structure, but do
  not imply the compiler accepts them or implement plugin behavior.
- The option value list is compiler-validated. Tree-sitter should retain its
  ordinary expression/value tree even when Smarty rejects its value.
- Cache behavior, loop execution, binding/value semantics, and `properties`
  runtime meaning are outside structural parser claims. Other standard foreach
  syntax gaps must remain separately visible and queued.

## Brief evidence and review

Creation observations use locked Smarty v5.8.4 in `vendor/smarty/smarty`.
Pinned source hashes and upstream source paths/blobs above make the behavior
reproducible. Exact reference/full-engine checks listed in the brief were
run locally through `test/helpers.mjs`; the syntax recorder returned no error
for accepted forms and for parser-valid invalid-option forms, and full
compilation accepted/rejected the cases shown in the table. Independent task
creation review accepted the option set, separate corpus reports, proposed tree
contract, and modern-doc discrepancy on 2026-10-01.

## Implementation evidence (2026-10-02; independent review accepted)

The implementation extends modern headers with direct, source-ordered
`attribute` and `foreach_option` children after the synthesized `source`,
optional `key`, and `item` fields. Valued `nocache` is represented as an
ordinary named `attribute` in both modern and legacy headers; bare `nocache`
remains a `foreach_option`. Hand-authored trees cover modern `name`, `key`,
`properties`, redundant `from`/`item`, quoted/unquoted `true`/`false`/`1`/`0`,
compiler-invalid values that remain parser syntax, method-call sources,
`foreachelse`, both nesting directions, and an edit through incomplete syntax.
The tests check node kinds, fields, source order, exact UTF-16 ranges, recorder
event ordering, full-compiler validation boundaries, recovery, and incremental
snapshots. Unknown named options retain their attribute tree while the compiler
rejects the unsupported name.

The stale Task 006 assertion that modern `name="loop"` was malformed was
removed from its malformed-input list. The pinned parser production includes
trailing attributes, and the pinned compiler accepts `{foreach $items as $item
name="rows"}{/foreach}`; the positive full-compiler check is in
`test/foreach-header-options.test.mjs`. This corrects a parser expectation and
does not claim runtime loop/cache semantics.

`npm test` passes: 244 hand-authored corpus trees, 348 Node checks, and all 16
deliberate mutation checks were reported successful. The three reports remain
separate and use the same after-parser SHA-256
`642a756e6e4ae968c63ac83bdd9043965dc33b5a59a9409c489532370d32b0a9`:
The before/after JSON files are preserved outside `build/` under
`/tmp/smarty-task028-followup-{before,after}-{application,core,example}.json`.

| Root | Before report SHA-256 | After report SHA-256 | Before → after clean | Source hashes | Newly clean files |
| --- | --- | --- | ---: | --- | --- |
| `corpus/application/` | `01bb239f8c3d0cd63e9510469538e97ee75fd1863085a3bd8eed3b4072922dc0` | `b093ea9802261bc169c4674f0dfa5a7e16bd5a7a7e1b75e4ea000a39027bd325` | 456/467 → 456/467 | 467/467 unchanged | none |
| `corpus/upstream-smarty-v5.8.4-core/` | `9c2514171c331a71b4e905e2ab6c245753adf3868a134d5028e41cdc1d3459bb` | `604d9127b0e30b664bf14bdbc45e34477a066911db2668f38b91fcd814afe4c2` | 24/33 → 24/33 | 33/33 unchanged | none |
| `corpus/upstream-smarty-v5.8.4-example/` | `ec674263505b04547e5f3db5bb3e982feb8e62c9a301ed28c5e3387e71455823` | `7bd505f87a0fc30f90a62a8ee0f37e67aa16f9871a65867a5638bd83e7d4ec25` | 0/1 → 0/1 | 1/1 unchanged | none |

No corpus files became clean, so there are no new clean-file trees to inspect.
The upstream core foreach files 027/028 still first fail at their line-2
assignment as described above. Independent implementation review accepted
this task on 2026-10-02. The reviewer also reported
six transient C-style `for` corpus mismatches during the temporary baseline
parser swap. After restoring the final generated parser, the same reviewer
verified the full corpus at 244/244 and `npm test` at 348/348 Node checks with
all 16 mutation checks caught; the focused for-loop corpus also passed 11/11.
No old expectations were changed for that transient result.
