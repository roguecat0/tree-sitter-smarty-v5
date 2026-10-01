# 018 — Static identifiers in generic-tag values

Status: complete (2026-10-01). Independent brief review accepted after one
revision round; implementation review accepted with no actionable findings.
Priority: next corpus task after completed 017.
Dependencies: existing generic-tag positional/attribute parsing and the
identifier token contract. This task does not implement or certify a plugin.

## Motivation and corpus evidence

The hash-matched report at `/tmp/smarty-017-after.json` was generated from
revision `195eeb6` and parser hash
`d0a8515989bdeb5b9c629c822c68bc174d5f765d5d3e956000d2c93691df9a56`. The report's
`grammarSha256` is the generated `src/parser.c` source hash. It covers
the same 467 locally supplied templates: 247 parse without errors and 220 have
errors. In 158 of those 220 failing files, the earliest error is at a `{block
name=...}` tag with an unquoted static identifier value, commonly
`{block name=title}`. This is a diagnosis of the minimized failing tag, not a
claim that fixing it will make all 158 source files clean; later errors may
remain. The corpus report's lexical hints are overlapping triage clues, not
diagnoses.

Minimized evidence:

```smarty
{block name=title}body{/block}
```

Pinned Smarty 5.8.4's recording compiler accepts this and reports `block` with
one named argument `name`, then an independent `blockclose` event. The full
engine compiles it and renders `body`. The current grammar reports an error on
the `name=title` attribute value. The same current grammar failure is visible
for a positional form:

```smarty
{widget foo}
```

The pinned recording compiler accepts this as a `widget` tag with one
positional argument. The full engine rejects it because `widget` is not a
registered tag in the controlled environment; that rejection is plugin
availability, not syntax evidence. The recording adapter verifies tag name,
argument order/names and count, but cannot verify values or plugin behavior.

The pinned Smarty 5.8.4 parser source supports the proposed boundary directly:
`vendor/smarty/smarty/src/Parser/TemplateParser.y` has
`attribute ::= SPACE ID EQUAL ID`, `attribute ::= SPACE value`,
`attribute ::= SPACE expr`, and `value ::= ID` productions (around lines
544–572 and 760). `TemplateLexer.plex` defines `ID` as
`[0-9]*[a-zA-Z_]\w*` (line 321). The compiler turns an undefined `ID` into a
quoted literal and resolves a defined constant by name; the parser-only
recording adapter does not establish which behavior applies in an application.

Reproduction at the baseline: `parser().parse('{widget foo}')` yields
`(source_file (custom_tag name: (identifier) (ERROR (identifier))))`, while
the recorder returns `widget` with one positional argument and no error.
`{widget mode=title}` yields an `ERROR` over the attribute tokens while the
recorder returns one attribute named `mode`. `{block name=title}body{/block}`
has the same current grammar error, recorder events for `block` and
`blockclose`, and full-engine result `body` with no error. These are syntax
observations only; the generic `widget` full-engine cases report an unknown
tag because no plugin is registered.

## Scope and proposed tree

Accept one static Smarty `ID` as a direct value in either a generic-tag
positional argument or a named attribute value. Preserve it as an `identifier`
node and keep the existing `argument`, `attribute`, `name`, and `value` fields.
The exact direct forms are:

```smarty
{widget foo}
```

```text
(source_file
  (custom_tag
    name: (identifier)
    argument: (identifier)))
```

```smarty
{widget mode=title}
```

```text
(source_file
  (custom_tag
    name: (identifier)
    (attribute
      name: (identifier)
      value: (identifier))))
```

Accept positional and named values together without losing structure:

```smarty
{widget foo mode=title amount=123 enabled=true disabled=false text="ok" current=$item type=Widget::NAME}
```

Its `custom_tag` has the tag-name identifier `widget`, positional `argument:
(identifier)` `foo`, and attributes in source order. Their name/value pairs are
`mode` / `(identifier)` `title`, `amount` / `(number)` `123`, `enabled` /
`(boolean)` `true`, `disabled` / `(boolean)` `false`, `text` / `(string)` `"ok"`,
`current` / `(variable)` with name `item`, and `type` /
`(class_constant_expression)` with `class` and `constant` identifier fields.
The same ID node contract applies to a
digit-prefixed ID such as `123foo`; pure `123` stays a number.

The full manually specified tree for that composition is:

```text
(source_file
  (custom_tag
    name: (identifier)
    argument: (identifier)
    (attribute name: (identifier) value: (identifier))
    (attribute name: (identifier) value: (number))
    (attribute name: (identifier) value: (boolean))
    (attribute name: (identifier) value: (boolean))
    (attribute name: (identifier) value: (string))
    (attribute name: (identifier) value: (variable name: (identifier)))
    (attribute name: (identifier)
      value: (class_constant_expression
        class: (identifier)
        constant: (identifier)))))
```

Also add a separate manually specified tree for
`{widget value=123foo}`; its `attribute` value is one `(identifier)` whose text
is `123foo`:

```text
(source_file
  (custom_tag
    name: (identifier)
    (attribute
      name: (identifier)
      value: (identifier))))
```

Keep this syntax context-specific. Do not make bare identifiers general
expressions, outputs, conditions, foreach sources, array keys/values, function
or method arguments, or modifier inputs. Do not change tag-name parsing,
primitive nodes (`true`, `false`, `null`), numbers, variables, strings, class
constants, parenthesized expressions, or existing expression trees. Do not
parse identifier text as a call, property, or plugin name. Unknown opening and
closing tags remain independent; this task asserts no custom block pairing,
tag allowlist, or arbitrary plugin semantics. A defined PHP constant's runtime
meaning is outside the tree contract.

## Checks to add before grammar changes

1. Add hand-written trees for the two minimal forms above and the mixed-value
   composition. Check that positional and attribute identifiers have the exact
   fields and text, and that the mixed tree preserves each existing node type
   and source order. Include `{widget foo}{/widget}` to retain separate opening
   and closing tags.
2. Load those fixtures through the Smarty 5.8.4 recording adapter with
   `fixtures('generic-tag-identifier-values.txt')`. Check observed tag names,
   argument order, attribute names, and counts only; do not assert ID values
   from that adapter. Include the `block name=title` minimized example.
3. Add a controlled full-engine check that `{block name=title}body{/block}`
   renders `body`. A built-in `assign` case such as
   `{assign var=x value=foo}{$x}` may separately confirm that Smarty uses this
   ID spelling as a value in the controlled environment. Do not run the full
   engine on the application corpus or infer plugin behavior from `widget`.
4. Keep the boundary explicit: `{widget value=123}` has a number value,
   `true`/`false`/`null` keep their primitive nodes, `Widget::NAME` remains a
   class-constant expression, and `$item` remains a variable. A tag name such
   as `{widget}` remains the `custom_tag` name field. A direct ID accepted in
   modifier arguments by 017 does not imply ID support in other expression
   contexts.
5. Reject the malformed form `{widget value=}`. For
   `{widget value=}tail {$after}`, the exact hand-authored recovery tree after
   adding the direct ID alternative is:

   ```text
   (source_file
     (custom_tag
      name: (identifier)
      (attribute
        name: (identifier)
        value: (MISSING identifier)))
     (text)
     (output value: (variable name: (identifier))))
   ```

   Assert `rootNode.hasError === true`, the missing `identifier` node in the
   `attribute`'s `value` field, then the following `text` and independent
   variable output siblings in that order. The pinned Smarty 5.8.4 recorder
   rejects the source with a syntax error at the unexpected `}`. This task adds
   IDs only at the two stated generic-tag positions; it does not broaden the
   expression grammar or change the existing tree for an unrelated context.
6. Check an incremental edit that inserts or removes a bare ID value at a tag
   boundary; compare the edited tree snapshot with a fresh parse. The repaired
   tag and a following independent output/closer must retain the expected tree.
7. Run `npm test`. Save before/after corpus reports outside `build/`, compare
   all source hashes and generated-parser hashes, inspect any newly clean files,
   and report remaining failures. A green parse result alone does not establish
   identifier tree structure.

## Evidence limits and deferred work

The corpus finding is strongest for named attributes on `block`, but the
minimal positional example is independently accepted by Smarty's recording
compiler. Keep both positions in scope because the pinned grammar explicitly
has direct `ID` alternatives for each. No corpus-wide clean-file gain is
promised: source templates can contain other unsupported built-in tags,
operators, interpolation, or recovery gaps.

Double-quoted Smarty interpolation remains a separate project gap. The
corpus-wide presence of `{$...}` inside quoted strings is only a lead: many
failing templates also contain unrelated block-tag or expression errors, and
the report does not attribute those errors to interpolation. A separate task
must minimize the affected interpolation forms and establish the tree contract
and Smarty evidence before changing string syntax. Task 016 remains a deferred,
unreviewed candidate; task 017 remains complete.

## Task-creation review disposition

Independent task-creation review accepted (2026-10-01) after one revision
round. The reviewer reproduced the hash-matched corpus totals and the 158
earliest `{block name=...}` errors, verified the pinned Smarty positional and
named `ID` productions and controlled full-engine block example, and confirmed
the exact malformed recovery tree and compiler rejection. No findings remain.

## Implementation evidence

Implemented the two context-only direct-ID alternatives in generic-tag
positional arguments and named attribute values. The ID nodes remain
`identifier`; `123foo` is distinguished from `123`, while `true`, `false`,
`null`, strings, variables and class constants retain their existing nodes.
Hand-authored trees in
[`generic-tag-identifier-values.txt`](../../test/corpus/generic-tag-identifier-values.txt)
cover both positions, mixed values, numeric/primitive classifications, separate
closers, and `{block name=title}`. The Node checks compare recorder tag names,
argument order, attribute names and counts, verify the controlled built-in block
renders `body`, and exercise malformed recovery and an incremental edit.

The missing-value tree differs from the brief's original baseline shape: with a
direct ID expected at the value position, Tree-sitter inserts `(MISSING
identifier)` instead of the prior missing boolean `true`. Both
`{widget value=}` and `{widget value=}tail {$after}` still report an error; the
latter retains its `text` and independent output siblings. This is a narrow,
deterministic recovery-shape change from the newly expected token, recorded for
implementation review.

The previous primitive-boundary check expected `{widget value=trueish}` to
error. Pinned Smarty's `ID` lexer pattern accepts this spelling as a complete
identifier, so the contract now records an `identifier` value there while exact
`true`, `false`, and `null` still retain their primitive node types. Its
hand-authored tree is loaded through the pinned recording adapter with the
other fixtures. The Task 017 context-exclusion check was also updated: generic
tag values are now accepted, while function arguments, array values, and tag
name behavior remain explicitly rejected/unchanged.

`npm test` passes: 156 expected trees, 223 Node checks and 11 mutation catches.
Hash-matched corpus reports use the same 467 input hashes. Clean files increase
from 247 to 382 and failures decrease from 220 to 85, with no clean-to-failing
regressions. All 135 newly clean files were parsed and structurally inspected:
they contain 1,011 explicit `custom_tag` nodes and 290 direct identifier values;
every newly clean file contains at least one such identifier value. Parser source
hashes are `d0a8515989bdeb5b9c629c822c68bc174d5f765d5d3e956000d2c93691df9a56`
before and `1658ac9955178f0bbfc0a99937a075836408bb2b51233caf75efc4388d5090c3`
after. No local corpus template source hash changed. Reports are preserved at
`/tmp/smarty-018-before.json` and `/tmp/smarty-018-after.json`; the inspected
file-by-file node/value list is `/tmp/smarty-018-newly-clean-audit.json`.

Limitations: this does not allow bare IDs in general expressions, function or
method arguments, modifier inputs, or array keys/values; it does not resolve
constant values or plugin semantics. The corpus still has 85 parse-error files.

## Implementation-review disposition

Independent implementation review accepted (2026-10-01) with no actionable
findings. The reviewer reproduced `npm test` and the hash-matched corpus report,
verified generated sources, reviewed mixed-value node ranges and malformed
recovery, checked the `trueish` token correction against the pinned Smarty ID
rule, and inspected the structure of all 135 newly clean files. Contract,
feature inventory, composition matrix, and Task 017's changed context check
match the accepted boundary.
