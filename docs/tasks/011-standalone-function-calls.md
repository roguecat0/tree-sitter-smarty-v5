# 011 — Standalone function calls

Status: complete (2026-09-30). Independent implementation review accepted.
Brief accepted (2026-09-30). Dependencies: 001–010; array literals from 010 are used
as call arguments. Task creation owner: residual hash-matched corpus report
`/tmp/smarty-array-after.json`, `grammarSha256`
`0304cbe4b50d712ce545362f5679fcd1ebb3e78648dadb667589a5c8a82e5f64`.

## Motivation and corpus evidence

The post-010 report has the same hashes for all 467 Smarty-accepted corpus
sources as its baseline: 99 clean and 368 failing. Standalone calls are a
confirmed high-value cluster within those failures. For example,
`corpus/application/action_types/action_value_afmelden.tpl:45` contains
`action_date=date($dateformat,$action->get_date())` and
`{if !$value_type->no_to_textbox() && is_valid_id($value_type->get_to()->get_id())}`;
the residual report records errors at line 45, columns 114 and 119, within the
`is_valid_id` call. The separate
`corpus/application/action_types/instruction_changed.tpl:1` begins
`{if in_array($action->get_action_type_id(),$new_instruction_action_type_ids)}`
and also reports errors on the call name and arguments. Similar snippets show
calls such as `isset`, `intval`, `date`, `in_array`, and `is_valid_id` across
many failing templates. These lexical/report snippets are triage evidence, not
a full frequency claim or proof that every such error has one cause.

The minimized expression `{if is_valid_id($id)}ok{/if}` is accepted by the
pinned Smarty 5.8.4 recording compiler and retains `if`/`ifclose` events, but
the current grammar reports an error at `is_valid_id`. The minimized tag value
`{widget value=is_valid_id($id)}` is likewise accepted as a tag with a named
argument, while the current parser reports an error at the call name. The
report's unminimized example in `action_value_afmelden.tpl` is a useful source
for calls nested around already-supported method calls.

## Scope

Add expression calls to statically named, unqualified ASCII identifiers, with
zero or more ordinary comma-separated arguments drawn from the current full
expression subset. Arguments retain complete expression structure and order.
Calls are primary expressions: they compose with existing operators, modifiers,
arrays, method calls inside arguments, and the established output, condition,
unknown-tag positional/named argument, and modifier-input contexts.

The call node is `function_call_expression` with `name: (identifier)` and zero
or more repeated `argument` fields. Parentheses and commas are anonymous
punctuation. Do not encode the callee as a modifier or flatten arguments into a
parenthesized expression. Calls in unknown-tag arguments must remain nested
under the argument/attribute `value` and preserve their full expression trees.

Smarty treats a bare tag-shaped `{name(args)}` as a function expression/output,
not as an unknown custom tag whose argument is a parenthesized expression.
This task therefore classifies `{f(1)}` and `{widget ($a > 0)}` as `output`
nodes whose `value` is a `function_call_expression`. Bare `{widget}` and actual
tag forms such as `{widget value=("x")}` remain custom tags. This boundary
correction does not introduce an allowlist of application tag names.

The existing 005 fixture `Operators in unknown tags and modifier arguments`
(`test/corpus/condition-operators.txt:151-153`) is not a minimal boundary
example: its source is
`{widget ($a > 0) enabled=!$b value=$a|decorate:($b || #enabled#)}{*ignored &&*}{/other}`.
Smarty's `outattr ::= output attributes` production (`TemplateParser.y` around
line 375) permits the two attributes after a function output, so changing only
that fixture's root to `output` would lose or misstate its attribute tree. The
implementation should split this case: add the minimal
`{widget ($a > 0)}` function-output tree; retain attribute/operator composition
in the already reference-backed generic-tag fixture at
`test/corpus/condition-operators.txt:165-167`
(`{widget $a > 0 enabled=!$b value=$a|decorate:($b || #enabled#)}`); and retain
the original fixture's comment and independent `{/other}` closer in generic-
tag context (they may be appended to that generic-tag fixture or kept as a
separate manually specified tree). Do not discard either attribute, the
comment, or the independent closer.

The original 151-153 source is Smarty-valid output-attribute syntax, not a
generic tag. Trailing attributes on function output are deferred from this
task and remain a project gap. Preserve the complete original source as a
negative/recovery case: the grammar must report an error at the unsupported
attributes rather than silently classify the call as a `custom_tag` or swallow
the attributes. The following comment and independent close tag must still
recover as their own nodes. This task does not assert that Smarty rejects the
source. A later output-attributes task may support it, but it needs an explicit
tree contract and independent structural checks.

Limit this task to unqualified static identifier callees. Namespaced calls,
variable/dynamic callees, static `::` calls, function-result property/method
chains, assignment/reference arguments, argument unpacking, plugin resolution,
arity validation, and runtime behavior are excluded. Some excluded forms are
valid Smarty or PHP syntax and remain visible project gaps; do not label them
invalid based only on this brief. Do not change the established method-call
receiver contract except for any composition strictly required by an accepted
call argument example.

## Hand-authored tree sketches

The direct-call output classification and node shape are structural
requirements:

```smarty
{is_valid_id($id)}
```

```text
(source_file
  (output value: (function_call_expression
    name: (identifier)
    argument: (variable name: (identifier)))))
```

Calls should compose with the current condition operators and method calls,
while an array literal passed as a second argument keeps its existing element
fields:

```smarty
{if is_valid_id($item->get_id()) && in_array($state, [$open, $closed])}ok{/if}
```

```text
(source_file
  (if_block
    (if_tag condition: (binary_expression
      left: (function_call_expression
        name: (identifier)
        argument: (method_call_expression
          object: (variable name: (identifier))
          method: (identifier)))
      operator: "&&"
      right: (function_call_expression
        name: (identifier)
        argument: (variable name: (identifier))
        argument: (array_literal
          (array_element value: (variable name: (identifier)))
          (array_element value: (variable name: (identifier)))))))
    (text)
    (if_close_tag)))
```

An unknown tag's value must also keep the same call node rather than converting
it to generic text or a modifier:

```smarty
{widget value=in_array($id, [$open, $closed])}
```

```text
(source_file
  (custom_tag name: (identifier)
    (attribute name: (identifier) value: (function_call_expression
      name: (identifier)
      argument: (variable name: (identifier))
      argument: (array_literal
        (array_element value: (variable name: (identifier)))
        (array_element value: (variable name: (identifier))))))))
```

The feature tree set should additionally cover empty-argument calls, multiple
arguments, nested calls, a call used as a modifier input, and a call with a
modifier applied to its result. Use only supported expressions as arguments.

## Reference boundary (Smarty 5.8.4)

The pinned `vendor/smarty/smarty/src/Parser/TemplateParser.y` defines
`value ::= function` at about line 772 and `function ::= ns1 OPENP variablelist
CLOSEP optobjectchain` around line 1129. `ns1` accepts `ID` and `NAMESPACE`;
`variablelist` accepts empty lists, variables, and comma-separated variables or
expressions. The compiler routes non-`isset`/`empty` names through
`compileModifierInExpression`; the recording adapter can therefore report a
modifier event for a function call. That event is evidence of compiler
acceptance and surrounding output/tag order, not an independent projection of
callee kind, argument values, or runtime/plugin behavior. Hand-authored trees
are the contract for call node shape and argument binding.

The recorder accepts `{is_valid_id($id)}`, `{if is_valid_id($id)}ok{/if}`,
`{if in_array($id, [$a,$b])}ok{/if}`, and
`{widget value=is_valid_id($id)}`. It also accepts the bare function-output
forms `{f(1)}` and `{widget ($a > 0)}`; each produces a modifier event followed
by an output event. This observation corrects the generic-tag interpretation
currently recorded in the 005 completion evidence for these call-shaped forms.
The recorder rejects a trailing argument comma, for example
`{if is_valid_id($id,)}ok{/if}`. It accepts a leading comma in a call's
`variablelist` (for example `{if is_valid_id(, $id)}ok{/if}`); keep that form
outside the supported ordinary-list tree subset and record the discrepancy
instead of treating recorder acceptance as evidence that it is a useful AST.

Smarty's function production also accepts namespace names and an optional
object chain after the call; both remain outside this task. The recorder's
modifier event does not justify implementing those forms or executing custom
functions.

## Acceptance work

1. Before grammar changes, hand-write `test/corpus/standalone-function-calls.txt`
   and add `test/standalone-function-calls.test.mjs` with failing tree checks.
   Include the two minimized expression examples above, direct function-output
   classification, zero/multiple arguments, nested calls, and exact `name` and
   repeated `argument` fields. Assert `{f(1)}` is output, while `{widget}` and
   `{widget value=("x")}` remain generic tags. Explicitly split 005's
   `Operators in unknown tags and modifier arguments` fixture: replace its
   call-shaped classification case with minimal `{widget ($a > 0)}` output
   coverage, retain `{widget $a > 0 enabled=!$b value=$a|decorate:($b ||
   #enabled#)}` as generic-tag attribute/operator coverage, and preserve the old
   fixture's comment plus `{/other}` independent closer in generic-tag context.
   Also test the full old function-output-with-trailing-attributes source as
   Smarty-valid but task-unsupported input: require a parser error at the
   attributes (never a `custom_tag` or swallowed expressions), with the
   comment and independent close node recovered afterward. Do not change any
   other 005 expectation. Record the compiler observation that justifies both
   the call classification and the valid-but-deferred status of output
   attributes.
2. Check composition in output, `if`/`elseif`, an unknown tag's positional and
   named arguments, call arguments containing supported methods/arrays, and
   modifier input/result positions. Use `fixtures('standalone-function-calls.txt')`
   for the valid reference examples. Assert call node types, fields, order,
   identifier spelling, punctuation, and source ranges independently of the
   recorder projection.
3. Check precedence with arithmetic/comparisons, unary and modifier binding.
   Preserve existing method call argument trees and custom-tag details. No broad
   bare-word fallback may be used to recognize a function name.
4. Add separate malformed/recovery checks for a missing close parenthesis, a
   missing expression inside an argument (for example,
   `is_valid_id($id + )`), and a trailing comma. Require parser
   errors and preserve a valid neighboring output/tag; verify the recorder
   rejects the trailing-comma example. If checking a leading comma, require the
   grammar's chosen useful recovery behavior but document that the recorder
   accepts it. Add an edit crossing the call boundary (for example, insert and
   delete the call parentheses/name) and compare full incremental snapshots
   against fresh parses through error and repair.
5. Add a focused mutation if name/argument loss or direct output/tag
   misclassification can escape the explicit trees; name the distinct defect it
   catches. Do not modify generated sources or Smarty vendor files.
6. Run `npm test` and hash-matched before/after corpus reports outside `build/`.
   Inspect all newly clean trees for explicit `function_call_expression` nodes
   and fields, and investigate regressions. Do not remove or narrow any of the
   467 accepted corpus inputs to improve the result.
7. Update the contract, feature row, task status and evidence with exact
   commands/results, the changed 005 expectation and its Smarty observation,
   recorder limits, and remaining namespace/dynamic/chained-call gaps. Do not
   claim runtime function/plugin behavior from structural parsing.

## Brief review round 1

Disposition: accepted. The original 005 fixture at lines 151-153 includes the
parenthesized expression, two attributes, a comment, and an independent closer;
Smarty's `outattr` production means those cannot be dropped or treated as a
simple root-node correction. The acceptance plan now splits out minimal
`{widget ($a > 0)}` output coverage, retains the existing generic-tag
attribute/operator fixture at lines 165-167, and explicitly preserves the
comment and closer in generic-tag context. It excludes trailing attributes on
function-output nodes unless implementation adds and verifies that separate
tree contract.

## Brief review round 2

Disposition: accepted. Trailing attributes on function output are explicitly
identified as Smarty-valid but deferred syntax and a project gap. The complete
old 005 source is now a required negative/recovery check: unsupported
attributes must not be swallowed or misclassified as a custom tag, while the
comment and independent close are recovered. The feature inventory's output
boundary now records this remaining gap.

## Handoff decisions for review

- Proposed priority: residual error snippets in 171 distinct failing files
  mention at least one of `is_valid_id`, `date`, `intval`, `in_array`, or
  `isset` followed by `(`. This is a bounded-name lexical triage count, not a
  full function-call frequency claim. Exact corpus examples and minimized
  compiler-accepted failures above confirm this is a grammar gap.
- Proposed scope fixes unqualified static calls and corrects the existing
  direct `{name(args)}` boundary to output. Review whether the brief should
  include only ordinary names and whether function-result chains should stay a
  later task.
- Project exclusions remain explicit: namespaced/dynamic callees and
  function-result property/method chains are not language-invalidated.
- The 004 negative assertion for `{$a->f(f(1))}` was superseded by the accepted
  full-expression argument scope here. Smarty 5.8.4's recorder accepts this
  exact source; the hand-authored tree now preserves the outer method call and
  its nested standalone `function_call_expression` argument. The recorder emits
  an `f` modifier event and an output event, but it cannot distinguish the
  nested function from the outer method call or verify their runtime behavior.

## Implementation evidence (2026-09-30)

- Added ten manually specified call trees in
  [standalone-function-calls.txt](../../test/corpus/standalone-function-calls.txt)
  for direct and tag-shaped outputs, empty/multiple arguments, nested condition
  and array calls, unknown-tag arguments, modifier composition/arguments,
  prefix/binary precedence, and an `elseif` call condition.
  The focused checks in
  [standalone-function-calls.test.mjs](../../test/standalone-function-calls.test.mjs)
  assert callee/name and nested argument ranges, anonymous delimiters, nested
  `is_valid_id` spelling, repeated argument order, output versus generic-tag
  classification, malformed calls, trailing-comma rejection, unsupported output
  attribute error recovery, and full incremental/fresh snapshot equivalence.
- `npm test` was run before grammar changes and failed on the new call trees as
  intended. The review revision adds one Node check for two Smarty-rejected
  suffix forms. Parent-context `npm test` passes with **118/118** corpus trees,
  **168/168** Node checks, and all **11** deliberate mutations caught;
  `git diff --check` passes. The ten fixture projections agree with Smarty
  5.8.4. Function calls appear in the recorder as modifier events; the
  recorder counts arguments after the first as modifier parameters and does
  not validate runtime calls.
- Command `npm run corpus:report -- ./corpus/application /tmp/smarty-011-final-after.json`
  produced a parser hash-matched report for the final generated parser.
  Its parser hash is `367c09919242b1359f6b0431ad126e3baca253494292a590fb17d8374a9dcdfa`
  (matches `src/parser.c`).
  Compared with `/tmp/smarty-array-after.json`, the reports have identical
  source hashes for all **467/467**
  accepted templates and no regressions: **99 → 135** clean, **368 → 332** with
  errors. The 36 newly clean files were structurally inspected with the Node
  binding; each has explicit `function_call_expression` nodes with callee names
  and argument fields. Examples include `is_valid_id` around method calls,
  `in_array` with arrays, `isset`, `empty`, `date`, `str_replace`, and `time`.
  The exact file list and extracted call names/argument node types are saved in
  `/tmp/smarty-011-review.json`; reports remain outside the repository.
- The 005 fixture change is a reviewed expectation correction: its old source
  `{widget ($a > 0) enabled=...}` is accepted by Smarty as function output with
  trailing attributes. Coverage is split into minimal `{widget ($a > 0)}` output
  evidence, generic-tag operator/attribute coverage using
  `{widget $a > 0 enabled=... value=...}`, and the full old source as an error
  recovery case preserving its comment and independent `{/other}` closer. The
  error tree retains `function_call_expression` as output value and captures the
  entire trailing attribute span in one `ERROR` node; the focused test checks
  the exact error range and recovered siblings. An external token that the
  scanner never emits makes this unsupported branch carry a real missing-token
  error without requiring any source spelling. Two Smarty-rejected tilde suffix
  reproducers assert that no suffix can make those attributes parse cleanly.
  Smarty's recorder accepts that full old source; trailing output attributes
  remain an explicit grammar gap. No accepted corpus inputs were removed.
- Remaining scope gaps include namespaced and dynamic callees, static `::`
  calls, function-result chains, unusual argument forms, and trailing output
  attributes. This task establishes structural parsing only, not runtime or
  plugin behavior.
- Final review documentation disposition: removed `standalone calls` from the
  contract's unsupported-syntax list because this task now supports unqualified
  static calls. The list retains dynamic member access; remaining function-call
  exclusions stay in the detailed call contract above.
- The independent completion reviewer accepted the revised implementation after
  two rounds. The final review verified the never-emitted recovery marker,
  exact trailing-attribute error span and sibling recovery, both tilde rejection
  regressions, 004/005 expectation corrections, all requested structural and
  edit checks, current generated source, `npm test`, and the hash-matched corpus
  evidence. One final documentation contradiction was corrected and rechecked.
