# 030 — Classic section blocks and section-name indices

**Status:** complete (2026-10-02). Independent completion review accepted after resolving the bare short-header fixture and numeric wrapper/value range assertions. Brief independently accepted (2026-10-02): short and long headers share an explicit `section_header` shape with `name`/`loop` fields, and both bare and option-bearing short forms have manually specified trees.  
**Type:** standard Smarty 5 syntax and tree structure.  
**Depends on:** [007 index access](007-index-access.md), [008 primitive literals](008-primitive-literals.md), [015 composition audit](015-composition-audit.md), and [024 upstream corpus](024-upstream-core-syntax-corpus.md).

## Motivation and separated corpus evidence

This task covers standard `{section}` blocks and the section-specific index
forms used inside them. It is driven by the separate pinned upstream core
fixtures and the official demo, not by a confirmed local application section
failure. These are independent evidence roots; do not aggregate their counts.

All baselines below were regenerated with parser SHA-256
`067f647763eb0e99488a80980710df68c2acbf6b23c7d61723e39d8fc99904e0`.
The application report is the final Task 029 report; core and example reports
were regenerated for this brief. Report-file hashes are included so later
comparisons can verify these exact files.

| Root | Report | Report SHA-256 | Files | Clean / failing |
| --- | --- | --- | ---: | ---: |
| `corpus/application/` | `/tmp/smarty-task029-after-application.json` | `6495906efd5ff5d83bc2bbe5124ce6715150967ff4e20dadc7e9fdc0515420e1` | 467 | 456 / 11 |
| `corpus/upstream-smarty-v5.8.4-core/` | `/tmp/smarty-task030-baseline-core.json` | `229fb482123da408503af6314c7f05813d0039ae1c59cef3da0be95d505eaf17` | 33 | 24 / 9 |
| `corpus/upstream-smarty-v5.8.4-example/` | `/tmp/smarty-task030-baseline-example.json` | `ebcc74ffbc188a1580a8472af7765ce19c727f10338b247d1579c007f9abeb93` | 1 | 0 / 1 |

The application corpus has no active `{section}`, `{sectionelse}`,
`{/section}`, or `$smarty.section.` spelling (`rg` over its 467 files). Its
remaining failures are separate known gaps and are not attributed to this
task.

Five of the six selected upstream section fixtures currently fail at the
section-name bracket index `$foo[bar]`:

| Upstream source | SHA-256 | Current first error |
| --- | --- | --- |
| `TemplateSource/TagTests/Section/templates/001_section.tpl` | `3a5ae37ce9499c7fa58af9cec16c0059d410136f17e2d51f9c2553f23e950d29` | line 1, column 29 at `$foo[bar]` |
| `TemplateSource/TagTests/Section/templates/002_section.tpl` | `b041dd43339f29820c87e761cbfe61c7476604be44e4860aa07624d96893c398` | line 1, column 38 at `$foo[bar]` |
| `TemplateSource/TagTests/Section/templates/003_section.tpl` | `0ecc6db4e472e6866fdf2d649cd6530d4b9cb9e6c66400bb9dc14b0b307719d8` | line 1, column 29 at `$foo[bar]` |
| `TemplateSource/TagTests/Section/templates/004_section.tpl` | `1f48a3b3d7d6ff337b3ef9c2200ce5e3bf645ade6fdcde4af2ef8aad76a00e4b` | line 1, column 29 at `$foo[bar]` |
| `TemplateSource/TagTests/Section/templates/006_section.tpl` | `4c41eb79c64230f6c2d7578a212ab3bf111bab11ccd30c85c3f5bfa7a2c55bbb` | line 1, column 29 at `$foo[bar]` |

These pinned positive fixtures are independently tied by the manifest to
`CompileSectionTest.php` methods `testSection_001`, `_002`, `_003`, `_004`,
and `_006` at Smarty commit `94a27cbbc7820198d7adc17a2be8d457fb267753`.
Their source blobs and passing-test provenance are recorded in
[`test/upstream-smarty-v5.8.4/manifest.json`](../../test/upstream-smarty-v5.8.4/manifest.json).
Fixture 007 includes `$smarty.section.bar.index` and `.iteration`; its current
tree has no parse error, but it is represented as a generic chain of nested
`index_expression` nodes. Thus its syntax is accepted but its standard section
property structure is not modeled. This task must test it structurally rather
than count it as a parse-error gain.

The official demo `demo/templates/index.tpl` is a separate syntax-only source
with SHA-256 `c50433e4a658858ccc5a785bbaf25097512587a7afaab77cb4f2c6d4e419ebea`.
Its earliest current error is `is odd by` at line 27, before the section
outputs and `$FirstName[outer]` references. The demo report remains 0 clean / 1
failing; this brief does not claim that section syntax caused that error.
After implementation, inspect the demo tree for explicit section nodes even
if an earlier unrelated error remains.

The reduced current-parser failure is:

```smarty
{section name=bar loop=$foo}{$foo[bar]}{/section}
```

The installed Smarty 5.8.4 recorder accepts it. Full-engine compilation accepts
it as well. A direct positive composition with an else branch and following
output is:

```smarty
{section name=rows loop=$items}{$items[rows]}{sectionelse}empty{/section}{$after}
```

Both `php test/reference.php` and `php test/full-engine.php` report no error;
the recorder emits ordered `section`, output, `sectionelse`, `sectionclose`,
and output events. The full engine compiles it. The recorder establishes tag
syntax/event order only, while hand-authored Tree-sitter trees establish
section-index structure.

## Pinned Smarty 5.8.4 behavior

The pinned source checkout is commit
`94a27cbbc7820198d7adc17a2be8d457fb267753`.

- `vendor/smarty/smarty/src/Parser/TemplateParser.y` (SHA-256
  `549769dd1cf7c61dad9909ddcec03cf17c6cf2096611b824e876f2250a1c3189`)
  defines section block tag semantics through ordinary registered built-ins
  and has dedicated `indexdef` productions for `[ID]` and `[ID.ID]`. These are
  section-name and section-property indices, distinct from general expression
  indices. It also rewrites `$smarty.section.name.property` through the special
  variable compiler.
- `vendor/smarty/smarty/src/Lexer/TemplateLexer.plex` (SHA-256
  `7b6544d902af60fed5b21c55f0ced2cc3a02c33f9123a7891e032dfe478f87d3`)
  tokenizes the section tag family as built-ins.
- `vendor/smarty/smarty/src/Compile/Tag/Section.php` (SHA-256
  `55868f5ba0cf645a0a8da1db1697c87ab3f23460c017256bc8baea57977a69de`)
  specifies required `name` and `loop`, shorthand argument order `name, loop`,
  optional `start`, `step`, `max`, `show`, and `properties`, and the recognized
  section property vocabulary: `first`, `last`, `index`, `iteration`, `show`,
  `total`, `rownum`, `index_prev`, `index_next`, and `loop`. It also accepts
  the `nocache` option through the common section/foreach compiler.
- `SectionElse.php` (SHA-256
  `8b5054b4be518623f52b31c71bac3dfc4cfde4d290a138bc204160c62e4e763c`)
  transitions the currently open section to its `sectionelse` branch.
  `SectionClose.php` (SHA-256
  `b4a39f6b338a0613c0e97e9964c79dd14949cbb9c8d3ee98401a7c7aae3befac`)
  accepts a close only for the open `section` or `sectionelse` frame.
- The official designer guide `language-function-section.md` (SHA-256
  `0622e79118c0f2c174336c97730cb1266b25814212a0d75a8425746004d6f5c6`)
  documents long and short headers, optional controls, nested sections,
  `{sectionelse}`, `$array[sectionName]`, `$array[sectionName.property]`, and
  `$smarty.section.name.property`.

Validated full-engine probes:

- `{section rows $items start=1 step=2 max=3 show=true nocache}{$smarty.section.rows.rownum}{/section}` compiles.
- Nested `outer`/`inner` sections with `$items[inner]`,
  `$smarty.section.outer.index`, and `$smarty.section.inner.index` compile.
- All ten documented property spellings compile under
  `$smarty.section.rows.<property>`.
- A missing close, orphan `{/section}`, cross-close `{/foreach}`, and duplicate
  `{sectionelse}` each fail full compilation. `test/reference.php` bypasses
  block validation, so use `fullEngine()` for these boundary checks.

The section tag's runtime iteration rules, required-attribute validation,
array contents, dynamic values, and generated output semantics are not this
grammar task's contract. Do not confuse the recorder's acceptance of syntactic
projections with those runtime/compiler guarantees.

## Bounded syntax and tree contract

Implement the standard section surface as one coherent syntax family:

1. A nested `section_block` owns a `section_tag`, ordinary body nodes, an
   optional `sectionelse_clause`, and a `section_close_tag`. A sectionelse
   branch belongs to its nearest open section. Sections compose with existing
   `if`, `foreach`, `for`, and literal blocks. No application-specific tag
   nesting rules are added.
2. `section_tag` preserves a structured header. Support the explicit attribute
   form (`name=...`, `loop=...`, optional `start`, `step`, `max`, `show`,
   `properties`, and bare `nocache`) and Smarty's short form
   `{section sectionName expression ...}`. Preserve source order, exact ranges,
   values, and distinctions between valued attributes and bare option flags.
   Keep supported expressions structured. The task need not reproduce compiler
   required-attribute/value validation; test those cases separately through the
   full engine. Do not collapse the header into text or generic-tag arguments.
3. A bracket index `[sectionName]` is a named `section_index` child under the
   enclosing `index_expression`'s `index` field, with a `name: (identifier)`
   field. `[sectionName.property]` is a named `section_property_index` child
   with `section` and `property` identifier fields. Preserve brackets as the
   node's exact range.
4. `$smarty.section.sectionName.property` is a named
   `section_property_expression` with `section` and `property` identifier
   fields. Recognize all ten documented property names. Preserve original
   spelling and ranges; any additional static property accepted by the parser
   grammar should also remain structurally representable rather than silently
   falling back to a generic flattened value. These fields describe syntax;
   they do not promise runtime values or validate that a section with that name
   is active.
5. Keep ordinary expression index behavior unchanged. `[$index]`,
   `[(expression)]`, and `[1 + 2]` keep existing structural types. A section
   name is not a boolean/null literal or arbitrary PHP constant. Unknown tags
   and their supported arguments remain untouched.

The reviewed minimal tree shapes should include these exact structures (field
and node names are part of the proposed contract):

```text
{section name=rows loop=$items}{$items[rows]}{sectionelse}empty{/section}{$after}
(source_file
  (section_block
    (section_tag
      (section_header
        name: (section_header_name value: (identifier))
        loop: (section_header_loop value: (variable name: (identifier)))))
    (output value: (index_expression
      object: (variable name: (identifier))
      index: (section_index name: (identifier))))
    (sectionelse_clause (sectionelse_tag))
    (section_close_tag))
  (output value: (variable name: (identifier))))

{$records[rows.index]}
(source_file
  (output value: (index_expression
    object: (variable name: (identifier))
    index: (section_property_index
      section: (identifier)
      property: (identifier)))))

{$smarty.section.rows.index}
(source_file
  (output value: (section_property_expression
    section: (identifier)
    property: (identifier))))
```

Both header spellings use the same `section_header` contract. Its `name` field
points to a `section_header_name` wrapper, and its `loop` field points to a
`section_header_loop` wrapper. Each wrapper has a `value` field; in the named
form its node range includes `name=` or `loop=`, while in the shorthand its
range covers the positional value. The wrappers therefore keep the semantic
fields stable without duplicating source text. Optional `start`, `step`,
`max`, `show`, and `properties` entries remain ordinary `attribute` children;
bare `nocache` remains a distinct option node. All entries stay in physical
source order, including when named `loop` precedes named `name`.

The exact short-header tree is required, including how trailing attributes are
represented:

```text
{section rows $items start=1 step=2}{$items[rows]}{/section}
(source_file
  (section_block
    (section_tag
      (section_header
        name: (section_header_name value: (identifier))
        loop: (section_header_loop value: (variable name: (identifier)))
        (attribute name: (identifier) value: (number))
        (attribute name: (identifier) value: (number))))
    (output value: (index_expression
      object: (variable name: (identifier))
      index: (section_index name: (identifier))))
    (section_close_tag)))
```

The long-header tree above must use these same wrappers around the `name=...`
and `loop=...` source entries, rather than direct generic-tag attributes. The
wrapper text and `value` ranges must be asserted. Short form uses the pinned
`name, loop` order; options follow those two values and retain their physical
order. Smarty 5.8.4 recorder and full-engine probes accept this exact short
header and its `start=1 step=2` options. If a reviewer finds that the shared
wrapper shape conflicts with Tree-sitter composition, report a concrete
counterexample and the smallest equally explicit alternative before
implementation.

## Failing-first checks and acceptance coverage

Before grammar changes, add hand-authored trees and a failing Node test. Keep
reference-derived examples in `test/corpus/smarty-reference.txt`, named with
version and feature. Keep task-specific edge/recovery cases in
`test/corpus/section-blocks.txt`. Do not copy upstream fixture file contents
into tracked files; these minimized source examples are new authored probes and
should be attributed to the pinned parser/documentation as appropriate.

Required fixture/tree coverage:

- Long headers with reordered `name`/`loop`, each optional `start`, `step`,
  `max`, `show`, `properties`, bare `nocache`, plus the short `{section rows
  $items}` form and short form with options.
- Body/output before, within, and after section; empty body; `{sectionelse}`;
  nested named sections; section inside and around existing `if`/`foreach`;
  local variable and section property indices; exact source/range assertions.
- Every documented property spelling under `$smarty.section.name.<property>`
  and representative `[name.property]` bracket use. Include a section index in
  output, generic-tag attribute, and an existing supported condition/modifier
  context where Smarty accepts it. Extend `docs/composition.md` with evidence
  for the context cells actually implemented; do not mark unchecked pairings.
- Separate negative/recovery cases for duplicate/orphan `sectionelse`, orphan
  `{/section}`, missing close, crossed section/if/foreach ownership, malformed
  short headers, and malformed bracket/property indices. Assert preservation of
  a neighboring independent output and ownership boundaries. Use
  `fullEngine()` for compiler block-pairing and malformed branch observations;
  the recorder alone bypasses these validations.
- Incremental edits deleting/restoring `{/section}`, changing a bracket
  section-name index to an ordinary expression index and back, and repairing a
  `sectionelse` boundary. Compare full incremental snapshots to fresh parses.
- A mutation for section-block nesting/branch ownership or section-name index
  shape must fail a hand-written expectation; retain the current mutation
  faults and anchors.

For Smarty comparison, opt only minimized valid fixtures into
`fixtures('smarty-reference.txt')`, compare recorder-visible tag event order and
argument names, and use full-engine compile results for branch ownership,
short headers, and compiler-validated options. The reference recorder does not
expose Tree-sitter fields, section index values, or runtime section state.
Include a pinned full-engine check showing mismatched/orphan section tags are
rejected; do not encode compiler errors as parser requirements unless they
define a documented syntax boundary.

Before/after evidence must include separate hash-matched reports for all three
corpus roots, saved outside `build/`. Inspect every newly clean core template
and the section-containing demo tree even if an unrelated error remains. Record
explicit section blocks/indices and all remaining errors. Do not claim a clean
demo or application gain due to this task without source-hash-matched evidence.
Run `npm test` only at implementation completion, as required by the project
gate.

## Implementation handoff fields

On implementation completion, fill in exact tree/check links; the accepted
header spellings and node fields; the supported documented property vocabulary;
reference/full-engine observations and limits; corpus before/after report paths,
hashes, source-set match, and structural inspections; mutation/edit results;
`npm test` totals; changed expectations and reasons; and remaining gaps such as
other built-in blocks and non-section index semantics. Keep core, demo, and
application evidence separate.

## Implementation evidence (2026-10-02)

Implementation adds structured `section_block`, `section_tag`,
`section_header`, `section_header_name`, `section_header_loop`,
`sectionelse_clause`, `sectionelse_tag`, `section_close_tag`, `section_option`,
`section_index`, `section_property_index`, and
`section_property_expression` nodes. Long `name=... loop=...` headers accept
either order; short `{section name loop ...}` headers share the wrapper fields.
The optional `start`, `step`, `max`, `show`, and `properties` attributes and
bare `nocache` option remain in source order. The ten documented section
properties and additional static property names are represented as identifiers.
Dedicated bracket nodes retain their surrounding brackets. Runtime iteration,
active section bindings, and property values are not asserted.

The hand-authored trees are in
[`section-blocks.txt`](../../test/corpus/section-blocks.txt) and the four
versioned minimized reference trees are in
[`smarty-reference.txt`](../../test/corpus/smarty-reference.txt). The Node
checks are in [`section-blocks.test.mjs`](../../test/section-blocks.test.mjs);
composition evidence is in [`composition.md`](../composition.md#task-030-section-index-composition-audit).
The bare short form `{section rows $items}` has its own manually specified
tree and full-engine compile check. Long and short wrapper tests assert numeric
start/end indices and row/column points for both wrappers and their `value`
children, including the source-spanning named `name=`/`loop=` wrappers.
Reference observations confirm recorder-visible tag ordering and argument
names only. Full-engine compile checks confirm short/long headers, all ten
property spellings, nested ownership, orphan/mismatched branch rejection, and
valid option values. For `properties`, the compiler probe uses the pinned
compiler's accepted quoted property-list form `properties="'first','last'"`;
arbitrary values are not runtime-validated by the grammar.

Recovery is pinned precisely. Orphan `{/section}` and `{sectionelse}` produce
an `ERROR` sibling followed by a separate `$after` output. Duplicate
`sectionelse` creates an `ERROR` inside the section block and leaves `$after`
as a root sibling. A crossed section/if or section/foreach close wraps the
whole malformed source in one root `ERROR`; the section tag, nested block and
its own matching closer, and `$after` output remain named children of that
error node. The nearby output is structurally retained, but is not a root
sibling in the crossed-close cases. A missing section close consumes its body
through end of input, so there is no following boundary to recover.

The three corpus roots remain separate. Baseline report hashes and counts are
listed above. Their before/after source sets were hash-identical (467
application files, 33 core files, and one demo file).

| Root | After report | Report SHA-256 | Before → after clean / failing | Structural review |
| --- | --- | --- | --- | --- |
| Application | `/tmp/smarty-task030-after-application.json` | `76ada7afcc434a1588972d063e2b6fb3fae35c6a026b5a2e7c3689216b3fd05a` | 456 / 11 → 456 / 11 | No section syntax is present; all 11 existing failures remain, with no regressions or gains attributed to this task. |
| Upstream Smarty core | `/tmp/smarty-task030-after-core.json` | `3a10cb558562cf8365c5306651a581510f36fa464023f01aa73c0a6483cb0cbf` | 24 / 9 → 29 / 4 | Newly clean fixtures 001, 002, 003, 004, and 006 were each inspected: all now have a `section_block`, structured header, section-name index, and close; 002/003/004/006 also own `sectionelse`. Fixture 007 remains clean and now models both `$smarty.section.bar.index` and `.iteration` as `section_property_expression`. |
| Upstream Smarty demo | `/tmp/smarty-task030-after-example.json` | `cb8c55fe1ef00d9154b863d4126483bf2e157533c4f61b0d3c2bba592c6ddbc` | 0 / 1 → 0 / 1 | `demo/templates/index.tpl` remains failing first at `is odd by 2` on line 27, an unrelated operator gap. Both demo section blocks, `sectionelse`, close tags, section-name indices, and section-property expressions are explicit in the recovered tree. Later error ranges still reflect that earlier unsupported expression. |

The four remaining core failures are unrelated block gaps:
`BockExtend/templates/002_parent.tpl`, Foreach fixtures 027 and 028, and
`TemplateFunction/templates/test_template_function_002.tpl`. The application
corpus still has 11 failures in the unchanged set recorded by Task 029, headed
by `not`/`isset`, nested interpolation/index forms, and other operator/tag
gaps. No application clean-file gain is claimed.

The required gate's original per-child 120-second timeout was too short for
the 18 isolated mutation builds after adding the section-index mutation. The
mutation child now has a finite 240-second timeout in `test/run.mjs`; the
existing mutation assertions and fault definitions are unchanged.

Focused checks before the final gate: `npm run check:grammar` passed;
`node --test test/section-blocks.test.mjs` passed 12/12; the four new
Smarty-reference trees and three task-specific expected trees passed their
focused Tree-sitter runs. Incremental snapshots match fresh parses after
deleting a section closer, changing a section-name index to an ordinary
variable index, and removing a sectionelse boundary. The full `npm test`
acceptance passed after the two review revisions: 260/260 expected trees,
366/366 Node checks, and 18/18 mutation faults caught. Final generated parser
SHA-256 remains `e8a98eb92ecc98f37b67b92218ffeb1564d50a291ef0947f3a2251451041e7f6`.
The resubmission test log is `/tmp/smarty-task030-resubmission-test.log`.

The full gate's first run exposed one pre-existing incorrect assertion in
`test/index-access.test.mjs`: it required `{$a[key]}` to be rejected. The pinned
Smarty 5.8.4 recorder returns `error: null` for that exact source, and the
full-engine compiler also compiles it successfully. Since Smarty defines a
bare identifier in brackets as a section-name index, the expectation is
corrected to require a `section_index` node with `name: (identifier)` and exact
bracket/name ranges. This correction does not change general expression-index
rules. Empty `{$a[]}` remains unsupported and its separate failure assertion
is retained.

Independent implementation review initially requested the plain short form
`{section rows $items}` as a separate expected tree and numeric range/point
assertions for the header wrappers and their `value` children. Both were added;
the same reviewer verified the bare-form parser and full-engine checks, all
long/short wrapper and value coordinates, and the final acceptance evidence,
then accepted the implementation on 2026-10-02.
