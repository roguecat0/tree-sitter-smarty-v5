# 037 — Braced expressions in generic-tag attribute values

**Status:** complete; implementation and Task 039 recovery expectation correction independently reviewed.
**Type:** standard Smarty 5 generic-tag attribute syntax.
**Depends on:** [018 generic-tag identifier values](018-generic-tag-identifier-values.md), [035 dynamic dot indices](035-dynamic-dot-index.md), and [036 modifier prefixes](036-modifier-at-prefix.md).

## Corpus motivation and pinned Smarty evidence

The Task 036 hash-matched application report
(`/tmp/smarty-task036-application.json`) uses grammar/parser SHA-256
`a19d801912567f8119eaae4e98ea5ecddad0fe279bc311f52b5b2ace0855ff15`, which
matches committed `src/parser.c`. It measures 467 application files, 462 clean
and five failing. The source template hash for
`corpus/application/view_labels/cable_label.tpl` is
`9044de7a58087d54a9be91e1ef9fbb2394da1e473c84a4ab7426b6d5d57ffcc6`, matching
the report. Its line 35 contains:

```smarty
{html_options name="cmb_label_type_{$heatshrink_printer->get_id()}" class="jq-combobox" options=$heatshrink_printer->get_label_templates()->get_key_values(true) selected={$label_type_ids.{$heatshrink_printer->get_id()}}}
```

Reducing the failure to `{widget selected={$x}}` still produces a parser error
with the committed grammar. Removing only the attribute-value braces,
`{widget selected=$x}`, parses successfully. Thus Task 035's direct dynamic-dot
index support is already present, but does not cover a Smarty expression
delimited by braces after a generic-tag attribute's `=`.

Pinned Smarty 5.8.4 supports this as generic attribute syntax. In
`vendor/smarty/smarty/src/Parser/TemplateParser.y:556,560`, an `ATTR` token is
followed by either `expr` or `value`; `value ::= smartytag` at line 814 admits
the braced Smarty tag/value form. `attribute ::= ATTR expr` is not restricted
to dynamic-dot indices. The recording adapter accepts each of
`{widget value={$x}}`, `{widget value={$x + $y}}`,
`{widget value={"text"}}`, and `{widget value={$map.{$key}}}` without error.
It also accepts neighboring attributes, spaces around `=`, and a trailing
space before the inner `}`. The probe `{widget value={ $x}}` is rejected with
an “Unexpected space” compiler error, so leading whitespace immediately after
the inner `{` is outside this task's positive boundary.

The recorder emits an `output` event before the generic-tag event for a braced
value, even though the same `ATTR` carries that expression value in Smarty's
attribute grammar. It records names/order/counts, not attribute values or their
runtime meaning. Treat this event order as a limit of the reference projection;
hand-authored trees define the desired nested syntax and value ownership. Do
not claim plugin execution or `html_options` runtime behavior.

The same Task 036 reports keep other corpora separate: upstream Smarty core is
31/33 clean with failures in `TemplateSource/TagTests/BockExtend/templates/002_parent.tpl`
and `TemplateSource/TagTests/TemplateFunction/templates/test_template_function_002.tpl`;
the upstream demo is 0/1 clean at `demo/templates/index.tpl`. The other four
application failures are nested-brace index/condition forms in
`view_admin/module_types/search_module_type.tpl`,
`view_admin/name_list/search_name_list.tpl`, and
`view_certificate/actions_list.tpl`, plus array addition in the attribute
value in `view_orders/new_article.tpl`. Those are separate gaps and are not
claimed by this task.

## Bounded scope and tree contract

Allow an expression enclosed in Smarty braces as the value of a named
attribute on any generic/custom tag. The braces form the expression wrapper;
the attribute owns a nested `output` node, which in turn owns the expression in
its `value` field. Keep the attribute's `name` and `value` fields and the
expression's full existing shape. This records both the attribute context and
the source-level braces, unlike a direct value such as `value=$x`.

For the reduced corpus witness `{widget selected={$map.{$key}}}`, the exact
expected shape is:

```text
(source_file
  (custom_tag
    name: (identifier)
    (attribute
      name: (identifier)
      value: (output
        value: (index_expression
          object: (variable name: (identifier))
          index: (variable name: (identifier)))))))
```

For `{widget value={$x + $y}}`, `attribute.value` is `output`,
`output.value` is `binary_expression`, and its `left` and `right` fields retain
the two variable nodes. For `{widget value={"text"}}`, the same wrapper fields
contain a `string`. These distinct trees establish that the feature is the
generic braced expression-value form rather than a special case for dynamic
indices. Delimiters remain anonymous punctuation within `output`. Assert exact
zero-based, end-exclusive ranges for the full `output` node (including its two
braces), its `value` expression (excluding the braces), and the enclosing
attribute. The complete expression ranges must also remain inside the `output`
value field.

Preserve existing direct attribute values without adding an `output` wrapper:

```smarty
{widget value=$x}
```

```text
(source_file
  (custom_tag
    name: (identifier)
    (attribute name: (identifier) value: (variable name: (identifier)))))
```

No tag-name allowlist, attribute-name change, expression-text fallback, or
application-specific behavior is in scope. Reuse supported `_expression`
forms only; this task does not implement any otherwise-unsupported expression
family. Positional arguments and values outside generic-tag named attributes
are excluded. Leading whitespace inside the wrapper is a compiler-confirmed
rejection; do not broaden acceptance to it. Keep ordinary direct values and
the established dynamic-dot, modifier, string, and arithmetic trees intact.

## Failing-first fixtures and checks

Before grammar changes, add hand-authored expected trees and a failing Node
check. Use `fixtures(filename)` for a dedicated Smarty reference fixture. Cover:

1. A simple braced variable value and the exact minimized dynamic-dot witness
   tree above. For a closer mirror of the application line, include the
   dynamic index method call:
   `{html_options selected={$label_type_ids.{$printer->get_id()}}}`. Its tree
   must preserve `custom_tag.name`, `attribute.name`, nested `output.value`,
   the index receiver, and the complete `method_call_expression` under
   `index_expression.index`. The compiler check establishes the tag and
   `selected` argument names plus no compiler error; it cannot compare values.
2. A braced arithmetic expression `{widget value={$x + $y}}`, with explicit
   `output.value`, binary `left`/`right`, and variable-name fields. A braced
   string `{widget value={"text"}}` must retain its `string` child. These
   cases prevent coupling support to dynamic-dot syntax.
3. Braced values between ordinary neighboring attributes, for example
   `{widget before=1 selected={$x + $y} after=$z}{$after}`. Check source order,
   all name/value fields, the nested wrapper shape, and the separate later
   output. Also retain a direct-value control
   `{widget selected=$x}{$after}` with no nested output node.
4. Accepted boundaries `{widget value = {$x}}`,
   `{widget value= {$x}}`, and `{widget value={$x }}`; the existing grammar's
   extras may decide how these source spaces appear in ranges, so assert exact
   wrapper/expression ownership and range endpoints rather than an invented
   anonymous-space node. `{widget value={ $x}}{$after}` is rejected by pinned
   Smarty and must have a real parser error while retaining the later output.
5. Malformed expression content such as
   `{widget value={$x + }}{$after}`, with both wrapper delimiters present, and
   an incomplete outer tag such as `{widget value={$x}{$after}`. Expected
   trees must show a localized error and a navigable later output; do not
   accept recovery that turns the malformed value into text or silently loses
   the tag/attribute boundary. The nested delimiters are identical `}` bytes,
   so the incomplete-outer-tag case specifically checks recovery when Tree-sitter
   has to choose which unmatched structure owns the available delimiters. For
   the malformed-expression case, retain the generic tag and attribute, keep
   an `output` under `attribute.value`, put a real `ERROR` in that output's
   expression subtree, and retain the later output as a separate sibling. For
   the incomplete outer tag, preserve a missing outer `}` marker if the parser
   can localize it, with the later output separate. Compare whole incremental snapshots with
   fresh parses when editing `value=$x` to `value={$x}`, then to rejected
   `value={ $x}`, restoring the valid form, and removing the wrapper again.
6. Exercise incomplete-wrapper recovery inside a known block:
   `{if true}{widget value={$x}{/if}{$after}`. With the current grammar this
   parses as an `ERROR`, a separate output for `$x`, the `if_close_tag`, and a
   root-level `$after` output; it preserves the closer/sibling but loses the
   generic-tag and attribute structure. After implementation, the hand-authored
   expected tree should retain the new nested value shape and localize the
   missing generic-tag close before the block closer:

   ```text
   (source_file
     (if_block
       (if_tag condition: (boolean))
       (custom_tag
         name: (identifier)
         (attribute
           name: (identifier)
           value: (output value: (variable name: (identifier))))
         (MISSING "}"))
       (if_close_tag))
     (output value: (variable name: (identifier))))
   ```

   The Node check must require `root.hasError`, an `if_block` whose named
   children are `if_tag`, `custom_tag`, `if_close_tag` in that order, the
   `custom_tag`'s missing right brace and attribute/output/value fields, and a
   separate root-level `{$after}` output. This proves the recovery error is
   localized to the incomplete tag and does not consume either the known block
   closer or later sibling.

The task adds a dedicated row to `docs/composition.md` for braced expression
wrappers in generic-tag named attributes: mark only that context `yes` after
the reviewed trees/reference check exist; other contexts are not applicable or
unverified and must not be inferred. Link the accepted wrapper/tree check and
this brief. Preserve the existing dynamic-dot attribute cell as evidence for
the direct unwrapped form; explain that the corpus witness adds an outer
attribute-value wrapper. Update `test/CONTRACT.md` to describe the nested
`attribute.value: output(value: expression)` shape and the unchanged direct
attribute-value shape.

## Task-creation review checklist

Independently check the four positive compiler probes and leading-space
rejection against the pinned Smarty version. Confirm the corpus report/parser
hash and source-file hash, inspect the exact compiled-parser error at the
reduced reproducer, and challenge whether nested `output` is the clearest
stable tree contract given Smarty's recorder event order. Verify that spaces
around `=` and neighboring attributes remain unambiguous, and that recovery
does not let malformed braces consume following output or a block closer.

## Task-creation review disposition

Independent task-creation review accepted on 2026-10-04 after one revision
round. The reviewer verified the corpus and source hashes, current minimized
failure, pinned positive and negative compiler probes, and the `smartytag`
source path supporting the nested `output` shape. The reviewer requested an
in-block malformed case; revision 1 now requires a missing custom-tag brace
while preserving the enclosing `if_close_tag` and a root-level later output.
The revised recovery tree is reachable and its Node assertions are explicit.

## Implementation evidence

The candidate adds the generic-tag attribute wrapper without changing the
direct-value shape. Hand-authored expected trees cover wrapped variable,
arithmetic, string, dynamic-dot, and method-index expressions; neighboring and
ordered values; direct values; accepted spaces around `=`; rejected inner
leading whitespace; malformed expression recovery; incomplete outer tags; and
in-if recovery. A dedicated Smarty reference fixture and Node checks cover
recorder events, exact ranges, sibling recovery, and edits across the wrapper
boundary. The recorder's output-before-tag event projection remains a known
limit: nested value ownership is established by the hand-authored trees.

The required acceptance gate passed with `npm test`: grammar typecheck, all 332
Tree-sitter corpus cases, all 462 Node tests, and all 18 deliberate mutations,
including a Task037 mutation that changes the braced attribute's `value` field.
The complete output is at `/tmp/smarty-task037-final-npm-test.log` (SHA-256
`47e8d9b7ba3d7e891a24f37ecea8a055386ff3e5711136a4a986fd8c5a1275ab`). A hidden scanner
token accepts post-`=` whitespace only if a braced value follows; the braced
opener token rejects inner-leading whitespace. Existing direct values, legacy
missing-value recovery, and dynamic-dot missing-outer-brace recovery retain
their prior trees.

Hash-matched reports use parser SHA-256
`c52801d865597617f7e9502a44408383c6b0559e9ed5be638b53be2f5f728ffd` and are
stored outside `build/` at `/tmp/smarty-task037-application.json`,
`/tmp/smarty-task037-upstream-core.json`, and
`/tmp/smarty-task037-upstream-demo.json`. File hashes show no corpus sources
changed. The application corpus moves from 462/467 to 463/467 clean;
`view_labels/cable_label.tpl` is the sole newly clean file. Its accepted
`html_options selected={...}` tree was structurally inspected and retains the
nested output, index receiver, and method-call index. The root has no errors and
contains 4 custom tags, 32 outputs, and 50 text nodes. At line 35, `selected`
is one attribute whose value is `output(index_expression(variable,
method_call_expression))`; the custom tag also retains its name, interpolated
name string, class string, and options method-call value. The other application
failures remain unchanged. Upstream Smarty core remains 31/33 clean, and the
upstream demo remains 0/1 clean. This task does not resolve those unrelated
failures or establish plugin/runtime behavior.

The implementation sources have grammar SHA-256
`b166cc88363e8c2ed50f765e5bc8c21b92b0521a2307b2ddef7415fde6f2a79b`, parser
SHA-256 `c52801d865597617f7e9502a44408383c6b0559e9ed5be638b53be2f5f728ffd`, and
scanner SHA-256
`d111968a5a160685e2104d836a0725936e67da2279b8a65b3a23cda5b3d84b0a`. Report
SHA-256 values are application
`832974c27f9443065ffd1a773dbcceada23b0e66684548ef682a02459e19c300`, core
`5b6af02e90d29d515d0c1945a41d72ce724f7f9f2fae71e77014294ef586e8c6`, and demo
`a1bf363d953877253a8ba01612f7cb6e08dda1eb0107ab2a6e51a1ba649191e6`.

## Implementation-review disposition

Independent implementation review accepted on 2026-10-04 with no remaining
findings. The reviewer independently reran `npm test`, verified every scoped
positive and recovery tree, checked positional and legacy error-recovery
regressions, inspected the scanner gates and attribute use sites, confirmed the
mutation for the new value field is caught, matched all corpus source identities
and reports, and inspected the newly clean application tree. The composition
matrix's braced attribute cell was corrected to `yes` during review and
rechecked for consistency with the evidence and feature inventory.

## Recovery expectation correction (2026-10-04)

The Task 039 condition-specific expression primary changes scanner recovery at
the rejected Task 037 probe `{widget value={ $x}}{$after}`. A focused scanner
trace shows that recovery consumes the opening `{`; the remaining `text` node
therefore starts at the following whitespace. The previous expected
`string_fragment` child described a different scanner recovery path, not a
Smarty syntax distinction. Both the pinned Smarty 5.8.4 recorder and full
compiler reject this input with `Unexpected " "`, so the correction changes
only the expected malformed tree and does not broaden accepted syntax.

The revised tree keeps a real root error for `{widget value=` at `[0,14)`,
then preserves the complete malformed remainder `{ $x}}` as `text` at
`[14,20)`, followed by the independent, error-free `{$after}` output at
`[20,28)`. The Node check pins these source slices and ranges, both tag-name
identifiers, the compiler rejection, and the surviving output. This is an
evidence-backed contract correction. The independent Task 039 completion
review accepted the corrected tree, source-backed rationale, and range checks.
