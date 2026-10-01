# 023 — Generic-tag attribute names with hyphens, digit prefixes, and single colons

Status: complete (implementation review accepted 2026-10-01; bounded partial
scope and the remaining Smarty-valid syntax gaps are documented below).
Effective implementation acceptance covers hyphenated names, digit prefixes,
and nonempty segments separated by single colons. A terminal colon (`foo:=MODE`)
and adjacent/repeated colons (`foo::bar=MODE`) are accepted by Smarty 5.8.4 but
remain explicit unsupported gaps for this task; each must remain an error in
Tree-sitter with useful recovery and a later output node. Do not describe the
narrower contract as full Smarty `ATTR` support. Dependency:
[018 generic-tag identifier values](018-generic-tag-identifier-values.md).

## Motivation and corpus evidence

The hash-matched report `/tmp/smarty-022-after.json` covers the fixed 467
application templates at parser hash
`df7367c0e97b4feb709eb18fff7cc641d9dcacfda34add7313591a34a1c31201`, matching
`src/parser.c` at HEAD `b127efa`. It reports 441 clean and 26 failing files. I
inspected the earliest reported error in every failing file. Eight separate
files fail at a hyphenated HTML attribute name in an `html_options` tag. The
reported spans are 0-based, half-open UTF-16 offsets and cover the malformed
opening tag, not only the attribute token:

| Local corpus path | Error | Attribute spelling |
| --- | --- | --- |
| `view_admin/deleted/search_deleted.tpl` | 19:35; span `[1147,1208)` | `data-inactive-allowed` |
| `view_charts/charts.tpl` | 45:59; span `[4125,4226)` | `data-inactive-allowed` |
| `view_module/search_module.tpl` | 27:17; span `[1337,1454)` | `data-inactive-allowed` |
| `view_orders/common.tpl` | 34:17; span `[1956,2144)` | `aria-autocomplete` |
| `view_orders/view_orders.tpl` | 23:49; span `[2373,2434)` | `data-inactive-allowed` |
| `view_repair/edit_repair_details_dialog.tpl` | 5:48; span `[626,722)` | `data-inactive-allowed` |
| `view_repair/search_repair.tpl` | 49:74; span `[5057,5148)` | `data-inactive-allowed` |
| `view_tools/search_ownership.tpl` | 23:47; span `[1396,1457)` | `data-inactive-allowed` |

These are first-error contexts, not a promise that fixing the attribute name
alone will make all eight files clean. The remaining 18 roots group as follows:

| Root family | Count | Paths |
| --- | ---: | --- |
| Nested output/index interpolation | 2 | `view_admin/module_types/search_module_type.tpl`, `view_admin/name_list/search_name_list.tpl` |
| Method-call interpolation in a quoted attribute | 1 | `view_labels/cable_label.tpl` |
| Nested output inside a condition | 1 | `view_certificate/actions_list.tpl` |
| Recursive include arguments | 4 | `view_module/full_instructions_action_blocks.tpl`, `view_module/instruction_summary_action_block.tpl`, `view_repair/action_blocks.tpl`, `view_repair/edit_repair.tpl` |
| `{for ...}` loop tags | 2 | `action_types/action_value_dropdown_table.tpl`, `view_module/view_module.tpl` |
| `{literal}` regions | 2 | `view_stats/action_chart.tpl`, `view_stats/stats.tpl` |
| Legacy `{foreach from=...}` form | 1 | `view_admin/debug/search_debug.tpl` |
| Assignment output | 1 | `mails/action_type_instruction_mail.tpl` |
| Word `not` plus `isset(...)` condition | 1 | `message.tpl` |
| Word `or` in a condition | 1 | `view_ajax/group_browse_dialog.tpl` |
| Array expression in an attribute value | 1 | `view_orders/new_article.tpl` |
| `@`-prefixed modifier | 1 | `view_stats/charts.tpl` |

Pinned Smarty 5.8.4 recording checks accept representative reduced forms from
these competing families, including `{for $i=0 to 3}x{/for}`, recursive
`{include file="x.tpl" block=$block parent=$block}`, `{if not isset($type)}x{/if}`,
`{if $a or $b}x{/if}`, `{$a[{$b}]}`,
`{html_options options=array(-1=>" ")+$yes_no_options}`, and
`{$xlabel_string|@ucfirst}`. This confirms these are not all invalid application
markup; they remain separate, visibly tracked gaps. The local report supplies
the exact earliest coordinate and broad Tree-sitter error span for every root.
The overlapping lexical hints are not diagnoses. The hyphenated-attribute
family is prioritized because it repeats across eight files, is one bounded
tag-attribute syntax change, and matches an explicit production in pinned
Smarty source.

## Pinned Smarty behavior

Smarty 5.8.4's `TemplateLexer.plex` defines `ATTR` with the pattern
`\s+[0-9]*[a-zA-Z_][a-zA-Z0-9_\-:]*\s*[=]\s*`. Its
`TemplateParser.y` accepts `attribute ::= ATTR expr` and
`attribute ::= ATTR value`. This covers the corpus `data-*` and `aria-*` names,
as well as static names containing the lexer's supported `:` spelling. The
recording adapter accepts this minimized example and records the ordered
attribute names:

```smarty
{widget class="box" data-id="x" aria-label=$label foo:bar=MODE 123data-id=($value + 1)}
```

Observed Smarty 5.8.4 result: tag `widget`, attributes `data-id`, `aria-label`,
and `foo:bar`, plus the digit-prefixed `123data-id`, in source order; no syntax
error. The adapter reports names/order, not values or custom-tag runtime
behavior. The malformed form `{widget data-id=}` is rejected at `}` with
`Unexpected "}"`; recovery must be asserted by the Tree-sitter tests separately.

Smarty also accepts both repeated-colon witnesses, despite the narrower
Tree-sitter scope:

```smarty
{widget foo::bar=MODE}{$later}
{widget foo::bar = MODE data-id = "x"}{$later}
```

The recording adapter returns `error: null` and the ordered attribute names
`foo::bar`, then `foo::bar` and `data-id`, respectively, followed in both cases
by the independent output event. These sources pair each reference success with
the corresponding Tree-sitter recovery case below. They are compatibility
evidence for the explicit project gap, not a request to parse `foo::bar` as an
attribute. The expected recorder projections are respectively
`[{kind:'tag', name:'widget', arguments:[{name:'foo::bar'}]}, {kind:'output'}]`
and `[{kind:'tag', name:'widget', arguments:[{name:'foo::bar'}, {name:'data-id'}]}, {kind:'output'}]`.

Two additional Smarty 5.8.4 observations document colon spellings outside the
supported Tree-sitter boundary:

```smarty
{widget foo:bar:baz=MODE}{$later}
{widget foo:=MODE}{$later}
```

Both are accepted with `error: null`; their projections preserve, in order,
`foo:bar:baz` or `foo:`, followed by the independent output event. A colon at
the end of an attribute name is therefore a confirmed Smarty-valid gap, even
when `=` follows. The nearby `{widget foo:}` form is rejected at `:` because
the required attribute equals/value is absent. Both spellings need paired
reference-success and Tree-sitter error/recovery witnesses.
The expected recorder projections are
`[{kind:'tag', name:'widget', arguments:[{name:'foo:bar:baz'}]}, {kind:'output'}]`
and `[{kind:'tag', name:'widget', arguments:[{name:'foo:'}]}, {kind:'output'}]`.
The current partial grammar parses `foo:bar:baz` as one name leaf but errors on
`{widget foo:=MODE}`. The revised contract intentionally retains that visible
gap and requires its Smarty success plus Tree-sitter recovery to be tested.

The no-equals form is separately malformed in Smarty 5.8.4:

```smarty
{widget foo:}{$later}
```

The recorder reports a syntax error at `:`: `Unexpected ":", expected one of:
"}"`. Its Tree-sitter recovery expectation must still preserve the later
output:

```text
(source_file
  (ERROR
    (identifier)
    (identifier)
    (string_fragment))
  (output value: (variable name: (identifier))))
```

Keep this explicit malformed recovery case alongside the separate Smarty-valid
`foo:=MODE` gap; do not infer that rejection of the no-equals form makes the
terminal-colon gap invalid in Smarty.

Before implementation, the Tree-sitter parser reported errors for
`{widget data-id="x"}` and `{html_options aria-autocomplete="none"}`. The
attribute-name rule only admitted the existing ASCII `identifier` and primitive
aliases, so the hyphen was instead treated as expression punctuation.

## Scope and proposed tree

Recognize a bounded subset of static generic-tag attribute names: an optional
digit prefix, a required ASCII letter/underscore, and ASCII letters, digits,
underscores, and hyphens, with nonempty segments separated by single colons.
Neither a terminal colon nor immediately adjacent `::` is supported in a
`tag_attribute_name` leaf. This covers names such as `data-id`, `aria-label`,
`foo:bar`, `foo:bar:baz`, and `123data-id`, including the eight corpus roots.
Preserve each supported
complete name in one named
`tag_attribute_name` leaf. Keep the existing `attribute` node and its `name`
and `value` fields. Do not broaden expression identifiers or tag names.
Existing simple and primitive attribute names retain their current field/tree
contract. Attribute values continue using the currently supported
`_tag_attribute_value` forms.

Terminal-colon names such as `foo:` before `=` and repeated-colon names such as
`foo::bar` are Smarty-valid but remain unsupported by the effective Tree-sitter
contract. Do not return a successful `tag_attribute_name` for them. Preserve
an error for each tag and ensure following independent syntax remains navigable.

Add the following manually specified expected tree to a new
`test/corpus/tag-attribute-names.txt` before grammar changes:

```smarty
{widget class="box" data-id="x" aria-label=$label foo:bar=MODE 123data-id=($value + 1)}
```

```text
(source_file
  (custom_tag name: (identifier)
    (attribute name: (identifier) value: (string))
    (attribute name: (tag_attribute_name) value: (string))
    (attribute name: (tag_attribute_name) value: (variable name: (identifier)))
    (attribute name: (tag_attribute_name) value: (identifier))
    (attribute name: (tag_attribute_name) value: (parenthesized_expression
      (binary_expression
        left: (variable name: (identifier))
        right: (number))))))
```

The first attribute is an existing-name control, proving ordinary attribute
names keep their existing node shape. Keep expected trees hand-written.

Add a hand-authored positive tree for a multi-segment name and independent
following output:

```smarty
{widget foo:bar:baz=MODE}{$later}
```

```text
(source_file
  (custom_tag name: (identifier)
    (attribute name: (tag_attribute_name) value: (identifier)))
  (output value: (variable name: (identifier))))
```

Retain `{widget foo:=MODE}{$later}` as a Smarty-reference success with ordered
attribute name `foo:` and following output, paired with a hand-authored
Tree-sitter error/recovery tree that preserves the later output. This records
the supported parser boundary without disguising the valid Smarty spelling.

The two Smarty-valid repeated-colon sources above remain reference fixtures,
but their Tree-sitter contract is deliberately error recovery, not an attribute
leaf. Keep the source spellings verbatim for the Smarty assertions. Add the
following hand-authored Tree-sitter cases with an independent output after each
unsupported tag; preserve the error and keep `{$later}` as an output node:

```smarty
{widget foo::bar=MODE}{$later}
```

```text
(source_file
  (ERROR
    (identifier)
    (class_constant_expression class: (identifier) constant: (identifier))
    (string_fragment))
  (output value: (variable name: (identifier))))
```

```smarty
{widget foo::bar = MODE data-id = "x"}{$later}
```

```text
(source_file
  (ERROR
    (identifier)
    (class_constant_expression class: (identifier) constant: (identifier))
    (string_fragment))
  (text)
  (output value: (variable name: (identifier))))
```

The unsupported name must not become a `tag_attribute_name`. In the spaced
witness, the `data-id` text remains within the unsupported tag's recovery span
for now; the following output is the required recovery boundary. Keep reference
assertions separate from Tree-sitter assertions: Smarty's acceptance does not
change this bounded parser contract.

Replace the draft positive Tree-sitter expectations in
`test/corpus/repeated-colon-tag-attribute.txt` with these recovery expectations.
In `test/tag-attribute-names.test.mjs`, keep reference acceptance and ordered
attribute-name assertions for the original witness sources, but change the
Tree-sitter assertions to require errors and the following output nodes shown
above. These are contract changes for the unsupported gap, not a request to
weaken the supported hyphen/digit/single-colon checks.

## Composition, recovery, and edits

This adds a generic-tag attribute-name form, not a new expression production;
do not promote expression-matrix cells merely because attribute values share
the existing value rule. In the same hand-written fixture, compose supported
hyphenated/single-colon names with representative string, variable, direct static ID,
and parenthesized-expression values. The exact `attribute` ownership and each
value subtree must remain visible. Check pinned reference event name/order for
the unknown-tag example; the recorder cannot establish value structure or
plugin behavior. Separately check that Smarty still accepts both repeated-colon
witnesses with their exact recorded attribute order, while Tree-sitter reports
the hand-authored error/recovery trees above.

Add a Node recovery check for:

```smarty
before {widget data-id=} {*after*} {$later}
```

The incomplete attribute must remain erroneous, and the following comment and
output must remain separate, navigable nodes. Add an incremental edit check
that inserts `-id` into a valid attribute name and compares the resulting full
tree with a fresh parse using `snapshot()`.

Keep names without `=` and unrelated attribute-value syntax outside this task
unless pinned source observations and exact acceptance trees show they are
required for this attribute-name family. Do not introduce a broad text fallback
or silently split the spelling into multiple arguments.

## Inventory and contract links

The `Generic tags` row in [`features.md`](../features.md) records the eight
earliest roots and the repeated-colon partial gap. [`test/CONTRACT.md`](../../test/CONTRACT.md)
tracks the `tag_attribute_name` field child and the Smarty-valid unsupported
boundary. [`composition.md`](../composition.md) records supported
single-colon composition and both repeated-colon recovery witnesses.

## Evidence

- Hash-matched reports: `/tmp/smarty-023-before.json` and
  `/tmp/smarty-023-partial-after.json`, each covering 467 files with identical
  input hashes. Clean files changed from 441 to 449; failures changed from 26
  to 18. Eight files became clean and no files regressed. The after report's
  parser SHA-256 is
  `04cafb5d5214b5de784cb156a80d55adf69f92ff7a8f24dec7194d9bbdf27255`.
- Parser hashes: before
  `df7367c0e97b4feb709eb18fff7cc641d9dcacfda34add7313591a34a1c31201`, after
  `04cafb5d5214b5de784cb156a80d55adf69f92ff7a8f24dec7194d9bbdf27255`.
- Smarty 5.8.4 source: `vendor/smarty/smarty/src/Lexer/TemplateLexer.plex`,
  `ATTR` rule near line 320; `vendor/smarty/smarty/src/Parser/TemplateParser.y`,
  `ATTR` attribute productions near lines 556–560.
- Recording observation: `{widget class="box" data-id="x" aria-label=$label foo:bar=MODE 123data-id=($value + 1)}`
  reports ordered attribute names and `error: null`.
- Current Tree-sitter reproductions: `{widget data-id="x"}` and
  `{html_options aria-autocomplete="none"}` both have error nodes.

## Implementation evidence and explicit partial gap

The manually authored fixture and Node checks were added before grammar
implementation. The initial checks failed because `data-id` was not retained as
one attribute name. The current grammar adds a named `tag_attribute_name` leaf
only in the generic-tag attribute-name position. It supports digit-prefixed
names, hyphens, and colon-containing names such as `foo:bar`, while expression
identifiers, tag names, and existing `attribute` name/value ownership stay
separate. For the composed fixture, the name ranges are `class` `[8,13)`,
`data-id` `[20,27)`, `aria-label` `[32,42)`, `foo:bar` `[50,57)`, and
`123data-id` `[63,73)` (UTF-16 half-open offsets). `$data-id` remains an
expression binary operation and does not produce a `tag_attribute_name`.

The direct repeated-colon witness documents the explicit partial boundary:

```smarty
{widget foo::bar=MODE}
```

The Smarty 5.8.4 recording adapter accepts it with attribute name `foo::bar`
and no error. The current parser instead forms an error containing a
`class_constant_expression` for `foo::bar`; it does not produce a
`tag_attribute_name` leaf. This is retained as an unsupported Tree-sitter
form under the revised partial contract, not a Smarty rejection. Experiments
with a full repeated-colon token stole
`Thing::NAME` and `Thing::make($x)` from existing positional-expression parses;
whitespace-consuming scanner alternatives also changed unrelated ranges or
failed ordinary positional/attribute cases. The current bounded implementation
therefore preserves legacy composition but does not cover the full Smarty
`ATTR` spelling. The known `::` gap remains in the inventory for a future
separately reviewed task.

Baseline gates on the bounded partial implementation, before adding the
repeated-colon acceptance witness:

- `npx tree-sitter test`: 214/214 expected trees passed.
- `npm test`: 296/296 Node checks and 14/14 intentional mutation catches
  passed.
- Focused Node checks passed for Task 023, generic-tag identifier values,
  class constants, static class-method calls, bitwise and condition operators,
  divisibility, and loop metadata. Manual shapes for old simple attributes,
  positional `Widget::make($x)`, `Widget::NAME`, ordinary positional `foo`, and
  foreach were also checked. Malformed `name=` recovery keeps subsequent
  comment/output nodes navigable, and inserting `-id` matches a fresh parse.
- All eight newly clean corpus files were structurally inspected. They contain
  12 `tag_attribute_name` leaves, each as the `name` child of an `attribute`
  under the expected `html_options`; existing string values remain visible.
  The files are `view_admin/deleted/search_deleted.tpl`,
  `view_charts/charts.tpl`, `view_module/search_module.tpl`,
  `view_orders/common.tpl`, `view_orders/view_orders.tpl`,
  `view_repair/edit_repair_details_dialog.tpl`,
  `view_repair/search_repair.tpl`, and `view_tools/search_ownership.tpl`.
- Remaining corpus errors: 18/467. No claim is made that the new clean count
  alone proves semantic support.

The revision-one positive Tree-sitter expectations for repeated-colon names
were not supported by the implementation. The witnesses
`{widget foo::bar=MODE}` and `{widget foo::bar = MODE data-id = "x"}` instead
parse through `class_constant_expression(foo::bar)` and an error. The revised
contract keeps both sources as Smarty-reference acceptance checks, while their
Tree-sitter fixtures require hand-authored unsupported/error expectations and
recovery of a following independent output. They no longer require an
attribute `name` field for `foo::bar`.

### Revision-one scanner experiments

No candidate cleared the conflict and the pre-existing range/recovery gates:

- Scanning the whole candidate after the generic-tag separator and returning
  `tag_attribute_name` only when `=` followed parsed `foo::bar=` and left
  `Thing::NAME` / `Thing::make($x)` as class constant/static call trees.
  However, the scanner was called before regex extras consumed separator
  whitespace. Its successful/declined whitespace path caused 13 existing
  Node range checks to observe leading whitespace in operator text (for
  example `&` became ` &`, `||` became ` ||`, and `is div by` became
  ` is div by`). `npm test` ended with 281/296 passing before the new witness
  indexing check.
- Adding an explicit immediate whitespace token before every generic-tag
  argument put the scanner at the name start, but changed operator and recovery
  parse choices: four corpus trees moved, including generic-tag operators,
  malformed interpolation, and the tag-shaped function-output case. Limiting
  that separator to the attribute branch changed 17 positional-argument trees.
- A two-token hidden separator scanner with lookahead either marked an empty
  name token when the marker was saved before scanning, or, after the marker
  was corrected, retained the same 13 range failures when declined at
  expression whitespace. Making the separator scanner a global external
  whitespace extra avoided failed probes but regressed 28 trees, including
  foreach and immediate-whitespace forms.

The minimized ambiguity is therefore structural: the parser must consider a
generic-tag argument as either an expression (where `Thing::NAME` and
`Thing::make($x)` are valid) or an attribute name followed by `=`. The current
Tree-sitter external-scanner call occurs before regex extras consume the gap.
Recognizing the next full name with lookahead can preserve the expression tree,
but scanner gap handling has so far moved unrelated token ranges or grammar
choices. A further revision needs a tag-state-scoped boundary that makes the
scanner run at the name start without claiming expression-internal whitespace;
global whitespace scanning is not an acceptable solution.

## Partial boundary revision (2026-10-01)

This revision adopts the narrowed contract for re-review:

1. Effective acceptance is hyphens, optional digit prefixes before the required
   letter/underscore start, and nonempty name segments separated by single
   colons. A terminal single colon and adjacent `::` are outside the accepted
   grammar. Smarty 5.8.4 accepts `{widget foo:=MODE}` as attribute name `foo:`;
   preserve it as a reference-success witness paired with a Tree-sitter error
   tree and later output. `{widget foo:}` without equals remains malformed and
   is rejected by Smarty. Each supported spelling remains one
   `tag_attribute_name` leaf in the generic-tag attribute `name` field. Existing
   simple attributes, values, expression identifiers, positional class
   constants/calls, and recovery/edit checks retain their existing contracts.
2. `foo::bar` and the spaced-equals witness are Smarty-valid according to the
   pinned 5.8.4 recorder, but unsupported in Tree-sitter. Preserve each exact
   source and assert Smarty acceptance plus recorded attribute order. For
   Tree-sitter, hand-author error trees for the unsupported tags and assert
   that a later independent `{$later}` output remains navigable. Do not claim
   these spellings are invalid Smarty or produce a successful
   `tag_attribute_name` for them.
3. The `Generic tags` inventory row, [grammar contract](../../test/CONTRACT.md),
   and [composition checklist](../composition.md) now name the same limitation.
   Terminal-colon and repeated-colon attributes remain project gaps requiring
   separately reviewed future briefs; no follow-up task numbers are assigned
   by this revision.
4. The pinned Smarty `ATTR` pattern remains documented as broader than this
   accepted implementation boundary. Thus this task establishes useful partial
   support, not complete Smarty attribute-name syntax.

The revised partial boundary was accepted by an independent task-creation
review. The review verified successful Smarty references for `foo:bar:baz`,
`foo:=MODE`, and both repeated-colon cases; the Smarty rejection of
`{widget foo:}{$later}`; all four hand-authored Tree-sitter error/recovery
trees with following outputs; and agreement among the linked contract,
inventory, and composition documents. The implementation review separately
accepted the bounded partial implementation and its evidence.

## Bounded terminal-colon implementation attempt (2026-10-01)

The accepted partial grammar parses `foo:bar:baz` as one name leaf and keeps
all 218 pre-existing corpus trees green, but its positive `foo:=MODE` witness
does not parse. A final generic-tag-local scanner attempt began after an
immediate argument gap, scanned the candidate name, marked the token end after
`foo:`, then looked through optional whitespace for `=` without consuming it.
It preserved the intended token range in isolation, but changed 37 of the 219
Tree-sitter corpus expectations, including positional/class-constant/static
forms and recovery cases. That design was reverted. The current hand-authored
corpus suite passes 219/219 with `foo:=MODE` intentionally represented as an
error/recovery tree, paired with the Smarty success assertion and later output.
That experiment was an earlier re-scope checkpoint; the revised brief has since
been accepted. The current implementation handoff and full gates are recorded
below.

## Accepted partial-scope implementation handoff (2026-10-01)

- Scope verified: hyphenated names, digit prefixes, and nonempty segments
  separated by single colons parse as one `tag_attribute_name` in the generic
  tag attribute `name` field. Terminal-colon `foo:=MODE` and adjacent-colon
  `foo::bar=` remain explicit Smarty-valid gaps; both have reference-success
  and Tree-sitter ERROR/recovery witnesses preserving `{$later}`. The malformed
  `{widget foo:}{$later}` remains rejected by Smarty and preserves later output.
- `npx tree-sitter test`: 219/219 expected trees passed.
- `node --test test/tag-attribute-names.test.mjs`: 1/1 test passed.
- `npm test`: 296/296 Node checks passed; all 14 intentional grammar mutations
  were caught. This command regenerated the grammar and rebuilt the Node addon.
- `npm run corpus:report -- corpus /tmp/smarty-023-partial-after.json`:
  467 templates, 449 without parse errors, 18 with errors. Compared with
  `/tmp/smarty-023-before.json`, corpus input hashes match; eight files became
  clean and none regressed. The after parser hash is recorded above. The
  remaining 18 files are unrelated visible gaps, not claimed as supported.
- Structural review of the eight newly clean files found 12 `data-inactive-allowed`
  or `aria-autocomplete` leaves. Every leaf is exactly the `name` child of an
  `attribute` under an `html_options` tag, with its existing string value
  subtree preserved. The eight paths are listed above; all eight root trees
  have no errors.

Independent implementation review accepted this bounded task on 2026-10-01.
The orchestrator marked the task complete after verifying the acceptance gates;
the separately documented terminal-colon and repeated-colon Smarty gaps remain
outside this task and do not count as supported syntax.
