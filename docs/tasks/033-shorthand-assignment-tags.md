# 033 — Shorthand assignment tags

**Status:** complete; independent implementation review accepted on
2026-10-03. The recovery-contract amendment was also accepted by task-creation
review.
**Type:** standard Smarty 5 assignment-tag syntax.
**Depends on:** [001 config variables](001-config-variables.md),
[007 index access](007-index-access.md), [010 array literals](010-array-literals.md),
[011 standalone function calls](011-standalone-function-calls.md), and
[022 static identifier expressions](022-static-identifier-expressions.md).

## Corpus motivation and compiler evidence

The hash-matched report `/tmp/smarty-task032-after-application.json` is for
parser hash `0f6fca2d…`, with 457/467 application files clean and 10 still
failing. Two error locations are confirmed instances of Smarty shorthand
assignment tags:

- `corpus/application/message.tpl:2` — `{$type = 'ok'}`. The report entry is
  `ERROR [27,43)`, line 2, column 5. The preceding minimized condition
  `{if not isset($type)}` already has a structured tree and is accepted. Task
  031 also documents this later assignment as the reason the file remains
  failing.
- `corpus/application/mails/action_type_instruction_mail.tpl:32` —
  `{$more = true}`. The report entry is `ERROR [1465,1497)`, line 32,
  column 17, in the assignment's surrounding recovery span.

The pinned Smarty 5.8.4 parser explicitly has `tagbody ::= DOLLARID eqoutattr`
and `tagbody ::= varindexed eqoutattr` productions that translate to the
built-in `assign` tag (`vendor/smarty/smarty/src/Parser/TemplateParser.y:362-368`).
Its `eqoutattr` and `outattr` routes accept the assignment value and trailing
attributes (`:371-375`). This is corroborated independently: `reference.php`
records `{ $name = $value }` as an `assign` event with `value` and `var`
arguments; it also accepts `{ $names[0] = $value }`. The fixed full Smarty
compiler successfully compiles both examples, including
`{$name = $value|escape}` and an optional trailing `nocache` attribute. These
are compiler-syntax observations, not claims about application-specific
variables or plugin execution.

The upstream Smarty core report is separate from the application report (29/33
clean, 4 errors). Task 028 identified two official core fixtures,
`027_foreach.tpl` and `028_foreach.tpl`, whose first parse error is at the same
`{$x = ...}` form. They are pinned Smarty parser/compiler fixtures, though not
members of the selected 33-file positive manifest. The upstream demo remains
separately reported at 0/1 clean.

The other application errors are independent leads, not evidence against this
assignment diagnosis. The two admin templates and cable-label template contain
nested-brace index forms accepted by the pinned compiler; `view_orders/new_article.tpl`
contains an `array(...) + ...` tag value accepted by the compiler. The two
statistics templates also contain `neq`, another standard operator gap, but
that is a separate expression-family task. Errors near `@ucfirst` may depend on
application modifier/plugin availability; the recording adapter deliberately
bypasses that resolution. Other lexical hints overlap with failures and are not
causal evidence by themselves.

### Triage of all ten remaining application files

This triage uses the report's error ranges, source at those locations, and
minimized pinned-compiler checks. A parser error is evidence of a grammar gap,
not evidence that Smarty rejects the source.

| Failing file | Reported evidence | Classification |
| --- | --- | --- |
| `mails/action_type_instruction_mail.tpl` | Line 32, column 17; `{$more = true}` | Confirmed standard shorthand assignment gap; minimal form records `assign` and compiles. |
| `message.tpl` | Line 2, column 5; `{$type = 'ok'}` | Confirmed same assignment gap. `{if not isset($type)}` itself parses; assignment remains the blocker. |
| `view_admin/module_types/search_module_type.tpl` | Lines 45-46; nested braced constants inside bracket indices | Separate grammar gap. Minimized nested-brace index compiles under pinned Smarty; lexical config/member hints are not the diagnosis. |
| `view_admin/name_list/search_name_list.tpl` | Lines 54-55; nested braced method/index expressions | Separate grammar gap. Equivalent minimized source compiles under pinned Smarty. |
| `view_certificate/actions_list.tpl` | Line 41; nested `{...}` condition; later line 54 recovery | Separate gap: `if {$...}>0` compiles in isolation. The full file also hits a missing application modifier during engine compilation, which does not refute the syntax observation. |
| `view_labels/cable_label.tpl` | Line 35; `selected={...}` with nested-brace dynamic dot/index | Separate grammar gap. Minimized complete `html_options` syntax compiles; plugin behavior is not claimed. |
| `view_orders/new_article.tpl` | Line 5; `options=array(-1=>" ")+$yes_no_options` | Separate grammar gap. The pinned compiler accepts the minimized array-plus-variable attribute value. |
| `view_stats/action_chart.tpl` | Line 46 (`neq`), then line 49 recovery | The line 46 expression is a confirmed standard word-comparison gap; the later error is recovery fallout until independently reproduced. |
| `view_stats/charts.tpl` | Four occurrences of `{$xlabel_string|@ucfirst}` / `{$ylabel_string|@ucfirst}` | Separate modifier-prefix syntax lead. Recorder accepts the syntax; full engine reports unknown modifier `ucfirst` without the app's modifier setup, so runtime/plugin validity remains unknown. |
| `view_stats/stats.tpl` | Line 60 (`neq`), then line 63 recovery | The line 60 expression is the same standard word-comparison gap; the later error is recovery fallout until independently reproduced. |

No reviewed example is proven invalid by the pinned Smarty parser/compiler.
The unknown `ucfirst` modifier is an environment/plugin resolution issue, not a
Smarty syntax rejection. The report contains overlapping lexical hints, but
they do not establish causes for these ten failures.

## Scope and tree contract

Model Smarty's shorthand assignment form as a distinct `assignment_tag`, not
as an ordinary printed `output` or a generic custom tag. The node has an
explicit `target` field and a `value` field. The target preserves the existing
variable or index-expression structure; the value preserves the existing full
expression and modifier structure. The only supported trailing assignment
option is `nocache`, either bare or valued; it remains an `attribute` child.
The pinned compiler rejects arbitrary trailing attributes such as `foo`,
`nofilter`, `max=2`, and `data-id="x"`, so the assignment grammar must reject
those forms. `nocache=true` is independently confirmed accepted; compiler
validation still rejects invalid flag values such as `$flag`. The assignment node must retain
its braces/tag extent, and must not manufacture output for the assignment value.

For the corpus-minimized form:

```smarty
{$type = 'ok'}
```

```text
(source_file
  (assignment_tag
    target: (variable name: (identifier))
    value: (string)))
```

For an indexed target and composed value:

```smarty
{$names[$index] = $source|escape}
```

```text
(source_file
  (assignment_tag
    target: (index_expression
      object: (variable name: (identifier))
      index: (variable name: (identifier)))
    value: (modifier_expression
      value: (variable name: (identifier))
      name: (identifier))))
```

Confirm exact punctuation and modifier fields against existing tree conventions
when adding the hand-authored fixture. The `reference.php` projection should
observe the translated built-in `assign` tag and its argument names. This
corroborates compiler acceptance only; the expected trees define target/value
structure and source ranges.

## Boundaries and composition

- Cover direct variable targets and nonempty indexed targets whose index
  expressions are already supported by Task 007. Do not invent new index
  syntax in this task.
- The pinned compiler accepts `{$names[] = $value}` (empty append index) and
  `{$names[key] = $value}` (bare identifier index). These are standard syntax,
  not invalid forms. They remain explicit project gaps in [Task 007](007-index-access.md)
  and the Dot/index inventory row; do not claim Task 033 or the existing index
  grammar supports or rejects them. A later task must add structural trees for
  the access and assignment contexts.
- The right side uses supported expression syntax, including a simple string or
  variable, an array/call expression, and a modifier composition. Preserve
  expression details; do not reduce the value to text.
- Preserve trailing attributes as tag attributes where Smarty accepts them;
  include at least `nocache` from the pinned compiler observation. Do not add
  assignment runtime semantics to the tree contract.
- Distinguish a single assignment `=` from existing comparison operators and
  from malformed/incomplete input. A normal output such as `{$a == $b}` keeps
  its current output-expression tree.
- Assignment is a tag-level form, not a binary operator in expression
  precedence. Verify that supported expressions in the RHS retain their
  existing operator grouping (for example `{$name = $a + $b}`) and that the
  following `{$a == $b}` remains an ordinary output comparison. The target
  expression ends at `=`; the RHS begins after it.
- Do not add `list(...)`/destructuring assignment, reference assignment,
  increment/decrement targets, or new custom-tag assignment semantics. If
  pinned Smarty accepts any such form, record it as an explicit follow-up gap;
  the project target still includes standard Smarty syntax.
- Do not use generic text or tag fallback to accept assignment forms.
- Assignment RHS is a new composition context. Keep the `Assignment RHS`
  column in [`docs/composition.md`](../composition.md) unknown at brief stage.
  Add trees and checks for variable, primitive/string, parenthesized or
  arithmetic expression, array/call, and modifier RHS forms; after evidence,
  promote only the cells that those fixtures actually exercise. Leave all
  other expression-form cells `?`.

## Failing-first trees and checks

Before grammar changes, add manually specified expected trees and a dedicated
Node check. Cover:

1. Simple variable assignment to a string, number, boolean, variable, and
   parenthesized/full expression; exact tag, target/value fields, and ranges.
2. Indexed targets using supported static and variable indices, and RHS values
   using arrays, calls, and modifiers. Include the corpus witnesses
   `{$type = 'ok'}` and `{$more = true}`.
3. Composition before and after independent output, inside a supported block,
   and adjacent to a comment. Verify assignment creates no `output` node while
   the following `{$name}` remains an `output` node.
4. Optional bare and valued `nocache`, checked against pinned Smarty
   acceptance and represented explicitly. Full-engine checks reject arbitrary
   or extra trailing attributes; do not inherit generic tag attributes.
5. Distinction from ordinary output comparison, equality-like RHS expressions,
   bare variable output, and generic tags whose content resembles assignment.
6. Malformed recovery in an enclosing block, using these exact cases:

   ```smarty
   {if $ok}{$name =}{* keep *}{$later}{/if}
   {if $ok}{$name $value}{* keep *}{$later}{/if}
   ```

   Smarty 5.8.4's full compiler rejects the first with `Unexpected "}"` and
   the second with `too many shorthand attributes`. The recording adapter does
   not reproduce the second rejection (it records an output event), so use the
   controlled full engine for the compiler-rejection assertion. Hand-author
   expected recovery trees before grammar changes. Tree-sitter does not let a
   grammar production create a genuine `ERROR` node by alias: an aliased node
   is ordinary syntax and does not set `TSNode.isError`. The required shape is
   therefore a partial `assignment_recovery` node with the hidden
   `_output_attribute_error_marker`, which Tree-sitter reports as a missing
   token and which sets `hasError`. This retains parsed assignment pieces and
   keeps the surrounding `if_block`, comment, later output and `if_close_tag`
   as navigable siblings. The exact first-case contract is:

   ```text
   (source_file
     (if_block
       (if_tag condition: (variable name: (identifier)))
       (assignment_recovery
         (variable name: (identifier))
         (MISSING _output_attribute_error_marker))
       (comment)
       (output value: (variable name: (identifier)))
       (if_close_tag)))
   ```

   The extra-shorthand case must also have a hand-authored tree with the two
   variables under `assignment_recovery` and the same preserved siblings:

   ```text
   (source_file
     (if_block
       (if_tag condition: (variable name: (identifier)))
       (assignment_recovery
         (variable name: (identifier))
         (variable name: (identifier))
         (MISSING _output_attribute_error_marker))
       (comment)
       (output value: (variable name: (identifier)))
       (if_close_tag)))
   ```

   For each recovery fixture, the Node check must assert `root.hasError`, the
   enclosing `if_block` and `if_close_tag`, a comment node containing `keep`,
   and a later output whose value text is `$later`. Assert that the recovery
   node itself has an error state; do not accept a tree that hides any of these
   neighbors inside it.

   For malformed targets, also check these exact cases:

   ```smarty
   {if $ok}{$names[ = $value}{* keep *}{$later}{/if}
   {if $ok}{$user->name = $value}{* keep *}{$later}{/if}
   ```

   Smarty rejects the first with `Unexpected "= "`; it rejects the second
   with `Unexpected " = ", expected one of: "}"`. A member expression is not
   a supported `varindexed` assignment target. Hand-author these recovery trees
   with `assignment_recovery` covering the malformed target and the hidden
   error marker:

   ```text
   (source_file
     (if_block
       (if_tag condition: (variable name: (identifier)))
       (assignment_recovery
         (variable name: (identifier))
         (variable name: (identifier))
         (MISSING _output_attribute_error_marker))
       (comment)
       (output value: (variable name: (identifier)))
       (if_close_tag)))

   (source_file
     (if_block
       (if_tag condition: (variable name: (identifier)))
       (assignment_recovery
         (member_expression
           object: (variable name: (identifier))
           member: (identifier))
         (variable name: (identifier))
         (MISSING _output_attribute_error_marker))
       (comment)
       (output value: (variable name: (identifier)))
       (if_close_tag)))
   ```

   Assert all retained nodes and `root.hasError`, so an error span cannot
   swallow the neighbor or closer. Include an edit sequence that turns
   a valid assignment into a missing-RHS state, repairs it, and compares full
   incremental snapshots against fresh parses at every state. Also edit a
   valid assignment RHS across variable/literal boundaries and restore it.
7. `fixtures(filename)` reference cases for valid assignments. Add a fixed
   full-engine render proving that an assignment updates a variable used by a
   following output, and a compile-only fixed case for `nocache`. The recorder
   checks event structure only; no arbitrary corpus template or plugin runs
   through the full engine.

The minimal reference observation is:

```smarty
{$name = $value}{$name}
```

It must report `assign` followed by `output`; the hand-authored tree must show
`assignment_tag` followed by `output` with no swallowed value or text fallback.
Use compiler/runtime values supplied by the fixed test only, not application
objects.

## Acceptance and evidence

The implementation must pass the entire `npm test` gate. Preserve separate
hash-matched reports for `corpus/application/`,
`corpus/upstream-smarty-v5.8.4-core/`, and
`corpus/upstream-smarty-v5.8.4-example/` outside `build/`. Compare identical
source hashes, inspect every newly clean application tree for explicit
assignment target/value structure, and report remaining failures and
regressions. No whole-file clean gain is promised; each witness may contain
additional syntax gaps.

## Implementation evidence (pending independent completion review)

- Supported `assignment_tag` has `target` and `value` fields. Trees cover
  direct variable targets and nonempty static/variable bracket indices; RHS
  trees cover strings, numbers, booleans, variables, parenthesized and
  arithmetic/equality expressions, arrays, calls and modifiers. Bare and
  valued `nocache` are retained as direct `attribute` children with normal
  name/value fields. Arbitrary trailing options are rejected, matching
  full-engine checks; duplicate `nocache` is accepted by Smarty. Assignment
  does not create output. Empty append and bare identifier bracket targets
  remain explicit gaps.
- Recovery trees use `assignment_recovery` with the genuine hidden
  `_output_attribute_error_marker` missing-token state. The four fixed cases
  preserve the if block, comment, later `$later` output and if closer as
  navigable siblings. Full Smarty 5.8.4 rejects each malformed source as
  described above; the recorder's limitation for the extra shorthand case is
  tested through the full engine.
- Pinned compiler contract correction: Task 007 had listed `{$a[0]=1}` as a
  malformed index expression because its scope covered read access only. The
  recorder accepts it as the built-in `assign` event, and the full compiler
  compiles it. The old failure assertion was removed and replaced with a
  hand-authored indexed `assignment_tag` tree and compiler checks. Task 007 now
  records assignment as unimplemented at that task's boundary, not invalid
  Smarty syntax.
- Compiler-option observations: pinned Smarty 5.8.4 compiles `nocache=true` and
  duplicate `nocache`, but rejects arbitrary names (`foo`, `nofilter`), valued
  attributes (`max=2`, `data-id="x"`), and an extra attribute after `nocache`.
  The parser therefore accepts only the recognized `nocache` form(s).
  `nocache=$flag` has valid syntax but the full compiler rejects its flag value;
  this is tested as a compiler-only limitation, not forced into a parse error.
- Commands: `npm test` passes 295 hand-authored Tree-sitter trees, 417 Node
  checks, and all 18 deliberate grammar mutations. The focused command
  `node --test test/shorthand-assignment-tags.test.mjs` passes 9/9. The
  captured full-gate log is `/tmp/smarty-task033-final-npmtest.log`.
- Parser source hash for all refreshed reports: `6e97d1d82dc5e54073648e255de1ed48034f528a09b40f97d28770204c4f8e20`.
  Separate reports use identical source-file hashes to the Task 032 reports:
  application 457/467 → 459/467 clean, core 29/33 → 31/33 clean, and demo
  unchanged at 0/1. There are no same-hash regressions.
- Newly clean application files are `mails/action_type_instruction_mail.tpl`
  and `message.tpl`; each has one structurally explicit `assignment_tag`
  (variable target, boolean or string RHS) and surrounding nodes remain
  structured. Newly clean core files are `027_foreach.tpl` and
  `028_foreach.tpl`; each has one explicit variable-target/string-value
  assignment, followed by nested foreach structures. No newly clean demo file.
  The remaining application failures are 8/467; the project completion gate
  remains zero application errors with structurally reviewed newly clean trees.
- Refreshed reports: `/tmp/smarty-task033-final-application.json`,
  `/tmp/smarty-task033-final-upstream-core.json`, and
  `/tmp/smarty-task033-final-upstream-example.json`. Their SHA-256 hashes are
  `4a29c151d56d0e1d9b8814796f532d7f372ad21a2bbc1b535d420717f99f3d1a`,
  `e55ad4bb58e16b94001787f7f2dea807e9bcf13a633b004f0db2e27ffa157be0`, and
  `d82abc44f756c18440d3f44574c6984a480106fb2b5d2f7a715baa3e9d4c82be0`, in
  that order. All three report the same parser hash and there are no
  same-source regressions relative to Task 032.

This task does not claim full corpus completion or assignment runtime/plugin
semantics. Standard Smarty syntax coverage remains the project target.
Independent completion review verified the final parser hashes, 295/295 trees,
417/417 Node checks, 18/18 caught mutations, the Task 007 correction, the
composition matrix, all four newly clean trees, and separate hash-matched
reports without regressions.
