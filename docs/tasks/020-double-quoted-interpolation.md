# 020 — Interpolation in double-quoted Smarty strings

Status: complete (2026-10-01). Brief accepted; independent implementation
review accepted. Dependencies: variables (001),
object access (003–004), calls (011, 019), and the existing string-expression
contract. Task 016 remains deferred; 017–019 remain complete.

## Motivation and corpus evidence

The hash-matched report `/tmp/smarty-019-review-after.json` covers the fixed
467 application templates at parser hash
`bc07dada33635385d5ee4b4436c736ee1d5338d3603048e7bc005927cc5f6cc4`, matching
`src/parser.c` at HEAD `08b0e8708c4ef1c2c6bf7b8ef0dc09def60ef2a3`. It reports 396
clean templates and 71 with parse errors. I inspected the actual earliest error
span and source around each of the 71 failing files. In 23 files, the earliest
failing tag contains an actual Smarty interpolation within a double-quoted
value: direct `$name`, `{$expression}`, or a backtick form entered when a
backtick is immediately followed by `$`. This is a first-error-context count;
it does not predict that all 23 templates will become clean because later
independent errors may remain.

The previous hash-matched report `/tmp/smarty-018-after.json` has the same 467
source hashes and 382 clean / 85 failing files. Applying the same earliest-tag
source inspection to both reports finds 22 such contexts before Task 019 and
23 after it. Task 019 resolved a prior static-call error in
`view_orders/nl_request_parent_table.tpl`, exposing that file's later
interpolated `html_options` value as its current earliest error. All 23 current
contexts contain a real direct-dollar, braced, or immediate-backtick-dollar
interpolation; six contain the last form, and none relies only on literal
backtick text being treated as an expression. A narrower
direct-root count in the Task 019 audit recorded 17; the counts differ because
this audit also counts a failing first tag whose unsupported interpolation
occurs in another double-quoted value within that same tag. The task scope is
grounded in the listed current source contexts, not a claim about all causes
of every parse error. Neither the narrower 17 nor the broader 22-to-23 count
estimates how many files this task will make clean.

The 23 audited paths are:

`action_types/action_value_add_child.tpl`,
`action_types/action_value_checkbox.tpl`,
`action_types/action_value_commandbutton_swap_dialog.tpl`,
`action_types/action_value_complainbox.tpl`,
`action_types/action_value_dropdown.tpl`,
`action_types/action_value_feedback.tpl`,
`action_types/action_value_replace_part_edit_fav.tpl`,
`action_types/action_value_replace_part_export_dialog.tpl`,
`action_types/action_value_replace_part_fav_dialog.tpl`,
`action_types/action_value_replace_part_import_dialog.tpl`,
`action_types/action_value_replace_part_request_dialog.tpl`,
`action_types/action_value_replace_part_request.tpl`,
`action_types/action_value_select_measurement_device.tpl`,
`action_types/action_value_select_module_owner.tpl`,
`action_types/action_value_select_repair_kind.tpl`,
`action_types/action_value_user_select.tpl`,
`view_action/action_type_parameters_table.tpl`,
`view_developer/view_developer.tpl`,
`view_labels/cable_label.tpl`, `view_module/select_module.tpl`,
`view_orders/nl_request_parent_table.tpl`, `view_repair/action_blocks.tpl`, and
`view_wage_work/edit_wage_work_repair.tpl`.

Representative minimized forms are currently errors in Tree-sitter and are
accepted by the pinned Smarty 5.8.4 parser/compiler:

```smarty
{"Hello $name"}
{"Hello {$user->name}"}
{"Hello `$name`"}
{"Hello `{$name}`"}
{widget value="id_{$item}"}
{$value|default:"id_{$item@key}"}
```

For each, `test/reference.php` reports no syntax error. Its event projection
only observes the output or generic tag/argument names and cannot verify string
segments or expression values. `fullEngine(..., {mode: 'compile'})` compiles the
controlled output and modifier examples under Smarty 5.8.4; the unknown
`widget` tag is appropriate only for the recording parser, since the full
engine has no such plugin. Full-engine rendering returns `Hello world` for
`{"Hello `$name`"}`. For `{"Hello `{$name}`"}`, rendering preserves literal
backticks around the expanded variable, so backticks are string fragments in
this form. The exact controlled renders are:

```text
{"Hello `$name`"}        => Hello world
{"Hello `{$name}`"}      => Hello `world`
```

Do not treat a function-like sequence in backticks as a backtick expression.
With `$name` set to `world`, ``{"Hello `strtoupper($name)`"}`` renders this
literal text while independently interpolating `$name`:

```text
Hello `strtoupper(world)`
```

A backtick that is not immediately followed by `$` does not enter the expression
lexer state. Its surrounding text remains part of the string; a `$name` within
that text still uses ordinary direct-variable interpolation.

The competing bitwise-`&` first-error cluster remains separate: a current
source audit finds 10 earliest errors rooted at such conditions. Other visible
roots include bare tag arguments, nested index interpolation, and literal
blocks. Do not mix those families into this task.

Pinned source evidence: Smarty 5.8.4
`vendor/smarty/smarty/src/Parser/TemplateParser.y` has
`doublequotedcontent ::= BACKTICK variablevalue BACKTICK` and
`doublequotedcontent ::= BACKTICK expr BACKTICK` (around lines 1391–1398),
`doublequotedcontent ::= DOLLARID` (around 1399), and left-delimiter forms for
`variablevalue` and `expr` (around 1403–1408). `doublequoted_with_quotes`
assembles these contents between `QUOTE` tokens (around 1370–1382). These
parser productions alone do not establish when backtick expression mode
starts. The pinned `vendor/smarty/smarty/src/Lexer/TemplateLexer.plex` has a
`backtick dollar` rule in `DOUBLEQUOTEDSTRING` (around lines 658–663): only
backtick followed immediately by `$` emits `BACKTICK` and switches to
`TAGBODY`. This is corroborated by full-engine rendering: `` `$name` `` expands,
while `` `{$name}` `` preserves literal ticks around the braced interpolation
and `` `strtoupper($name)` `` keeps the call spelling literal while expanding
only `$name`. The generated
compiler source also enters/leaves double-quote mode and checks block-stack
balance; nested tag execution and compiler block validation are not part of
this task's interpolation contract.

The same pinned lexer defines `id` as `[0-9]*[a-zA-Z_]\w*`. In
`DOUBLEQUOTEDSTRING`, `dollar id` emits `DOLLARID`, while a bare `dollar`
emits `TP_TEXT`; therefore `$`, `$!`, and `$5` are literal content, but `$5a`
and `$5_` enter interpolation. Smarty 5.8.4 full-engine rendering confirms
`{"$"}` → `$`, `{"$!"}` → `$!`, `{"$5"}` → `$5`, `{"Price $5"}` →
`Price $5`, and `{"$5a"}` with variable `5a=world` → `world`. The parser keeps
the first four as the existing `string` node. It supports digit-prefixed IDs
only through the interpolation variable alias; general variables in other
contexts remain unchanged. Unquoted `{$5a}` is valid Smarty syntax but remains
unsupported by the shared variable rule; track that separately rather than
broadening this task.

## Scope and proposed tree

Keep plain non-interpolated quoted strings as the existing `string` node.
Represent a double-quoted string containing interpolation as one
`interpolated_string` node, with source-order `string_fragment` children and
`string_interpolation` children. Each interpolation has a `value` field holding
the parsed expression. Double quotes are delimiters. A backtick pair is a
delimiter only when its opening backtick is immediately followed by `$`; in
that form the following supported expression is the interpolation value.
Otherwise backticks remain in ordinary `string_fragment` text. Fragments hold
nonempty source text only; do not emit zero-width fragments before or after an
interpolation. Do not discard ordinary text surrounding the expression.
When a double-quoted string contains a dollar that is not followed by the
pinned lexer's Smarty `id`, retain the existing `string` node. In particular,
`{"$"}`, `{"$!"}`, `{"$5"}`, and `{"Price $5"}` are literal strings;
`{"$5a"}` and `{"$5_"}` are interpolated strings whose variable names are
`5a` and `5_`. Keep this digit-prefix recognition local to
`string_interpolation` rather than changing the shared variable rule.
When a literal dollar fragment is immediately followed by a recognized
interpolation opener, preserve both pieces: `{"$$name"}` has fragment `$`
plus interpolation `$name`, and renders `$world`; `{"$5$name"}` has fragment
`$5` plus interpolation `$name`, and renders `$5world`.

Hand-authored tree contracts to add in `test/corpus/smarty-reference.txt`:

```smarty
{"Hello $name"}
```

```text
(source_file
  (output
    value: (interpolated_string
      (string_fragment)
      (string_interpolation value: (variable name: (identifier))))))
```

```smarty
{"Hello `$name`"}
```

```text
(source_file
  (output
    value: (interpolated_string
      (string_fragment)
      (string_interpolation
        value: (variable name: (identifier))))))
```

```smarty
{"Hello {$user->name}!"}
```

```text
(source_file
  (output
    value: (interpolated_string
      (string_fragment)
      (string_interpolation
        value: (member_expression
          object: (variable name: (identifier))
          member: (identifier)))
      (string_fragment))))
```

```smarty
{widget value="id_{$item@key}"}
```

```text
(source_file
  (custom_tag
    name: (identifier)
    (attribute
      name: (identifier)
      value: (interpolated_string
        (string_fragment)
        (string_interpolation
          value: (loop_metadata_expression
            item: (variable name: (identifier))
            property: (identifier)))))))
```

Also specify ``{"Hello `{$name}`"}`` with this tree, and assert that its backticks
remain part of the first and last `string_fragment` text around the braced
interpolation:

```text
(source_file
  (output
    value: (interpolated_string
      (string_fragment)
      (string_interpolation value: (variable name: (identifier)))
      (string_fragment))))
```

The function-like literal boundary has the same node types but different
fragment contents and ranges; require this source and tree too:

```smarty
{"Hello `strtoupper($name)`"}
```

```text
(source_file
  (output
    value: (interpolated_string
      (string_fragment)
      (string_interpolation value: (variable name: (identifier)))
      (string_fragment))))
```

Add a direct interpolated string as a modifier argument such as
`{$value|default:"id_{$item}"}`, an unchanged plain quoted string, and a
single-quoted `'$name'` case that remains an ordinary string. The
``{"Hello `strtoupper($name)`"}`` boundary case must not produce a function-call
interpolation: the function spelling and backticks are string fragments, and
only `$name` is a `string_interpolation`. Check its exact full-engine rendered
result shown above. Node checks must assert exact child order, fields, source
ranges, absence of errors, and reference acceptance for the fixtures. Keep each
reference fixture name tied to Smarty 5.8.4. The recorder cannot validate
interpolation values.

## Required composition, rejection, recovery, and edit checks

1. Test interpolation as an output value, a modifier argument, and a generic
   tag attribute value. Add a second tag attribute if the same fixture can
   demonstrate exact independent attribute ownership without obscuring trees.
   Use reference observations for syntax acceptance/event names and hand trees
   for structure. Update the distinct `Interpolated string (double-quoted)`
   row in [`docs/composition.md`](../composition.md): replace `no` with `yes`
   only for contexts that gain reviewed trees and checks, retain `?` for
   unprobed contexts, and keep plain `string` evidence separate. Check the
   full-engine output for both valid backtick cases above and for the
   function-like literal boundary.
2. Preserve the existing `string` shape for non-interpolated single- and
   double-quoted values. Do not treat single-quoted `$name` or `{$name}` as an
   interpolation form unless the pinned parser proves otherwise.
3. Malformed interpolation such as `{"Hello {$name"}{$after}` must localize
   recovery to the first output/string region and preserve `{$after}` as the
   following independent output sibling. Smarty 5.8.4 rejects this malformed
   form with `Unexpected "\"", expected one of: "}"`; it must not be treated
   as valid interpolation. The preferred editor tree retains the recognized
   output, string fragment, and variable, marks the missing interpolation
   closer, then preserves the following output sibling directly.
   The hand-authored recovery tree contract is:

   ```text
   (source_file
     (output
       value: (interpolated_string
         (string_fragment)
         (string_interpolation
           value: (variable name: (identifier))
           (MISSING "}"))))
     (output value: (variable name: (identifier))))
   ```

   This recovery shape keeps the error localized in the first output's
   interpolation, represents the absent `}` as a zero-width missing token,
   and preserves `{$after}` as the immediately following output sibling. A
   fresh focused check, `tree-sitter test --rebuild --show-fields --file-name
   interpolated-strings.txt --include 'Malformed interpolation preserves
   following output'`, confirmed that the earlier `(text)` sibling was extra:
   actual output contains the partial first output followed directly by the
   `{$after}` output. This check used `src/parser.c` SHA-256
   `fc14682db9f744ad16bcc468b3edd3e775724f2113cf4dbb3071126b8474a99a`. The
   corpus and Node check were added before grammar work; after implementation,
   this malformed expectation was corrected from a root `ERROR` to the
   evidence-backed partial tree because the parser retains more useful source
   structure without accepting the malformed Smarty input. Assert the missing
   token is within the first output, preserve the later output sibling, and
   separately assert that the pinned Smarty reference rejects the input and
   reports that it expected `}`.
4. Incrementally edit `{$value|default:"name"}{$after}` to
   `{$value|default:"name {$item->name}"}{$after}` and back. Compare the full
   edited snapshots against fresh parses and preserve the sibling output.
5. Add the manually written fixture and failing Node check before grammar work.
   A mismatch with pinned Smarty behavior must be resolved in the brief before
   implementation. Run the standard full `npm test` acceptance gate and
   same-hash corpus reports, inspect every newly clean template structurally,
   and report remaining errors. Never count interpolation swallowed as plain
   string text as support.

## Explicit boundaries

This task covers interpolation within a double-quoted string using the pinned
Smarty forms: direct variable token, braced supported `variablevalue` or
expression, and a backtick-delimited supported expression only when the opening
backtick is immediately followed by `$` and enters `TAGBODY`. Composition with
the subset of expressions already supported by this grammar is required; this
is not a claim of complete Smarty expression coverage. Preserve any parsed
method/function/member/index/metadata node structure inside an actual
interpolation. A function-like string such as `` `strtoupper($name)` `` does
not enter backtick expression mode; keep its function spelling as string text
and interpolate only the direct `$name` token. Backticks around a braced
interpolation such as `` `{$name}` `` remain literal string text.

Do not implement nested output or block tags inside strings, arbitrary plugin
execution, single-quoted interpolation, interpolation outside a quoted string,
arbitrary object/member semantics, or PHP runtime/string coercion. Smarty's
parser has `smartytag` inside doublequoted content, but that distinct construct
and its block-stack semantics are excluded pending separate source and corpus
review. Do not include bitwise operators, word aliases, nested `{$...}` array
index syntax, or literal blocks. These remain visible project gaps.

## Implementation evidence

Independent implementation review accepted Task 020 on 2026-10-01. `npm test`
passed all 195 Tree-sitter corpus cases and 277 Node
checks; all 14 deliberate mutations were caught. The malformed fixture retains
its missing-`}` partial tree and following output; Smarty 5.8.4 rejects it.
The focused dollar-boundary checks confirm `{"$$name"}` has a literal `$`
fragment followed by `$name` interpolation and renders `$world`; `{"$5$name"}`
preserves `$5` before the same interpolation and renders `$5world`. `{"$$"}`
and all prior `$`, `$!`, `$5`, and `Price $5` literal-string checks still pass.

The hash-matched report before this dollar-opener correction is
`/tmp/smarty-020-literal-after.json` (parser SHA-256
`e78f4d48555d5ffb4161181377fcbced01e850f2c2813b9cf5841eaa8fa717fc`, 467
templates, 416 clean, 51 failing). The current report is
`/tmp/smarty-020-dollar-opener-after.json` at parser SHA-256
`c8da5c7adf026718e115c87a735e339d4df7ae22cef4c9633b3b5eb4627ca4f1` (467
templates, 416 clean, 51 failing). It has no newly clean or newly failing
files relative to that report. Both reports cover the same 467 source files
and have identical per-file source hashes to the original baseline report.
Across the full task, 20 newly clean files were structurally reviewed and all
have visible interpolation nodes; none counted as clean solely by swallowing
interpolation text. The two most recent additions,
`action_types/action_value_checkbox.tpl` and
`action_types/action_value_dropdown.tpl`, retain method-call and variable
interpolation nodes plus ordinary neighboring `string` nodes.

Relative to the task's original baseline report at parser SHA-256
`bc07dada33635385d5ee4b4436c736ee1d5338d3603048e7bc005927cc5f6cc4` (396
clean, 71 failing), the final report has 20 additional clean files. The
remaining 51 failures are corpus evidence and are not claimed as supported by
this task.

## Task-creation review disposition

The brief was accepted after independent task-creation review. During
implementation, pinned Smarty 5.8.4 evidence corrected the backtick boundary
and malformed recovery tree. The malformed input is rejected by Smarty with an
expected-`}` syntax error; the parser's partial tree retains the recognized
interpolation, marks the missing closer, and preserves the following output.
The earlier root-`ERROR` expectation was replaced with this source-confirmed
tree. A later lexer-boundary probe added literal-dollar content and
digit-prefixed IDs to the accepted scope: dollars not followed by Smarty `id`
remain in the existing `string` node, while `$5a` and `$5_` interpolate only
within double-quoted strings. These corrections preserve the 23 confirmed
earliest-error contexts and do not predict corpus gains. Final implementation
review accepted the tested scope and left unquoted `{$5a}` as a separate
follow-up gap.

The task creator recommends prioritizing this
source-confirmed interpolation family over the smaller 10-file bitwise cluster
because it blocks common dynamic HTML attributes, include/config paths, and
string expressions across multiple grammar contexts. This is a prioritization
judgment, not a claim that a no-error parse proves coverage.
