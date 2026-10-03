# 035 — Dynamic dot indices

**Status:** complete; independent implementation review accepted.
**Type:** standard Smarty 5 variable-index expression syntax.
**Depends on:** [007 index access](007-index-access.md), [010 array literals](010-array-literals.md), and [011 standalone function calls](011-standalone-function-calls.md).

## Corpus motivation and pinned Smarty evidence

The hash-matched Task 034 reports use parser SHA-256
`1eb5a5ddf5dc7750fc8bf7a250f27fc695c34432baecd49bec08c3bcb119677d` and keep
the application and upstream core roots separate. The application report
(`/tmp/smarty-task034-final-application.json`) has 461/467 clean files and six
failing files. In `view_labels/cable_label.tpl:35`, the `selected` attribute contains
`$label_type_ids.{$heatshrink_printer->get_id()}`. The baseline parser reports
an error over that tag and then treats the inner method output as an independent
template output. A reduced output, `{$map.{$key}}`, reproduces the error.

This reduction is confirmed standard syntax in pinned Smarty 5.8.4:
`vendor/smarty/smarty/src/Parser/TemplateParser.y:985-987` defines
`indexdef ::= DOT LDEL expr RDEL` and lowers the expression to an index. The
Smarty 5.8.4 recording compiler accepts `{$map.{$key}}` with one output event
and no compiler error, and accepts the corresponding attribute form
`{widget value=$map.{$key}}` as a tag with a `value` argument. It likewise
accepts a method call inside the dynamic index. The compiler observation
confirms syntax/event acceptance only; it does not expose the index expression's
tree or application plugin behavior.

The same report confirms a separate modifier-prefix gap: pinned
`TemplateLexer.plex:317` recognizes `|@`, and `TemplateParser.y:1214-1216` has a
`VERT AT ID` modifier production. The recording compiler accepts
`{$x|@ucfirst}` and records modifier `ucfirst`; this says nothing about runtime
modifier/plugin availability.

The same Task 034 application report contains other failures that this task does
not claim to address: nested brace expressions in square-bracket indices in two
templates; a nested-brace condition in `view_certificate/actions_list.tpl`;
array addition in a generic attribute in `view_orders/new_article.tpl`; and
`@ucfirst` modifier-prefix cases in `view_stats/charts.tpl`. Application-specific
modifier resolution and `html_options` runtime semantics are not parser
requirements.

The separate upstream Smarty core report (`/tmp/smarty-task034-final-upstream-core.json`)
has 31/33 clean files. Its two failures use output `nocache` forms in the BockExtend
and template-function fixtures. Those are valid output-attribute syntax already
recorded as a follow-up gap in [Task 011](011-standalone-function-calls.md); they
are not part of dynamic indexing. The upstream demo remains a separate report
with 0/1 clean files.

## Bounded scope and tree contract

Support a dynamic dot index whose dot is immediately followed by a braced Smarty
expression: `$map.{$key}`. Reuse the established `index_expression` shape, with
the receiver in `object` and the complete expression inside `index`:

```smarty
{$map.{$key}}
```

```text
(source_file
  (output value: (index_expression
    object: (variable name: (identifier))
    index: (variable name: (identifier)))))
```

For `{widget value=$map.{$printer->get_id()}}`, preserve the ordinary
`custom_tag` → `attribute` → `value` nesting, with the value an `index_expression`
whose `index` is the full `method_call_expression`. Dot and braces remain
anonymous punctuation; do not add an output node for the inner expression.
Existing receiver restrictions and left-nested composition remain in force.

Do not change static dot keys, numeric dot keys, bracket indices, section
indices, or modifier precedence. Do not implement nested brace syntax inside
square-bracket indices as part of this task. Do not special-case `html_options`
or any application tag, introduce text fallbacks, or infer plugin/runtime
semantics. Other forms from the application and upstream reports remain visible
project gaps.

## Failing-first fixtures and checks

Before grammar changes, add hand-authored expected trees and a failing Node
check. At minimum cover:

1. `{$map.{$key}}` with the exact tree above, and a mixed-case ordinary
   identifier expression whose source range remains inside the `index` field.
   Also cover `{$map.{$key + 1 * 2}}`; pinned Smarty accepts it, and the full
   arithmetic tree must remain under the index field:

   ```text
   (source_file
     (output value: (index_expression
       object: (variable name: (identifier))
       index: (binary_expression
         left: (variable name: (identifier))
         right: (binary_expression
           left: (number)
           right: (number))))))
   ```

   Assert the `+`/`*` source ranges and multiplication-before-addition shape;
   neither operator is a named child in the existing arithmetic contract.
2. `{$map.{$printer->get_id()}}`, `{$map.{$key|escape}}`, and
   `{$map.{$key}.label[2]}` to check a method-call index, modifier composition,
   and composition with
   later static and bracket indices. Assert left nesting, exact fields, and
   source text/ranges. Include the same forms as a generic-tag attribute value
   and as a function argument, without recognizing custom tag names.
3. The minimized application context
   `{html_options selected=$labels.{$printer->get_id()}}`. Its full tree must
   retain the tag name, `selected` attribute, dynamic index receiver and method
   call. Use the recording adapter to compare the tag and argument-name event;
   the adapter does not verify value structure.
4. Negative boundaries: preserve current trees for `$map.label`, `$map.12`,
   and `$map[$key]` according to actual pinned Smarty behavior; ensure the
   dynamic form and its inner expression do not create a nested template
   `output` node.
5. For `{$map.{$key}{$after}`, require this hand-authored recovery tree: the
   dynamic `index_expression` remains the value of the first output, the
   missing outer right delimiter is represented as `(MISSING "}")`, and the
   following `{$after}` remains a separate error-free output. Also test the
   incomplete prefix `{$map.{` for a real error without requiring a completed
   expression node. Include an edit that inserts/removes the expression or
   closing brace and compare full incremental snapshots with fresh parses at
   every state.

   ```text
   (source_file
     (output value: (index_expression
       object: (variable name: (identifier))
       index: (variable name: (identifier)))
       (MISSING "}"))
     (output value: (variable name: (identifier))))
   ```

6. Smarty requires the dot and opening delimiter to be adjacent. Its pinned
   compiler rejects `{$map. {$key}}` with an unexpected-space syntax error.
   Add a reference-rejected case and a parser recovery case for
   `{$map. {$key}}{$after}`. Require a real error, no `index_expression` for
   the whitespace-separated form, and retain the following `{$after}` output.
   The current baseline recovery shape to preserve is:

   ```text
   (source_file
     (ERROR (variable name: (identifier)))
     (output value: (variable name: (identifier)))
     (text)
     (output value: (variable name: (identifier))))
   ```

   Do not normalize away the separating space or treat it as the standard
   dynamic-dot form.

Use `fixtures(filename)` for recorder checks. Verify source behavior against the
pinned parser/compiler, but keep explicit trees as the contract for expression
structure. Update `docs/composition.md` to show dynamic-dot composition as
unverified until these fixtures exist, then mark only the contexts actually
covered. Run the full `npm test` gate and preserve separate hash-matched reports
for application, upstream core, and upstream demo outside `build/`. Inspect any
newly clean application trees and all regressions. Completion requires
independent implementation review.

## Remaining gaps and follow-up

The minimized dynamic-dot syntax is implemented and accepted by the pinned
Smarty recorder. The originating application file remains a parse failure:
its exact tag uses the additional `selected={$label_type_ids.{$...}}` bracing,
which the recorder accepts but this task does not support as a generic-tag
attribute value. Thus Task 035 does not claim an application-file gain; the
braced attribute-value form is a separate confirmed standard syntax gap to add
to the task queue. The other five application failures remain unresolved.
Task 011's output-attribute/`nocache` gap is the immediate separate upstream-core
follow-up. Nested-brace square-bracket indices, the nested-brace condition, and
array addition in generic attributes need separate minimized source/compiler
observations before task selection. The `|@` modifier prefix is already
confirmed as a separate standard gap. Continue to report the two upstream
corpus roots separately from the application corpus.

## Implementation evidence (2026-10-04; independently reviewed)

- Added [hand-authored dynamic-dot trees](../../test/corpus/dynamic-dot-index.txt)
  and [reference, shape, recovery, and incremental checks](../../test/dynamic-dot-index.test.mjs).
  Coverage includes arithmetic precedence and ranges, method and modifier
  indices, later dot/bracket composition, generic-tag attribute and function
  argument contexts, exact adjacency, incomplete input, a missing outer brace,
  and edits compared against fresh parses.
- `npm test` passed: 307/307 Tree-sitter trees, 438/438 Node checks, and all
  17 mutation checks caught. The independent completion reviewer reran the
  gate successfully. Log: `/tmp/smarty-task035-npmtest.log`.
- Separate reports use parser SHA-256
  `f079098a039888e1603f7bd58edc7d3768c957ca2510d64ff0fea74123746262`:
  application 461/467 clean (`/tmp/smarty-task035-final-application.json`),
  upstream Smarty core 31/33 clean
  (`/tmp/smarty-task035-final-upstream-core.json`), and upstream demo 0/1 clean
  (`/tmp/smarty-task035-final-upstream-demo.json`). The application count is
  unchanged from Task 034; no files newly became clean and no clean file
  regressed. Therefore there are no newly clean application trees to promote.
- Inspecting the originating file showed that its full attribute adds braces
  around the expression, unlike the minimized direct-value fixture in this
  brief. `reference()` accepts the exact braced form, but the grammar retains an
  error there. This confirmed gap must be handled separately; the Task 035
  result is the standalone dynamic-dot expression support, not a claim that the
  application witness is fixed.
- The previous Task 007 negative expectation for `{$a.{$key}}` was removed
  because Task 035 now has a hand-authored tree and recorder check proving the
  standard syntax. All other Task 007 receiver and whitespace boundaries stay
  unchanged.
