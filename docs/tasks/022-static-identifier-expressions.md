# 022 — Static identifiers as expression values

Status: implementation review accepted; awaiting orchestrator completion and
commit. Scope clarification accepted before implementation. Dependencies: 017
static modifier identifiers and 018 generic-tag identifier values.

## Motivation and corpus evidence

The fixed 467-template report `/tmp/smarty-021-after.json` has parser SHA-256
`95573b2032d5c0621d34d59f35e061ee6137333c07e96031e4936ffe0468e6d4`, matching
`src/parser.c` at HEAD `8a137de`; it reports 428 clean and 39 failing files. I
inspected the earliest error in every failing file. Thirteen earliest errors
are static Smarty `ID` tokens where the grammar currently requires an
expression value: eight comparison operands in conditions/outputs and five
method/function arguments. The exact corpus roots are:

| Path | Earliest unsupported ID | Context | Earliest error coordinate and span |
| --- | --- | --- | --- |
| `action_types/action_value_replace_part.tpl` | `REPLACE_PART_DISPLAY_NORMAL` | comparison operand | line 1, column 36; UTF-16 `[35,64)` (span starts at `==`) |
| `index.tpl` | `USER_FLAG_SIMPLE_TEMPLATE` | condition operand | line 74, column 61; UTF-16 `[4511,4536)` |
| `init_jqui.tpl` | `USER_FLAG_SIMPLE_TEMPLATE` | condition operand | line 8, column 25; UTF-16 `[225,250)` |
| `view_admin/action_types/search_action_type.tpl` | `GROUP_NAME_NONE` | method argument | line 36, column 53; UTF-16 `[3387,3402)` |
| `view_admin/action_types/triggers_table.tpl` | `GROUP_NAME_NORMAL` | method argument | line 24, column 60; UTF-16 `[3467,3484)` |
| `view_admin/module_types/edit_label_template_dialog.tpl` | `GROUP_NAME_FULL` | method argument | line 2, column 194; UTF-16 `[202,219)` (span starts at `, `) |
| `view_admin/users/view_user_rights_in_group.tpl` | `INVALID_ID` | condition operand | line 35, column 70; UTF-16 `[2451,2464)` (span starts at `!=`) |
| `view_measurement_device/search_responsible.tpl` | `GROUP_LEVEL_MEASUREMENT_DEVICE_RESPONSIBLE` | method argument | line 38, column 55; UTF-16 `[1840,1884)` (span starts at `, `) |
| `view_module/module_information.tpl` | `USER_FLAG_SIMPLE_TEMPLATE` | condition operand | line 177, column 25; UTF-16 `[11013,11038)` |
| `view_sap/order_request_table.tpl` | `REQUEST_STOCK_TYPE_M` | condition operand | line 25, column 73; UTF-16 `[1649,1671)` (span starts at `==`) |
| `view_sap/report_back_table.tpl` | `REQUEST_FLAG_SCRAP` | method argument | line 83, column 165; UTF-16 `[6992,7010)` |
| `view_tools/search_owner_change.tpl` | `CHANGE_TYPE_NEW_OWNER` | condition operand | line 50, column 137; UTF-16 `[6365,6388)` (span starts at `==`) |
| `view_tools/search_tool_location.tpl` | `INVALID_ID` | condition operand | line 95, column 68; UTF-16 `[9488,9501)` (span starts at `!=`) |

The report coordinates use 1-based lines/columns and UTF-16 code-unit offsets;
the span is half-open. In several cases the parser's earliest error span
includes punctuation or whitespace immediately before the diagnosed ID.

These are direct `ID` values, distinct from already-supported `Class::NAME`
expressions and from the context-specific ID forms added by Tasks 017 and 018.
The pinned Smarty parser has `value ::= ID` around line 760 of
`vendor/smarty/smarty/src/Parser/TemplateParser.y`; its action preserves a
defined PHP constant and otherwise quotes the name as a literal. The pinned
lexer defines `ID` as `[0-9]*[a-zA-Z_]\w*`. This is syntactic structure only;
the proposed identifier node does not assert that a PHP constant exists or
that Smarty's runtime constant lookup will succeed.

The competing hyphenated attribute-name gap has nine earliest roots, all
`{html_options ...}` custom-tag-shaped calls containing HTML `data-*` or
`aria-*` names. `TemplateLexer.plex` explicitly accepts these through its
`ATTR` pattern, and the parser has `attribute ::= ATTR value`. Other confirmed
first-error roots include three nested-bracket-interpolation cases, two
`{for ...}` tags, and two literal blocks. Unquoted `{$5a}` has zero occurrences
in the fixed corpus. Based on the thirteen direct ID roots and the value's use
across common expression contexts, this task prioritizes primary-expression
IDs. The hyphenated attribute names and unquoted digit-prefixed variables
remain visible gaps; this task does not claim to resolve them.

Pinned Smarty 5.8.4 accepts the following with no parser/reference error:

```smarty
{$a == FLAG}
{if MODE && $enabled}yes{/if}
{$user->get(GROUP_NAME_NONE)}
{in_array(foo, $list)}
{$a == [STATUS_KEY=>MODE]}
```

`test/reference.php` reports the expected outer output/condition/call events but
does not expose identifier nodes, argument values, or array elements. The full
engine compiles the controlled output, condition, method-argument,
function-argument, and array-value forms. With `$a = "FLAG"` and `$enabled =
true`, it renders `1` for `{$a == FLAG}` and `yes` for the condition example;
`{in_array(foo, $list)}` renders `1` when `list` contains the string `foo`.
The recorder uses Smarty's compile-function path and does not verify plugin
availability for arbitrary names. Manual trees remain the structural contract.

Smarty distinguishes this valid static call from a variable-callee form:
`{$f(foo)}` and `{$f(123foo)}` are rejected at `(` with `Unexpected "("`.
`{isset(foo)}` compiles and renders `1` in a controlled full-engine check.
`{f(foo)}` reaches modifier/plugin resolution and fails because the unknown
modifier is absent, so it is not evidence that Smarty rejects bare IDs as
arguments. Task 017's earlier grammar-only negative for `{f(foo)}` and
`{f(123foo)}` is superseded for primary-expression calls by this task.

## Scope and proposed tree

Permit one static Smarty `ID` as a primary expression value, producing the
existing `(identifier)` node. This includes the lexer's digit-prefixed ID form
such as `123foo`; pure decimals remain `(number)`. Add it to the shared
expression grammar so it can compose where full expressions are already
accepted. The task must hand-test output expressions, conditions, a function
argument, a method argument, and an array element value. It must include the
condition and method-argument forms represented by the corpus roots. Do not
claim untested context pairings merely because they use the shared expression
rule.

Bare IDs are already accepted as array keys by the current array contract. The
array example below keeps an ID key as a neighboring supported form; Task 022's
new array-composition coverage is the ID in the element's `value` field.

Hand-authored tree contracts to add in `test/corpus/static-identifier-expressions.txt`:

```smarty
{$a == FLAG}
```

```text
(source_file
  (output
    value: (binary_expression
      left: (variable name: (identifier))
      right: (identifier))))
```

```smarty
{if MODE && $enabled}yes{/if}
```

```text
(source_file
  (if_block
    (if_tag condition: (binary_expression
      left: (identifier)
      right: (variable name: (identifier))))
    (text)
    (if_close_tag)))
```

```smarty
{$user->get(GROUP_NAME_NONE)}
```

```text
(source_file
  (output
    value: (method_call_expression
      object: (variable name: (identifier))
      method: (identifier)
      argument: (identifier))))
```

```smarty
{in_array(foo, $list)}
```

```text
(source_file
  (output
    value: (function_call_expression
      name: (identifier)
      argument: (identifier)
      argument: (variable name: (identifier)))))
```

At brace-root level, a static ID token in a tag-name position remains a
`custom_tag`, not an output identifier. In particular, `{123foo}` must retain
`custom_tag name: (identifier)` with text `123foo`; the pinned recorder emits
an unknown-tag event for that exact name. This preserves unrestricted tag
parsing without adding a tag allowlist or asserting plugin availability.

```smarty
{123foo}
```

```text
(source_file
  (custom_tag name: (identifier)))
```

```smarty
{$a == [STATUS_KEY=>MODE]}
```

```text
(source_file
  (output
    value: (binary_expression
      left: (variable name: (identifier))
      right: (array_literal
        (array_element
          key: (identifier)
          value: (identifier))))))
```

Also hand-specify `{$a == 123foo}` with a right `(identifier)` whose text and
range are exactly `123foo`, and `{$a == 123}` with a right `(number)`. Node
checks must assert node types, field ownership, order, text, source ranges,
absence of errors for valid cases, and reference acceptance. Keep these
identifier-value fixtures separate from the generic-tag and modifier-only ID
fixtures so each context's contract remains visible.

## Composition, exclusions, recovery, and edits

Update the distinct `Bare identifier` row in
[`docs/composition.md`](../composition.md). Add reviewed `yes` cells only for
the contexts with hand-authored trees and executed checks. The existing
generic-tag positional/attribute and direct modifier-argument cells remain
separate. Leave every unprobed pairing unknown; do not infer bracket-index,
modifier-input, foreach-source, or custom-tag positional support from this
task.

Preserve the existing distinct nodes and forms:

- `true`, `false`, and `null` remain boolean/null nodes, including mixed case.
- Pure decimal tokens remain numbers; `123foo` is one identifier.
- `Class::NAME` remains a `class_constant_expression`.
- `name(...)` remains a function call, not an identifier value.
- `{123foo}` remains a generic-tag form with tag name `123foo`, while
  `{$a == 123foo}` keeps `123foo` as an expression `identifier`.
- Direct IDs in generic-tag arguments, generic-tag attributes, and modifier
  arguments retain their existing tree shape.
- Do not add arbitrary namespaced/dynamic names, runtime symbol resolution, or
  plugin semantics.

Use this malformed recovery source and hand-write its expected tree before
changing the grammar:

```smarty
before {if $x == }bad{/if} after {$later}
```

```text
(source_file
  (text)
  (if_block
    (if_tag
      condition: (variable name: (identifier))
      (ERROR))
    (text)
    (if_close_tag))
  (text)
  (output value: (variable name: (identifier))))
```

Smarty 5.8.4 rejects this source at `}` with `Unexpected "}"`. Keep the
expression malformed: recovery must not insert a valid identifier or erase the
operator error, and the block closer, following text, and `{$later}` must remain
separate siblings. Add a pinned-reference rejection assertion and exact tree
checks for the error span and following nodes.

Incrementally edit `{if STATUS_OPEN && $enabled}yes{/if}{$after}` to
`{if $enabled}yes{/if}{$after}` and back. Compare full edited snapshots with
fresh parses and preserve the sibling output. Also keep a positive expression
containing a variable beside an identifier so an overly broad token rule cannot
swallow the identifier or neighboring expression.

Add the hand-authored fixture and failing Node checks before grammar changes.
Do not widen the shared variable rule, reinterpret class constants, create a
tag-name allowlist, or use text fallbacks. Run `npm test`, collect same-hash
corpus reports outside `build/`, inspect every newly clean tree for explicit
identifier nodes, and report remaining failures. No corpus gain is promised by
the first-error count.

## Explicit boundaries

This task covers one static ID as a primary expression and in tested
compositions. It does not implement Smarty word operators such as `not`/`or`,
hyphenated HTML `ATTR` names, legacy `{foreach from=...}` headers, `{for}`
blocks, literal regions, nested Smarty output inside a bracket index, output
attributes, assignment tags, or unquoted `{$5a}` variable syntax. Each remains
a separate visible task candidate grounded in the current corpus or Smarty
reference. The recording compiler observes syntax/events, not identifier
binding or value structure; use hand-authored trees and controlled full-engine
compile/render checks where runtime behavior is observable.

## Scope clarification and pre-implementation disposition

The initial creation review accepted primary IDs for output expressions,
conditions, method arguments, and array-element values. Inspection of the
pinned Smarty `function ::= ns1 OPENP variablelist CLOSEP` and
`variablelist ::= expr` productions, plus reference and full-engine checks for
`{in_array(foo, $list)}` and `{isset(foo)}`, confirms that a bare ID also
composes as a static function argument. This is the same bounded ID primary,
not expansion to arbitrary callable syntax. The function-argument tree and
check were added to the brief. The old Task 017 negative for `{f(foo)}` is not
Smarty rejection evidence: the recorder accepts its syntax and full compile
fails later because modifier `f` is unavailable. The rejected variable-callee
form `{$f(foo)}` is the minimal contrasting observation. Re-review this added
composition context before grammar implementation. The independent
implementation reviewer accepted this clarified scope on 2026-10-01; they
confirmed the reference/full-engine observations and the malformed primitive
classification boundaries before implementation proceeded.

## Implementation evidence (2026-10-01)

Added static Smarty `ID` and the digit-prefixed ID token as `(identifier)`
primaries in the shared expression grammar. Existing booleans, nulls, numbers,
variables, and class constants retain separate nodes; tests cover lowercase and
mixed-case `true`/`false`/`null`. The `_tag_name` context gives brace-root tag
names precedence over bare-ID output interpretations and accepts the pinned
digit-prefixed ID form as an unrestricted identifier tag name, so `{123foo}`
remains a `custom_tag` while `{$a == 123foo}` contains an expression
`identifier`. Array keys reuse the primary rule rather than duplicating the ID
alternative.

Hand-authored trees cover output and condition operands, method and function
arguments, array-element values, digit-prefixed IDs, primitive/number
classifications, and the digit-prefixed tag-name boundary. The Node checks
assert fields, argument ordering, source text/ranges, exact unknown-tag event,
Smarty acceptance/rejection, malformed-expression recovery and a condition
edit against a fresh full-tree snapshot. `{in_array(foo, $list)}` compiles and
renders `1`; variable-callee `{$f(foo)}` remains a Smarty syntax error. Unknown
`{123foo}` reaches full-engine unknown-tag resolution only after the recorder
has accepted its tag name. No plugin behavior is asserted.

The same 467 corpus source hashes were used before and after, with reports at
`/tmp/smarty-022-before.json` and `/tmp/smarty-022-after.json`. The before report
matches parser SHA-256
`95573b2032d5c0621d34d59f35e061ee6137333c07e96031e4936ffe0468e6d4` and measured
428 clean / 39 failing files. The after report matches generated parser SHA-256
`df7367c0e97b4feb709eb18fff7cc641d9dcacfda34add7313591a34a1c31201` and measured
441 clean / 26 failing files: 13 newly clean and no regressions.

Each of the 13 newly clean trees was inspected. `REPLACE_PART_DISPLAY_NORMAL`
is the right operand of a condition comparison in
`action_types/action_value_replace_part.tpl`; `USER_FLAG_SIMPLE_TEMPLATE` is a
condition operand or a method argument in `index.tpl`, `init_jqui.tpl`, and
`view_module/module_information.tpl`; `GROUP_NAME_NONE` and
`GROUP_NAME_NORMAL` are method arguments in
`view_admin/action_types/search_action_type.tpl` and
`view_admin/action_types/triggers_table.tpl`. In
`view_admin/module_types/edit_label_template_dialog.tpl`, both
`GROUP_NAME_FULL` occurrences are explicit method arguments inside attribute
values. The three `INVALID_ID` occurrences in
`view_admin/users/view_user_rights_in_group.tpl` remain nested comparison
operands. `GROUP_LEVEL_MEASUREMENT_DEVICE_RESPONSIBLE` is a method argument in
the `foreach` source expression. `REQUEST_STOCK_TYPE_M` appears as comparison
and bracket-index syntax in `view_sap/order_request_table.tpl`;
`REQUEST_FLAG_SCRAP` is a method argument in a condition in
`view_sap/report_back_table.tpl`; `CHANGE_TYPE_NEW_OWNER` and the final
`INVALID_ID` are comparison operands in `view_tools/search_owner_change.tpl`
and `view_tools/search_tool_location.tpl`. Each recovered token is an explicit
`identifier` child in its relevant expression field.

The changed `test/bitwise-and.test.mjs` recovery expectations now show a
missing `identifier` directly under an incomplete `&` binary expression,
instead of the old synthetic missing boolean `true`. The minimal Smarty
observations for `{$a &}` and `{if $a &}` still reject at `}`; adding the ID
primary changes only Tree-sitter's missing-token choice and still preserves the
error, comment/closer and later output. `test/primitive-literals.test.mjs`
likewise now treats `trueish`, `FALSEhood`, `nullary`, `TRUE_widget`, `null0`,
and `tru` as static ID arguments, as the pinned ID lexer and recorder do;
exact primitive words remain the existing boolean/null nodes.

`npm test` passed: 213 expected trees, 295 Node checks, and 14/14 deliberate
grammar mutations caught. Full log: `/tmp/smarty-022-final-test.log`. Focused
tests for the static-ID feature, modifier IDs, generic-tag IDs, primitive
boundaries, and bitwise recovery also passed before the full gate.
Independent implementation review accepted on 2026-10-01 with no actionable
findings. The reviewer independently reproduced `npm test`, the corpus report
hash comparison and all 13 new clean-tree inspections. The orchestrator owns
the final task-state transition and commit.
