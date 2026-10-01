# Expression composition checklist

This checklist tracks where expression forms are accepted. A form may parse in
an output but fail in a modifier argument, bracket index, or another expression
position. The matrix distinguishes an expression form from the context where it
is nested: **Index access** is a value such as `$a[$i]`; **Bracket index
expression** is the expression occupying `$a[EXPR]`.

This is a coverage guide, not a requirement to test every possible combination.
The baseline audit is [task 015](tasks/015-composition-audit.md). Each cell
must end with a status and evidence using the notation below. A single reviewed
fixture may support multiple cells when its tree visibly demonstrates each
composition and the linked check exercises that fixture; do not generate a
Cartesian suite merely to fill the matrix.

| Expression form | Output value | `if` / `elseif` condition | `foreach` source | Custom-tag positional argument | Custom-tag attribute value | Function / method argument | Modifier input | Modifier argument | Bracket index expression | Array key | Array value |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Variable / config variable | yes [V-output](#ev-v-output) | yes [V-condition](#ev-v-condition) | yes [V-source](#ev-v-source) | yes [V-tag-pos](#ev-v-tag-pos) | yes [V-tag-attr](#ev-v-tag-attr) | yes [V-call-arg](#ev-v-call-arg) | yes [V-mod-input](#ev-v-mod-input) | yes [V-mod-arg](#ev-v-mod-arg) | yes [V-bracket](#ev-v-bracket) | ? [U-variable-array-key](#ev-u-variable-array-key) | yes [V-array-value](#ev-v-array-value) |
| Primitive / string / number | yes [P-output](#ev-p-output) | yes [P-condition](#ev-p-condition) | ? [U-primitive-source](#ev-u-primitive-source) | ? [U-primitive-tag-pos](#ev-u-primitive-tag-pos) | yes [P-tag-attr](#ev-p-tag-attr) | yes [P-call-arg](#ev-p-call-arg) | yes [P-mod-input](#ev-p-mod-input) | yes [P-mod-arg](#ev-p-mod-arg) | yes [P-bracket](#ev-p-bracket) | yes [P-array-key](#ev-p-array-key) | yes [P-array-value](#ev-p-array-value) |
| Parenthesized expression | yes [PA-output](#ev-pa-output) | ? [U-parenthesized-condition](#ev-u-parenthesized-condition) | ? [U-parenthesized-source](#ev-u-parenthesized-source) | ? [U-parenthesized-tag-pos](#ev-u-parenthesized-tag-pos) | ? [U-parenthesized-tag-attr](#ev-u-parenthesized-tag-attr) | yes [PA-call-arg](#ev-pa-call-arg) | yes [PA-mod-input](#ev-pa-mod-input) | yes [PA-mod-arg](#ev-pa-mod-arg) | yes [PA-bracket](#ev-pa-bracket) | yes [PA-array-key](#ev-pa-array-key) | ? [U-parenthesized-array-value](#ev-u-parenthesized-array-value) |
| Unary / arithmetic / comparison / boolean expression | yes [OP-output](#ev-op-output) | yes [OP-condition](#ev-op-condition) | ? [U-operator-source](#ev-u-operator-source) | yes [OP-tag-pos](#ev-op-tag-pos) | yes [OP-tag-attr](#ev-op-tag-attr) | yes [OP-call-arg](#ev-op-call-arg) | limited [OP-mod-input](#ev-op-mod-input) | limited [OP-mod-arg](#ev-op-mod-arg) | limited [OP-bracket](#ev-op-bracket) | limited [OP-array-key](#ev-op-array-key) | ? [U-operator-array-value](#ev-u-operator-array-value) |
| Modifier expression | yes [M-output](#ev-m-output) | ? [U-modifier-condition](#ev-u-modifier-condition) | ? [U-modifier-source](#ev-u-modifier-source) | ? [U-modifier-tag-pos](#ev-u-modifier-tag-pos) | yes [M-tag-attr](#ev-m-tag-attr) | ? [U-modifier-call-arg](#ev-u-modifier-call-arg) | yes [M-mod-input](#ev-m-mod-input) | ? [U-modifier-mod-arg](#ev-u-modifier-mod-arg) | ? [U-modifier-bracket](#ev-u-modifier-bracket) | ? [U-modifier-array-key](#ev-u-modifier-array-key) | ? [U-modifier-array-value](#ev-u-modifier-array-value) |
| Property access (`->name`) | yes [PR-output](#ev-pr-output) | yes [PR-condition](#ev-pr-condition) | ? [U-property-source](#ev-u-property-source) | yes [PR-tag-pos](#ev-pr-tag-pos) | yes [PR-tag-attr](#ev-pr-tag-attr) | ? [U-property-call-arg](#ev-u-property-call-arg) | yes [PR-mod-input](#ev-pr-mod-input) | yes [PR-mod-arg](#ev-pr-mod-arg) | ? [U-property-bracket](#ev-u-property-bracket) | yes [PR-array-key](#ev-pr-array-key) | ? [U-property-array-value](#ev-u-property-array-value) |
| Method call (`->name(...)`) | yes [MC-output](#ev-mc-output) | yes [MC-condition](#ev-mc-condition) | yes [MC-source](#ev-mc-source) | yes [MC-tag-pos](#ev-mc-tag-pos) | yes [MC-tag-attr](#ev-mc-tag-attr) | yes [MC-call-arg](#ev-mc-call-arg) | yes [MC-mod-input](#ev-mc-mod-input) | yes [MC-mod-arg](#ev-mc-mod-arg) | ? [U-method-bracket](#ev-u-method-bracket) | ? [U-method-array-key](#ev-u-method-array-key) | ? [U-method-array-value](#ev-u-method-array-value) |
| Index access (`.name`, `[expr]`) | yes [IX-output](#ev-ix-output) | yes [IX-condition](#ev-ix-condition) | ? [U-index-source](#ev-u-index-source) | yes [IX-tag-pos](#ev-ix-tag-pos) | yes [IX-tag-attr](#ev-ix-tag-attr) | ? [U-index-call-arg](#ev-u-index-call-arg) | yes [IX-mod-input](#ev-ix-mod-input) | yes [IX-mod-arg](#ev-ix-mod-arg) | ? [U-index-bracket](#ev-u-index-bracket) | ? [U-index-array-key](#ev-u-index-array-key) | ? [U-index-array-value](#ev-u-index-array-value) |
| Loop metadata (`$item@name`) | yes [LM-output](#ev-lm-output) | yes [LM-condition](#ev-lm-condition) | ? [U-metadata-source](#ev-u-metadata-source) | ? [U-metadata-tag-pos](#ev-u-metadata-tag-pos) | yes [LM-tag-attr](#ev-lm-tag-attr) | yes [LM-call-arg](#ev-lm-call-arg) | yes [LM-mod-input](#ev-lm-mod-input) | no [LM-mod-arg](#ev-lm-mod-arg) | ? [U-metadata-bracket](#ev-u-metadata-bracket) | ? [U-metadata-array-key](#ev-u-metadata-array-key) | ? [U-metadata-array-value](#ev-u-metadata-array-value) |
| Function call (`name(...)`) | yes [FC-output](#ev-fc-output) | yes [FC-condition](#ev-fc-condition) | ? [U-function-source](#ev-u-function-source) | yes [FC-tag-pos](#ev-fc-tag-pos) | yes [FC-tag-attr](#ev-fc-tag-attr) | yes [FC-call-arg](#ev-fc-call-arg) | yes [FC-mod-input](#ev-fc-mod-input) | yes [FC-mod-arg](#ev-fc-mod-arg) | ? [U-function-bracket](#ev-u-function-bracket) | ? [U-function-array-key](#ev-u-function-array-key) | ? [U-function-array-value](#ev-u-function-array-value) |
| Array literal | ? [U-array-output](#ev-u-array-output) | yes [AR-condition](#ev-ar-condition) | ? [U-array-source](#ev-u-array-source) | yes [AR-tag-pos](#ev-ar-tag-pos) | yes [AR-tag-attr](#ev-ar-tag-attr) | yes [AR-call-arg](#ev-ar-call-arg) | ? [U-array-mod-input](#ev-u-array-mod-input) | yes [AR-mod-arg](#ev-ar-mod-arg) | yes [AR-bracket](#ev-ar-bracket) | ? [U-array-array-key](#ev-u-array-array-key) | yes [AR-array-value](#ev-ar-array-value) |
| Class constant (`Class::NAME`) | yes [CC-output](#ev-cc-output) | yes [CC-condition](#ev-cc-condition) | ? [U-constant-source](#ev-u-constant-source) | yes [CC-tag-pos](#ev-cc-tag-pos) | yes [CC-tag-attr](#ev-cc-tag-attr) | yes [CC-call-arg](#ev-cc-call-arg) | yes [CC-mod-input](#ev-cc-mod-input) | yes [CC-mod-arg](#ev-cc-mod-arg) | yes [CC-bracket](#ev-cc-bracket) | yes [CC-array-key](#ev-cc-array-key) | yes [CC-array-value](#ev-cc-array-value) |
| Static class method call (`Class::method(...)`) | yes [SM-output](#ev-sm-output) | yes [SM-condition](#ev-sm-condition) | yes [SM-source](#ev-sm-source) | yes [SM-tag-pos](#ev-sm-tag-pos) | yes [SM-tag-attr](#ev-sm-tag-attr) | yes [SM-call-arg](#ev-sm-call-arg) | yes [SM-mod-input](#ev-sm-mod-input) | yes [SM-mod-arg](#ev-sm-mod-arg) | yes [SM-bracket](#ev-sm-bracket) | yes [SM-array-key](#ev-sm-array-key) | yes [SM-array-value](#ev-sm-array-value) |
| Bare identifier (modifier and generic-tag direct values) | — | — | — | yes [GT-ID-pos](#ev-gt-id-pos) | yes [GT-ID-attr](#ev-gt-id-attr) | — | — | yes [MOD-ID-arg](#ev-mod-id-arg) | — | — | — |

## Cell notation and evidence

Replace each `?` with `yes`, `limited`, or `no`, followed by links or a brief
evidence key. Examples:

- `yes — [tree](../test/corpus/object-properties.txt#L1), [check](../test/object-properties.test.mjs#L1)`
- `limited — [tree](../test/corpus/condition-operators.txt#L1), [check](../test/condition-operators.test.mjs#L1); only symbolic comparisons are accepted`
- ``no — Smarty 5.8.4 accepts `is div by`, but the grammar lacks it; [gap brief](tasks/013-divisibility-predicate.md)``

For `yes`, evidence must include at least one hand-authored expected tree and a
Node or Smarty-reference check that exercises that tree/context. Existing tests
may be linked; add a test only when the cell lacks adequate evidence or is
ambiguous. For `limited`, show a supported representative and state the exact
boundary (for example, static property names work but dynamic member names do
not). For `no`, state whether the grammar lacks support or Smarty rejects the
syntax. If Smarty accepts a form that the grammar lacks, cite a pinned positive
Smarty observation and link the task/contract entry that tracks the gap. If
Smarty rejects it, cite a pinned rejection. A deliberate exclusion must link
the specific project contract decision. Do not claim that a form is invalid in
Smarty based only on a missing grammar production. Keep a cell `?` while the
behavior or parser boundary remains unknown. State syntax evidence separately
from runtime binding, plugin behavior, or value semantics the recording adapter
cannot observe.

`—` marks a context that does not apply to an atom row limited to direct tag or
modifier values; it is not an audited support claim. The `MOD-ID-arg` cell is
tracked separately from the Task 015 expression-composition totals below
because Task 017 adds a modifier-only atom/context pairing. The two `GT-ID`
cells record the direct generic-tag pairings verified by Task 018.

The evidence link format may point several cells to one combined hand tree and
check when that fixture directly demonstrates all named cases. A cell may
carry an evidence key whose definitions appear immediately below the matrix;
every key must resolve to exact fixture/check lines and a concise boundary.
`limited` and `no` entries always state the boundary inline or at the linked
key. Neither evidence references nor tests imply that every expression/context
permutation was compiled.

When a task adds a new expression form or context, update the relevant row or
column and link its tests. When a task audits an existing cell without changing
coverage, its audit record can cite the existing matrix evidence without
mechanically editing an unchanged entry. Reconcile verified syntax claims with
[`test/CONTRACT.md`](../test/CONTRACT.md) and the affected rows in
[`docs/features.md`](features.md); update those documents only when the audit
establishes that their current statements need correction or clarification.

## Static class method call composition audit

Each cell has a hand-authored expected tree and fixture-driven Node check; the
Smarty 5.8.4 recorder accepts the syntax but cannot inspect the call's class,
method, or argument values. Its projection exposes tag names and ordered
argument names/counts, plus modifier/output events. The checks establish one
static call node and its fields across the listed contexts. The direct generic
tag cases verify that the call remains one positional or attribute value. The
full engine compiles the controlled `DateTime` example; this does not verify
runtime registration or behavior. The prior parser split the generic-tag calls
and errored in the other contexts.

| Cell keys | Exact minimized composition | Current boundary | Smarty observation |
| --- | --- | --- | --- |
| <a id="ev-sm-output"></a>SM-output | Output: `{Thing::make($x)}` | One `static_method_call_expression` owns class, method, and argument. | [hand tree](../test/corpus/static-class-method-calls.txt#L30), [check](../test/static-class-method-calls.test.mjs#L8) |
| <a id="ev-sm-condition"></a>SM-condition | Condition: `{if Thing::isReady($x)}Y{/if}` | One call is the `condition` field. | [hand tree](../test/corpus/static-class-method-calls.txt#L42), [check](../test/static-class-method-calls.test.mjs#L8) |
| <a id="ev-sm-source"></a>SM-source | Foreach source: `{foreach Thing::items() as $item}{$item}{/foreach}` | One call is the `source` field. | [hand tree](../test/corpus/static-class-method-calls.txt#L57), [check](../test/static-class-method-calls.test.mjs#L8) |
| <a id="ev-sm-tag-pos"></a>SM-tag-pos | Positional value: `{widget Thing::make($x)}` | One positional argument owns the complete call. | [hand tree](../test/corpus/static-class-method-calls.txt#L72), [check](../test/static-class-method-calls.test.mjs#L8) |
| <a id="ev-sm-tag-attr"></a>SM-tag-attr | Attribute value: `{widget value=Thing::make($x)}` | The `value` attribute owns the complete call; no extra positional argument appears. | [hand tree](../test/corpus/static-class-method-calls.txt#L85), [check](../test/static-class-method-calls.test.mjs#L8) |
| <a id="ev-sm-call-arg"></a>SM-call-arg | Call argument: `{strlen(Thing::make($x))}`; method argument: `{$o->run(Thing::make($x))}` | The nested call is one `argument` field in each form. | [hand trees](../test/corpus/static-class-method-calls.txt#L101), [check](../test/static-class-method-calls.test.mjs#L8) |
| <a id="ev-sm-mod-input"></a>SM-mod-input | Modifier input: `{Thing::make($x)|escape}` | The modifier `value` is the complete call. | [hand tree](../test/corpus/static-class-method-calls.txt#L130), [check](../test/static-class-method-calls.test.mjs#L8) |
| <a id="ev-sm-mod-arg"></a>SM-mod-arg | Modifier argument: `{$x|default:Thing::make($x)}` | The modifier `argument` is the complete call. | [hand tree](../test/corpus/static-class-method-calls.txt#L144), [check](../test/static-class-method-calls.test.mjs#L8) |
| <a id="ev-sm-bracket"></a>SM-bracket | Bracket index: `{$a[Thing::make($x)]}` | The index field is the complete call. | [hand tree](../test/corpus/static-class-method-calls.txt#L159), [check](../test/static-class-method-calls.test.mjs#L8) |
| <a id="ev-sm-array-key"></a>SM-array-key | Array key: `{[Thing::make($x)=>1]}` | The array element `key` field is the complete call. | [hand tree](../test/corpus/static-class-method-calls.txt#L173), [check](../test/static-class-method-calls.test.mjs#L8) |
| <a id="ev-sm-array-value"></a>SM-array-value | Array value: `{[1=>Thing::make($x)]}` | The array element `value` field is the complete call. | [hand tree](../test/corpus/static-class-method-calls.txt#L188), [check](../test/static-class-method-calls.test.mjs#L8) |

## Task 015 evidence index

Keys in the matrix link to the evidence groups below. Each `yes` group names a
hand-authored tree and a fixture-driven Node or Smarty-reference check. The
fixture runner in each linked check executes the named tree; structures beyond
the recording adapter's event projection remain established by the explicit
tree.

| Cell keys | Exact composition represented by the tree | Hand-authored tree | Executed check |
| --- | --- | --- | --- |
| <a id="ev-v-output"></a>V-output, <a id="ev-v-condition"></a>V-condition, <a id="ev-v-source"></a>V-source, <a id="ev-v-tag-pos"></a>V-tag-pos, <a id="ev-v-tag-attr"></a>V-tag-attr, <a id="ev-v-call-arg"></a>V-call-arg, <a id="ev-v-mod-input"></a>V-mod-input, <a id="ev-v-mod-arg"></a>V-mod-arg, <a id="ev-v-bracket"></a>V-bracket, <a id="ev-v-array-value"></a>V-array-value | Variable/config output, conditions, foreach source, custom-tag arguments/attributes, function/method arguments, modifier input/argument, bracket index, and array value. Cases are the matching named examples across these fixtures. | [initial](../test/corpus/initial.txt), [config](../test/corpus/config-variables.txt), [foreach](../test/corpus/foreach.txt), [methods](../test/corpus/object-method-calls.txt), [calls](../test/corpus/standalone-function-calls.txt), [index](../test/corpus/index-access.txt), [arrays](../test/corpus/array-literals.txt) | [initial/reference](../test/reference.test.mjs#L4), [config](../test/config-variables.test.mjs#L5), [foreach](../test/foreach.test.mjs#L5), [methods](../test/object-method-calls.test.mjs#L4), [calls](../test/standalone-function-calls.test.mjs#L5), [index](../test/index-access.test.mjs#L4), [arrays](../test/array-literals.test.mjs#L6) |
| <a id="ev-p-output"></a>P-output, <a id="ev-p-condition"></a>P-condition, <a id="ev-p-tag-attr"></a>P-tag-attr, <a id="ev-p-mod-input"></a>P-mod-input, <a id="ev-p-mod-arg"></a>P-mod-arg, <a id="ev-p-bracket"></a>P-bracket, <a id="ev-p-array-key"></a>P-array-key, <a id="ev-p-array-value"></a>P-array-value | Primitive/string/number output, conditions, attribute values, modifier input/argument, bracket index, array key/value. The positional-argument cell remains unknown. | [initial](../test/corpus/initial.txt), [primitives](../test/corpus/primitive-literals.txt), [operators](../test/corpus/condition-operators.txt), [arrays](../test/corpus/array-literals.txt) | [initial/reference](../test/reference.test.mjs#L4), [primitives](../test/primitive-literals.test.mjs#L4), [operators](../test/condition-operators.test.mjs#L5), [arrays](../test/array-literals.test.mjs#L6) |
| <a id="ev-p-call-arg"></a>P-call-arg | Boolean as a direct method argument, `true` in `{$user->find(State::ready, true)}`. The expected tree exposes the boolean argument separately from the class constant. | [Constants in nested access and arguments](../test/corpus/class-constants.txt#L30) | [fixture-driven reference and shape checks](../test/class-constants.test.mjs#L4) |
| <a id="ev-pa-output"></a>PA-output, <a id="ev-pa-call-arg"></a>PA-call-arg, <a id="ev-pa-mod-input"></a>PA-mod-input, <a id="ev-pa-mod-arg"></a>PA-mod-arg, <a id="ev-pa-bracket"></a>PA-bracket, <a id="ev-pa-array-key"></a>PA-array-key | Parenthesized expression in an output expression, method argument, modifier input/argument, bracket index, and compound array key. Parenthesized forms in the remaining contexts are unverified. | [operators](../test/corpus/condition-operators.txt), [methods](../test/corpus/object-method-calls.txt), [primitives](../test/corpus/primitive-literals.txt), [index](../test/corpus/index-access.txt), [arrays](../test/corpus/array-literals.txt) | [operators](../test/condition-operators.test.mjs#L5), [methods](../test/object-method-calls.test.mjs#L4), [primitives](../test/primitive-literals.test.mjs#L4), [index](../test/index-access.test.mjs#L4), [arrays](../test/array-literals.test.mjs#L6) |
| <a id="ev-op-output"></a>OP-output, <a id="ev-op-condition"></a>OP-condition, <a id="ev-op-tag-pos"></a>OP-tag-pos, <a id="ev-op-tag-attr"></a>OP-tag-attr, <a id="ev-op-call-arg"></a>OP-call-arg, <a id="ev-op-mod-input"></a>OP-mod-input, <a id="ev-op-mod-arg"></a>OP-mod-arg, <a id="ev-op-bracket"></a>OP-bracket, <a id="ev-op-array-key"></a>OP-array-key | Unary/arithmetic/comparison/boolean expressions in output, condition, custom positional/attribute value, call argument, modifier input/argument, bracket index, and compound array key. `OP-mod-input` is limited to the tested parenthesized unary value; `OP-mod-arg` and `OP-array-key` require parentheses around a full compound expression. `OP-bracket` directly evidences arithmetic only. | [operators](../test/corpus/condition-operators.txt), [index](../test/corpus/index-access.txt), [arrays](../test/corpus/array-literals.txt) | [operators](../test/condition-operators.test.mjs#L5), [index](../test/index-access.test.mjs#L4), [arrays](../test/array-literals.test.mjs#L6) |
| <a id="ev-m-output"></a>M-output, <a id="ev-m-tag-attr"></a>M-tag-attr, <a id="ev-m-mod-input"></a>M-mod-input | Modifier expression as output and attribute value; a nested modifier is also the input to the outer modifier. | [initial](../test/corpus/initial.txt), [operators](../test/corpus/condition-operators.txt) | [initial/reference](../test/reference.test.mjs#L4), [operators](../test/condition-operators.test.mjs#L5) |
| <a id="ev-pr-output"></a>PR-output, <a id="ev-pr-condition"></a>PR-condition, <a id="ev-pr-tag-pos"></a>PR-tag-pos, <a id="ev-pr-tag-attr"></a>PR-tag-attr, <a id="ev-pr-mod-input"></a>PR-mod-input, <a id="ev-pr-mod-arg"></a>PR-mod-arg, <a id="ev-pr-array-key"></a>PR-array-key | Property access in output, condition, custom-tag positional/attribute values, modifier input/argument, and as a compound array key. | [properties](../test/corpus/object-properties.txt), [arrays](../test/corpus/array-literals.txt) | [property checks](../test/object-properties.test.mjs#L5), [array checks](../test/array-literals.test.mjs#L6) |
| <a id="ev-mc-output"></a>MC-output, <a id="ev-mc-condition"></a>MC-condition, <a id="ev-mc-source"></a>MC-source, <a id="ev-mc-tag-pos"></a>MC-tag-pos, <a id="ev-mc-tag-attr"></a>MC-tag-attr, <a id="ev-mc-call-arg"></a>MC-call-arg, <a id="ev-mc-mod-input"></a>MC-mod-input, <a id="ev-mc-mod-arg"></a>MC-mod-arg | Method calls as output, condition, foreach source, custom-tag positional/attribute values, nested method argument, modifier input, and modifier argument. | [methods](../test/corpus/object-method-calls.txt), [foreach](../test/corpus/foreach.txt) | [method checks](../test/object-method-calls.test.mjs#L4), [foreach checks](../test/foreach.test.mjs#L5) |
| <a id="ev-ix-output"></a>IX-output, <a id="ev-ix-condition"></a>IX-condition, <a id="ev-ix-tag-pos"></a>IX-tag-pos, <a id="ev-ix-tag-attr"></a>IX-tag-attr, <a id="ev-ix-mod-input"></a>IX-mod-input, <a id="ev-ix-mod-arg"></a>IX-mod-arg | Index access as output, condition, custom-tag positional/attribute value, modifier input, and modifier argument. | [index access](../test/corpus/index-access.txt) | [index checks](../test/index-access.test.mjs#L4) |
| <a id="ev-lm-output"></a>LM-output, <a id="ev-lm-condition"></a>LM-condition, <a id="ev-lm-tag-attr"></a>LM-tag-attr, <a id="ev-lm-call-arg"></a>LM-call-arg, <a id="ev-lm-mod-input"></a>LM-mod-input | Loop metadata as output, condition operand, attribute value, function/method argument, and modifier input. The runtime property/binding is not validated by the recorder. | [metadata](../test/corpus/loop-metadata.txt) | [metadata fixture checks](../test/loop-metadata.test.mjs#L5), [call-argument structure](../test/loop-metadata.test.mjs#L71) |
| <a id="ev-lm-mod-arg"></a>LM-mod-arg | **no:** Smarty 5.8.4 accepts `{foreach $items as $item}{$item|default:$item@index}{/foreach}`; current grammar errors at `index` because `_modifier_argument` omits `loop_metadata_expression`. This is a confirmed syntax gap, not a runtime-binding claim. | Minimized positive reference observation and grammar boundary are recorded in [task 015](tasks/015-composition-audit.md); the syntax-contract correction is in [CONTRACT](../test/CONTRACT.md); [016](tasks/016-loop-metadata-modifier-argument.md) is a noncanonical draft candidate, not yet queued or accepted, awaiting a separate task-creation owner and reviewer. | [recording adapter](../test/reference.php), pinned to Smarty 5.8.4 |
| <a id="ev-fc-output"></a>FC-output, <a id="ev-fc-condition"></a>FC-condition, <a id="ev-fc-tag-pos"></a>FC-tag-pos, <a id="ev-fc-tag-attr"></a>FC-tag-attr, <a id="ev-fc-call-arg"></a>FC-call-arg, <a id="ev-fc-mod-input"></a>FC-mod-input, <a id="ev-fc-mod-arg"></a>FC-mod-arg | Function calls as output, condition, custom-tag positional/attribute value, method argument, modifier input, and modifier argument. | [calls](../test/corpus/standalone-function-calls.txt) | [call checks](../test/standalone-function-calls.test.mjs#L5) |
| <a id="ev-ar-condition"></a>AR-condition, <a id="ev-ar-tag-pos"></a>AR-tag-pos, <a id="ev-ar-tag-attr"></a>AR-tag-attr, <a id="ev-ar-call-arg"></a>AR-call-arg, <a id="ev-ar-mod-arg"></a>AR-mod-arg, <a id="ev-ar-bracket"></a>AR-bracket, <a id="ev-ar-array-value"></a>AR-array-value | Array literal in condition, custom-tag positional/attribute value, method argument, modifier argument, bracket-index expression, and as a nested array value. | [arrays](../test/corpus/array-literals.txt) | [array checks](../test/array-literals.test.mjs#L6) |
| <a id="ev-cc-output"></a>CC-output, <a id="ev-cc-condition"></a>CC-condition, <a id="ev-cc-tag-pos"></a>CC-tag-pos, <a id="ev-cc-tag-attr"></a>CC-tag-attr, <a id="ev-cc-call-arg"></a>CC-call-arg, <a id="ev-cc-mod-input"></a>CC-mod-input, <a id="ev-cc-mod-arg"></a>CC-mod-arg, <a id="ev-cc-bracket"></a>CC-bracket, <a id="ev-cc-array-key"></a>CC-array-key, <a id="ev-cc-array-value"></a>CC-array-value | Class constant in each listed expression context; the new key/value fixture asserts the explicit `array_element` key and value fields. | [constants](../test/corpus/class-constants.txt) | [constant fixture/reference checks](../test/class-constants.test.mjs#L4), [array key/value field check](../test/class-constants.test.mjs#L18) |
| <a id="ev-mod-id-arg"></a>MOD-ID-arg | A direct static Smarty `ID` modifier argument is an `identifier`, including digit-prefixed `123foo`; numeric, boolean, null, and class-constant arguments retain their separate node types. | [hand-authored modifier trees](../test/corpus/modifier-identifiers.txt), [pinned reference, full-engine, context-exclusion and edit checks](../test/static-modifier-arguments.test.mjs#L1) | [Task 017 evidence](tasks/017-static-modifier-arguments.md) |
| <a id="ev-gt-id-pos"></a>GT-ID-pos, <a id="ev-gt-id-attr"></a>GT-ID-attr | Direct static Smarty IDs, including `123foo`, are `identifier` nodes in generic-tag positional and attribute-value fields; primitive, numeric, variable, string, and class-constant values retain their distinct types. The recorder checks event names/order/count, and the full engine renders the built-in block example. | [hand-authored trees](../test/corpus/generic-tag-identifier-values.txt), [reference, full-engine, recovery and edit checks](../test/generic-tag-identifier-values.test.mjs) | Pinned Smarty 5.8.4 parser productions `value ::= ID`, `attribute ::= SPACE value`, and `attribute ::= SPACE ID EQUAL ID`; [018](tasks/018-generic-tag-identifier-values.md) |

### Unverified pairings

<a id="ev-u-variable-array-key"></a><a id="ev-u-primitive-source"></a><a id="ev-u-primitive-tag-pos"></a><a id="ev-u-parenthesized-condition"></a><a id="ev-u-parenthesized-source"></a><a id="ev-u-parenthesized-tag-pos"></a><a id="ev-u-parenthesized-tag-attr"></a><a id="ev-u-parenthesized-array-value"></a><a id="ev-u-operator-source"></a><a id="ev-u-operator-array-value"></a><a id="ev-u-modifier-condition"></a><a id="ev-u-modifier-source"></a><a id="ev-u-modifier-tag-pos"></a><a id="ev-u-modifier-call-arg"></a><a id="ev-u-modifier-mod-arg"></a><a id="ev-u-modifier-bracket"></a><a id="ev-u-modifier-array-key"></a><a id="ev-u-modifier-array-value"></a><a id="ev-u-property-source"></a><a id="ev-u-property-call-arg"></a><a id="ev-u-property-bracket"></a><a id="ev-u-property-array-value"></a><a id="ev-u-method-bracket"></a><a id="ev-u-method-array-key"></a><a id="ev-u-method-array-value"></a><a id="ev-u-index-source"></a><a id="ev-u-index-call-arg"></a><a id="ev-u-index-bracket"></a><a id="ev-u-index-array-key"></a><a id="ev-u-index-array-value"></a><a id="ev-u-metadata-source"></a><a id="ev-u-metadata-tag-pos"></a><a id="ev-u-metadata-bracket"></a><a id="ev-u-metadata-array-key"></a><a id="ev-u-metadata-array-value"></a><a id="ev-u-function-source"></a><a id="ev-u-function-bracket"></a><a id="ev-u-function-array-key"></a><a id="ev-u-function-array-value"></a><a id="ev-u-array-output"></a><a id="ev-u-array-source"></a><a id="ev-u-array-mod-input"></a><a id="ev-u-array-array-key"></a><a id="ev-u-constant-source"></a>

The cells marked `?` are unknown rather than unsupported. Each linked key names
the exact form/context pair. Follow-up is to reduce that pair to one source,
write its expected tree manually, and check pinned Smarty behavior before
changing its status. The pairs are: variable/config variable–array key;
primitive–foreach source and positional argument; parenthesized expression–
condition, foreach source, positional argument, attribute value, and array
value; operator expression–foreach source and array value; modifier expression–
condition, foreach source, positional argument, function/method argument,
modifier argument, bracket-index expression, array key, and array value;
property access–foreach source, function/method argument, bracket-index
expression, and array value; method call–bracket-index expression, array key,
and array value; index access–foreach source, function/method argument,
bracket-index expression, array key, and array value; loop metadata–foreach
source, positional argument, bracket-index expression, array key, and array
value; function call–foreach source, bracket-index expression, array key, and
array value; array literal–output, foreach source, modifier input, and array
key; class constant–foreach source. The hand-written table supplies a concrete
follow-up pair for every unknown key; no cell is promoted by grammar routing.

## Task 015 audit run record

Baseline before test additions: `npm test`, exit 0; 124 expected trees, 180
Node checks, and 11/11 mutation checks caught. Revision
`df8d2d2c986cac66effd42081368a42f800a727f`; `grammar.js` SHA-256
`0aa37be6cac42830e34cd5524e5d88489ab65f32ef1fea2bd34cfd0154ef4d5c`.
Final command `npm test` exited 0 with 126 expected trees, 184 Node checks,
and 11/11 mutation checks caught, at the same revision and grammar hash. Logs:
`/tmp/smarty-015-baseline.log` and `/tmp/smarty-015-final.log`. No grammar rules
changed, so no parser or application-corpus delta was expected; no corpus report
was generated. The Task 015 audit matrix had 83 `yes`, 4 `limited`, 1 `no`, and
44 unverified expression-composition cells. Its single confirmed gap was loop
metadata as a modifier argument; the recording adapter proves syntax/event
acceptance only, not runtime binding. The separate `MOD-ID-arg` cell is not
included in those historical totals because Task 017 adds a modifier-only
atom/context pairing.
