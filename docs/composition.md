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

| Expression form | Assignment RHS | Output value | `if` / `elseif` condition | `foreach` source | Custom-tag positional argument | Custom-tag attribute value | Function / method argument | Modifier input | Modifier argument | Bracket index expression | Array key | Array value |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Braced expression wrapper in generic-tag named attribute (`name={EXPR}`) | — | — | — | — | — | yes [U-braced-tag-attr](#ev-u-braced-tag-attr) | — | — | — | — | — | — |
| Braced expression wrapper in an `if`/`elseif` condition (`{if {EXPR} ...}`) | — | — | yes [U-braced-condition](#ev-u-braced-condition) | — | — | — | — | — | — | — | — | — |
| Braced modifier argument wrapper (`modifier:{EXPR}`) | — | yes [B-mod-arg](#ev-b-mod-arg) | yes [B-mod-arg](#ev-b-mod-arg) | — | — | yes [B-mod-arg](#ev-b-mod-arg) | limited [B-mod-arg](#ev-b-mod-arg) | — | yes [B-mod-arg](#ev-b-mod-arg) | — | — | yes [B-mod-arg](#ev-b-mod-arg) |
| Braced output expression inside bracket index (`$a[{EXPR}]`) | ? | yes [B-index](#ev-b-index) | ? | ? | ? | yes [B-index](#ev-b-index) | ? | ? | ? | yes [B-index](#ev-b-index) | ? | ? |
| Variable / config variable | limited [ARHS-variable](#ev-assignment-rhs) | yes [V-output](#ev-v-output) | yes [V-condition](#ev-v-condition) | yes [V-source](#ev-v-source) | yes [V-tag-pos](#ev-v-tag-pos) | yes [V-tag-attr](#ev-v-tag-attr) | yes [V-call-arg](#ev-v-call-arg) | yes [V-mod-input](#ev-v-mod-input) | yes [V-mod-arg](#ev-v-mod-arg) | yes [V-bracket](#ev-v-bracket) | ? [U-variable-array-key](#ev-u-variable-array-key) | yes [V-array-value](#ev-v-array-value) |
| Primitive / string / number | yes [ARHS-literals](#ev-assignment-rhs) | yes [P-output](#ev-p-output) | yes [P-condition](#ev-p-condition) | ? [U-primitive-source](#ev-u-primitive-source) | ? [U-primitive-tag-pos](#ev-u-primitive-tag-pos) | yes [P-tag-attr](#ev-p-tag-attr) | yes [P-call-arg](#ev-p-call-arg) | yes [P-mod-input](#ev-p-mod-input) | yes [P-mod-arg](#ev-p-mod-arg) | yes [P-bracket](#ev-p-bracket) | yes [P-array-key](#ev-p-array-key) | yes [P-array-value](#ev-p-array-value) |
| Interpolated string (double-quoted) | ? [U-assignment-rhs](#ev-u-assignment-rhs) | yes [IS-output](#ev-is-output) | ? [U-is-condition](#ev-u-is-condition) | ? [U-is-source](#ev-u-is-source) | yes [IS-tag-pos](#ev-is-tag-pos) | yes [IS-tag-attr](#ev-is-tag-attr) | yes [IS-call-arg](#ev-is-call-arg) | yes [IS-mod-input](#ev-is-mod-input) | yes [IS-mod-arg](#ev-is-mod-arg) | ? [U-is-bracket](#ev-u-is-bracket) | ? [U-is-array-key](#ev-u-is-array-key) | ? [U-is-array-value](#ev-u-is-array-value) |
| Parenthesized expression | yes [ARHS-parenthesized](#ev-assignment-rhs) | yes [PA-output](#ev-pa-output) | ? [U-parenthesized-condition](#ev-u-parenthesized-condition) | ? [U-parenthesized-source](#ev-u-parenthesized-source) | ? [U-parenthesized-tag-pos](#ev-u-parenthesized-tag-pos) | ? [U-parenthesized-tag-attr](#ev-u-parenthesized-tag-attr) | yes [PA-call-arg](#ev-pa-call-arg) | yes [PA-mod-input](#ev-pa-mod-input) | yes [PA-mod-arg](#ev-pa-mod-arg) | yes [PA-bracket](#ev-pa-bracket) | yes [PA-array-key](#ev-pa-array-key) | ? [U-parenthesized-array-value](#ev-u-parenthesized-array-value) |
| Unary / arithmetic / comparison / boolean expression | limited [ARHS-operators](#ev-assignment-rhs) | yes [OP-output](#ev-op-output) | yes [OP-condition](#ev-op-condition) | ? [U-operator-source](#ev-u-operator-source) | yes [OP-tag-pos](#ev-op-tag-pos) | yes [OP-tag-attr](#ev-op-tag-attr) | yes [OP-call-arg](#ev-op-call-arg) | limited [OP-mod-input](#ev-op-mod-input) | limited [OP-mod-arg](#ev-op-mod-arg) | limited [OP-bracket](#ev-op-bracket) | limited [OP-array-key](#ev-op-array-key) | ? [U-operator-array-value](#ev-u-operator-array-value) |
| Word comparison aliases (`eq`, `ne`, `neq`, `gt`, `ge`, `gte`, `lt`, `le`, `lte`) | ? [U-word-comparison](#ev-u-word-comparison) | yes [WC-output](#ev-wc-output) | yes [WC-condition](#ev-wc-condition) | ? [U-word-comparison](#ev-u-word-comparison) | yes [WC-tag-pos](#ev-wc-tag-pos) | yes [WC-tag-attr](#ev-wc-tag-attr) | yes [WC-call-arg](#ev-wc-call-arg) | ? [U-word-comparison](#ev-u-word-comparison) | yes [WC-mod-arg](#ev-wc-mod-arg) | ? [U-word-comparison](#ev-u-word-comparison) | ? [U-word-comparison](#ev-u-word-comparison) | yes [WC-array-value](#ev-wc-array-value) |
| Bitwise AND (`&`) | ? [U-assignment-rhs](#ev-u-assignment-rhs) | yes [BA-output](#ev-ba-output) | yes [BA-condition](#ev-ba-condition) | ? [U-bitwise](#ev-u-bitwise) | ? [U-bitwise](#ev-u-bitwise) | yes [BA-tag-attr](#ev-ba-tag-attr) | ? [U-bitwise](#ev-u-bitwise) | ? [U-bitwise](#ev-u-bitwise) | yes [BA-mod-arg](#ev-ba-mod-arg) | ? [U-bitwise](#ev-u-bitwise) | ? [U-bitwise](#ev-u-bitwise) | ? [U-bitwise](#ev-u-bitwise) |
| Modifier expression | yes [ARHS-modifier](#ev-assignment-rhs) | yes [M-output](#ev-m-output) | ? [U-modifier-condition](#ev-u-modifier-condition) | ? [U-modifier-source](#ev-u-modifier-source) | ? [U-modifier-tag-pos](#ev-u-modifier-tag-pos) | yes [M-tag-attr](#ev-m-tag-attr) | ? [U-modifier-call-arg](#ev-u-modifier-call-arg) | yes [M-mod-input](#ev-m-mod-input) | ? [U-modifier-mod-arg](#ev-u-modifier-mod-arg) | ? [U-modifier-bracket](#ev-u-modifier-bracket) | ? [U-modifier-array-key](#ev-u-modifier-array-key) | ? [U-modifier-array-value](#ev-u-modifier-array-value) |
| Property access (`->name`) | ? [U-assignment-rhs](#ev-u-assignment-rhs) | yes [PR-output](#ev-pr-output) | yes [PR-condition](#ev-pr-condition) | ? [U-property-source](#ev-u-property-source) | yes [PR-tag-pos](#ev-pr-tag-pos) | yes [PR-tag-attr](#ev-pr-tag-attr) | ? [U-property-call-arg](#ev-u-property-call-arg) | yes [PR-mod-input](#ev-pr-mod-input) | yes [PR-mod-arg](#ev-pr-mod-arg) | ? [U-property-bracket](#ev-u-property-bracket) | yes [PR-array-key](#ev-pr-array-key) | ? [U-property-array-value](#ev-u-property-array-value) |
| Method call (`->name(...)`) | ? [U-assignment-rhs](#ev-u-assignment-rhs) | yes [MC-output](#ev-mc-output) | yes [MC-condition](#ev-mc-condition) | yes [MC-source](#ev-mc-source) | yes [MC-tag-pos](#ev-mc-tag-pos) | yes [MC-tag-attr](#ev-mc-tag-attr) | yes [MC-call-arg](#ev-mc-call-arg) | yes [MC-mod-input](#ev-mc-mod-input) | yes [MC-mod-arg](#ev-mc-mod-arg) | ? [U-method-bracket](#ev-u-method-bracket) | ? [U-method-array-key](#ev-u-method-array-key) | ? [U-method-array-value](#ev-u-method-array-value) |
| Static index access (`.name`, `[expr]`) | ? [U-assignment-rhs](#ev-u-assignment-rhs) | yes [IX-output](#ev-ix-output) | yes [IX-condition](#ev-ix-condition) | ? [U-index-source](#ev-u-index-source) | yes [IX-tag-pos](#ev-ix-tag-pos) | yes [IX-tag-attr](#ev-ix-tag-attr) | ? [U-index-call-arg](#ev-u-index-call-arg) | yes [IX-mod-input](#ev-ix-mod-input) | yes [IX-mod-arg](#ev-ix-mod-arg) | ? [U-index-bracket](#ev-u-index-bracket) | ? [U-index-array-key](#ev-u-index-array-key) | ? [U-index-array-value](#ev-u-index-array-value) |
| Dynamic dot index (`.{$expr}`) | ? [U-dynamic-dot](#ev-u-dynamic-dot) | yes [DDI-output](#ev-ddi-output) | ? [U-dynamic-dot](#ev-u-dynamic-dot) | ? [U-dynamic-dot](#ev-u-dynamic-dot) | ? [U-dynamic-dot](#ev-u-dynamic-dot) | yes [DDI-tag-attr](#ev-ddi-tag-attr) | yes [DDI-call-arg](#ev-ddi-call-arg) | ? [U-dynamic-dot](#ev-u-dynamic-dot) | ? [U-dynamic-dot](#ev-u-dynamic-dot) | ? [U-dynamic-dot](#ev-u-dynamic-dot) | ? [U-dynamic-dot](#ev-u-dynamic-dot) | ? [U-dynamic-dot](#ev-u-dynamic-dot) |
| Section-name/property indices and `$smarty.section.name.property` | ? [U-assignment-rhs](#ev-u-assignment-rhs) | yes [S-output](#ev-s-output) | yes [S-condition](#ev-s-condition) | ? [U-section-source](#ev-u-section-source) | ? [U-section-tag-pos](#ev-u-section-tag-pos) | yes [S-tag-attr](#ev-s-tag-attr) | ? [U-section-call-arg](#ev-u-section-call-arg) | yes [S-mod-input](#ev-s-mod-input) | yes [S-mod-arg](#ev-s-mod-arg) | ? [U-section-bracket](#ev-u-section-bracket) | ? [U-section-array-key](#ev-u-section-array-key) | ? [U-section-array-value](#ev-u-section-array-value) |
| Loop metadata (`$item@name`) | ? [U-assignment-rhs](#ev-u-assignment-rhs) | yes [LM-output](#ev-lm-output) | yes [LM-condition](#ev-lm-condition) | ? [U-metadata-source](#ev-u-metadata-source) | ? [U-metadata-tag-pos](#ev-u-metadata-tag-pos) | yes [LM-tag-attr](#ev-lm-tag-attr) | yes [LM-call-arg](#ev-lm-call-arg) | yes [LM-mod-input](#ev-lm-mod-input) | yes [LM-mod-arg](#ev-lm-mod-arg) | ? [U-metadata-bracket](#ev-u-metadata-bracket) | ? [U-metadata-array-key](#ev-u-metadata-array-key) | ? [U-metadata-array-value](#ev-u-metadata-array-value) |
| Function call (`name(...)`) | yes [ARHS-call](#ev-assignment-rhs) | yes [FC-output](#ev-fc-output) | yes [FC-condition](#ev-fc-condition) | ? [U-function-source](#ev-u-function-source) | yes [FC-tag-pos](#ev-fc-tag-pos) | yes [FC-tag-attr](#ev-fc-tag-attr) | yes [FC-call-arg](#ev-fc-call-arg) | yes [FC-mod-input](#ev-fc-mod-input) | yes [FC-mod-arg](#ev-fc-mod-arg) | ? [U-function-bracket](#ev-u-function-bracket) | ? [U-function-array-key](#ev-u-function-array-key) | ? [U-function-array-value](#ev-u-function-array-value) |
| Array literal | yes [ARHS-array](#ev-assignment-rhs) | ? [U-array-output](#ev-u-array-output) | yes [AR-condition](#ev-ar-condition) | ? [U-array-source](#ev-u-array-source) | yes [AR-tag-pos](#ev-ar-tag-pos) | yes [AR-tag-attr](#ev-ar-tag-attr) | yes [AR-call-arg](#ev-ar-call-arg) | ? [U-array-mod-input](#ev-u-array-mod-input) | yes [AR-mod-arg](#ev-ar-mod-arg) | yes [AR-bracket](#ev-ar-bracket) | ? [U-array-array-key](#ev-u-array-array-key) | yes [AR-array-value](#ev-ar-array-value) |
| Typecast expression | ? [TC-unknown](#ev-tc-unknown) | yes [TC-impl](#ev-tc-impl) | yes [TC-impl](#ev-tc-impl) | ? [TC-unknown](#ev-tc-unknown) | yes [TC-impl](#ev-tc-impl) | yes [TC-impl](#ev-tc-impl) | yes [TC-impl](#ev-tc-impl) | yes [TC-impl](#ev-tc-impl) | yes [TC-impl](#ev-tc-impl) | yes [TC-impl](#ev-tc-impl) | yes [TC-impl](#ev-tc-impl) | yes [TC-impl](#ev-tc-impl) |
| Class constant (`Class::NAME`) | ? [U-assignment-rhs](#ev-u-assignment-rhs) | yes [CC-output](#ev-cc-output) | yes [CC-condition](#ev-cc-condition) | ? [U-constant-source](#ev-u-constant-source) | yes [CC-tag-pos](#ev-cc-tag-pos) | yes [CC-tag-attr](#ev-cc-tag-attr) | yes [CC-call-arg](#ev-cc-call-arg) | yes [CC-mod-input](#ev-cc-mod-input) | yes [CC-mod-arg](#ev-cc-mod-arg) | yes [CC-bracket](#ev-cc-bracket) | yes [CC-array-key](#ev-cc-array-key) | yes [CC-array-value](#ev-cc-array-value) |
| Static class method call (`Class::method(...)`) | ? [U-assignment-rhs](#ev-u-assignment-rhs) | yes [SM-output](#ev-sm-output) | yes [SM-condition](#ev-sm-condition) | yes [SM-source](#ev-sm-source) | yes [SM-tag-pos](#ev-sm-tag-pos) | yes [SM-tag-attr](#ev-sm-tag-attr) | yes [SM-call-arg](#ev-sm-call-arg) | yes [SM-mod-input](#ev-sm-mod-input) | yes [SM-mod-arg](#ev-sm-mod-arg) | yes [SM-bracket](#ev-sm-bracket) | yes [SM-array-key](#ev-sm-array-key) | yes [SM-array-value](#ev-sm-array-value) |
| Bare identifier (modifier, generic-tag, primary-expression, and array-key positions) | ? [U-assignment-rhs](#ev-u-assignment-rhs) | yes [ID-output](#ev-id-output) | yes [ID-condition](#ev-id-condition) | ? | yes [GT-ID-pos](#ev-gt-id-pos) | yes [GT-ID-attr](#ev-gt-id-attr) | yes [ID-call-arg](#ev-id-call-arg) | ? | yes [MOD-ID-arg](#ev-mod-id-arg) | ? | yes — bare ID keys already have a hand-authored tree in [array literals](../test/corpus/array-literals.txt#L12) | yes [ID-array-value](#ev-id-array-value) |

## Task 041 typecast expression composition audit

The pinned Smarty 5.8.4 lexer/parser accepts typecasts as `TYPECAST value`.
The supported cells have hand-authored trees and checks independently reviewed
in Task 041. Contexts still marked `?` remain unverified and are not implied by
the shared Smarty production.

| Context | Minimized Smarty 5.8.4 probe | Current Tree-sitter observation |
| --- | --- | --- |
| Output | `{(int) $x}` | Smarty recorder/full compiler accept; reviewed tree has a typecast node with operator and argument fields. |
| `if` condition | `{if (int) $x > 0}Y{/if}` | Smarty recorder/full compiler accept; reviewed comparison's left operand is a typecast. |
| Custom-tag positional argument | `{widget $a + (int) $x}` | Recorder emits one positional argument; reviewed tree retains the complete addition and cast under that argument. |
| Custom-tag named attribute | `{widget value=(int) $x}` | Recorder emits one `value` attribute; reviewed tree retains the cast as its value with no positional sibling. |
| Built-in assignment attribute | `{assign var=x value=(int) $x}` | Full compiler accepts; reviewed tree retains the cast under `attribute.value`. |
| Instance method argument | `{$o->f((int) $x)}` | Recorder accepts; reviewed tree retains the cast as the instance method's argument. Static and standalone calls remain unverified here. |
| Modifier input | `{(int) $x|escape}` | Controlled full-engine render accepts; reviewed tree retains the cast as modifier input. |
| Modifier argument | `{$x|default:(int) $y}` | Recorder/full compiler accept; reviewed tree retains the cast under modifier `argument`. |
| Bracket index | `{$a[(int) $x]}` | Recorder/full compiler accept; reviewed tree retains the cast under `index`. |
| Array key and value | `{array((int) $x=>"v", "k"=>(int) $y)}` | Recorder/full compiler accept; reviewed tree retains typecasts in both fields. |

Assignment RHS, foreach source, static class-method arguments, standalone
function-call arguments, loop bounds, and other expression positions remain
`?` in this task's composition inventory. The supported status in the combined
Function / method argument cell applies only to the confirmed instance-method
probe `{$o->f((int) $x)}`. The separate probe `{Thing::f((int) $x)}` is
Smarty-accepted, but Task 041 does not require its tree; static class-method and
standalone function-call pairings remain unverified here. The complete scope
and hand-tree contract are in [Task 041](tasks/041-typecast-expressions.md).

<a id="ev-tc-impl"></a>

**TC-impl:** Hand-authored trees and reference/compiler checks for the supported
contexts are in [Task 041](tasks/041-typecast-expressions.md) and
[`typecast-expressions.test.mjs`](../test/typecast-expressions.test.mjs). The
Node checks require the complete cast tree, exact source ranges, precedence,
unknown-tag argument/attribute ownership, malformed recovery, and incremental
edit equivalence. In the combined Function / method argument matrix cell, only
the instance-method example is checked; static and standalone calls remain `?`.
The recorder checks syntax and argument counts, not cast structure.

<a id="ev-tc-unknown"></a>

**TC-unknown:** No Task 041 tree or composition check is specified for this
context; retain it as unverified even where a separate compiler probe accepted
a related source form.

The Task 038 row tracks an output wrapper used as the expression inside a
bracket index. Pinned Smarty 5.8.4 and hand-authored trees verify the wrapper in
output values, generic-tag attribute values, and nested bracket indices;
arithmetic precedence, method/config composition, modifiers, source ranges,
recovery boundaries, and incremental edits are checked. Other context pairings
remain unknown. Task 039 separately verifies the wrapper as an operand in
`if`/`elseif` conditions; its cell does not imply support in other contexts.
See [Task 038 implementation evidence](tasks/038-braced-expressions-in-bracket-indices.md)
and [Task 039 condition evidence](tasks/039-braced-expressions-in-conditions.md).

<a id="ev-b-index"></a>

**B-index:** `{$a[{$x}]}` retains an outer output, `index_expression`, and
nested `output(value: variable)`; direct `$a[$x]` retains its direct index
child. The same nested structure is tested in generic-tag attribute values,
left-nested method/config index chains, arithmetic, modifier expressions, and
nested indices. Exact source ranges and independent following output are
asserted. Pinned Smarty 5.8.4 accepts the valid probes; malformed missing-bracket
cases have localized `ERROR` trees that preserve following output and, in a
block, the close tag. See [hand trees](../test/corpus/braced-bracket-indices.txt),
[reference fixtures](../test/corpus/smarty-reference-braced-bracket-indices.txt),
and [checks](../test/braced-bracket-indices.test.mjs).

<a id="ev-b-mod-arg"></a>

**B-mod-arg:** A complete braced expression after a modifier colon is retained
as `modifier_expression.argument: output(value: expression)`. Hand trees check
the wrapper and inner-expression ranges, repeated arguments, arithmetic
precedence, inner and outer modifier ownership, separate method/index operands,
and the application-shaped method chain. The wrapper composes in output,
generic-tag attribute, condition, instance-method argument, and array-value
contexts. The pinned recorder checks names, event order, and argument counts;
controlled full-engine `cat` renders check value grouping. Malformed missing
brace, missing operand, and duplicate-colon probes are rejected by Smarty while
Tree-sitter retains a later output. See [trees](../test/corpus/braced-modifier-arguments.txt),
[reference/compiler/recovery/edit checks](../test/braced-modifier-arguments.test.mjs),
and [Task 049 evidence](tasks/049-braced-modifier-arguments.md#implementation-evidence).

## Task 039 braced expressions in conditions

The Task 038 application report records a braced method expression directly
inside the `{if}` condition at `view_certificate/actions_list.tpl:41`; the
second report error at line 54 is downstream recovery from that opening tag.
The pinned Smarty 5.8.4 recorder and full engine in compile-only mode accept
`{if {$x}}`, `{if {$x} > 0}`, and braced `elseif` operands. Hand-authored trees
establish ownership: `if_tag.condition` or `elseif_tag.condition` contains the
complete existing expression, and each braced operand is a nested
`output(value: expression)` primary. Direct conditions remain unwrapped;
operators inside a wrapper and around it retain their existing precedence,
associativity, and fields. Tests cover arithmetic inside braces, outer
comparison and boolean composition, a braced modifier and method chain, the
application-shaped method condition, nested block composition, exact ranges,
reference/compiler observations, and incremental edits. The recorder's
output-before-control-tag event order does not establish condition ownership.

Recovery checks reject inner-leading whitespace while preserving an independent
trailing output; retain a left braced operand and local operator error for a
missing right-hand side; preserve recognizable close recovery and later output
when the outer header close is missing; and retain condition/body navigation
for unclosed or crossed blocks. A crossed close with no matching `{/if}` can
produce a root `ERROR` containing the recognized `if_tag`, body, crossed-close
recovery, and a distinct error-free trailing output descendant; a completed
`if_block` or synthetic `if_close_tag` is not required. This cell confirms only
the tested braced-operand compositions within conditions, not broader Smarty
conditional syntax or other braced-wrapper contexts. See the [Task 039 trees](../test/corpus/braced-conditions.txt),
[checks](../test/braced-conditions.test.mjs), and [brief/completion evidence](tasks/039-braced-expressions-in-conditions.md).

<a id="ev-u-braced-condition"></a>

## Task 036 modifier-prefix composition evidence

The existing `Modifier expression` row describes unprefixed expressions; its
evidence does not establish the optional-prefix spellings. Task 036 adds
`|@name` and the independently compiler-confirmed adjacent form `|@@name`.
This table records the exact tested contexts and the prefixed forms that remain
unverified.

| Prefix form/context | Task 036 disposition | Required or remaining boundary |
| --- | --- | --- |
| `|@name` and `|@@name` as output value | yes — [trees](../test/corpus/modifier-at-prefix.txt), [range/reference checks](../test/modifier-at-prefix.test.mjs) | Both modifier-name ranges and recorder events are checked |
| `|@name` as generic-tag named attribute value | yes — [tree](../test/corpus/modifier-at-prefix.txt), [composition/reference check](../test/modifier-at-prefix.test.mjs) | Attribute owns the full modifier value; recorder checks modifier then tag events and argument counts |
| `|@@name` as generic-tag named attribute value | Unverified | Must not be inferred from the output form |
| Prefixes in assignment RHS, conditions, foreach sources, generic-tag positional arguments, function/method arguments, `for` bounds/conditions/initializers/updates, section loop values, modifier inputs, bracket-index expressions, and array values | Unverified | Existing `modifier_expression` reachability does not establish prefixed-form acceptance in these contexts |
| Prefixes in parenthesized modifier arguments and array keys | Unverified | Parentheses can contain a full modifier expression; this form is not part of Task 036's required contexts |

The chain-composition fixture also checks a prefixed modifier as the input to a
following unprefixed modifier. It verifies the tree interaction only; the
modifier-input context above remains unverified for general prefixed forms.

## Task 037 braced generic-tag attribute values

Pinned Smarty 5.8.4 accepts a generic-tag named attribute whose value is an
expression enclosed in braces, including a plain variable, arithmetic
expression, string, and dynamic-dot index. The recording adapter reports no
compiler error and records the attribute name, but emits an `output` event
before the tag event for this source form. Its event projection does not expose
the attribute value; tree structure must be checked explicitly. The grammar
represents this syntax as `attribute.value: output(value: expression)`, including
the application witness
`selected={$label_type_ids.{$heatshrink_printer->get_id()}}`. The wrapper is
supported across the tested expression types, not only dynamic-dot indices.
The [Task 037 trees](../test/corpus/braced-tag-attribute-values.txt),
[reference fixture](../test/corpus/smarty-reference-braced-tag-attribute-values.txt),
[Node checks](../test/braced-tag-attribute-values.test.mjs), and
[implementation evidence](tasks/037-braced-generic-tag-attribute-values.md)
establish wrapper shape, ranges, malformed recovery, neighboring values, and
incremental edits. The recorder's event order still does not establish value
ownership.

| Cell | Current boundary and required evidence |
| --- | --- |
| <a id="ev-u-braced-tag-attr"></a>U-braced-tag-attr | **yes:** `{widget value={$x}}` and `{widget value={$x + $y}}` retain `attribute.value: output(value: expression)`; direct `{widget value=$x}` remains unwrapped. Hand trees, reference acceptance, neighboring-attribute/order checks, malformed-recovery/sibling checks, and edits across direct/wrapped/rejected forms pass. [trees](../test/corpus/braced-tag-attribute-values.txt); [reference fixture](../test/corpus/smarty-reference-braced-tag-attribute-values.txt); [Node checks](../test/braced-tag-attribute-values.test.mjs); [completion evidence](tasks/037-braced-generic-tag-attribute-values.md) |

## Generic-tag attribute-name composition

Attribute spelling is a tag-structure concern rather than an expression row in
the matrix above. The `tag_attribute_name` leaf is tested in the same
`attribute` `name` field with string, variable, direct bare-ID, and
parenthesized-expression values. It supports the corpus-backed `data-*` and
`aria-*` forms, digit prefixes, multi-segment single-colon names such as
`foo:bar:baz`. Smarty 5.8.4 accepts `{widget foo:bar:baz=MODE}{$later}` and
`{widget foo:=MODE}{$later}`; the first has a positive Tree-sitter tree, while
the valid terminal-colon form remains an explicit error/recovery gap with
following output preserved. `{widget foo:}` without `=` is malformed.
Smarty also accepts both `{widget foo::bar=MODE}` and
`{widget foo::bar = MODE data-id = "x"}`; Tree-sitter deliberately retains them
as error/recovery cases, with a later independent output still navigable. The
reference assertions and hand-authored positive/recovery trees are in
[Task 023](tasks/023-smarty-tag-attribute-names.md#partial-boundary-revision-2026-10-01).
Terminal-colon and repeated-colon attributes remain explicit project-level
partial gaps and are not claimed Smarty syntax rejections.

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
cells record the direct generic-tag pairings verified by Task 018. The
`Interpolated string` row is also separate from the historical Task 015
totals. Task 020's implementation has passing tree and reference evidence for
the three cells marked `yes` below: output, custom-tag attribute, and modifier
argument. Independent implementation review accepted. The other eight
pairings remain unknown; the three tested cells do not establish broader
composition support.

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

## Task 020 interpolated-string composition audit

Task 020's implementation and independent review are complete. Its
hand-authored trees and Node/reference/render checks are present in the
[interpolation fixtures](../test/corpus/interpolated-strings.txt) and
[interpolation checks](../test/interpolated-strings.test.mjs). The three `yes`
cells below have passing trees and pinned-reference checks; the recorder
confirms syntax/events but does not inspect interpolation structure or values.
The other eight pairings remain
`?` because this audit did not test them; they are not declared unsupported or
excluded from the project target.

| Cell | Exact minimized composition | Current result and evidence |
| --- | --- | --- |
| <a id="ev-is-output"></a>IS-output | Output: `{"Hello $name"}` | **yes:** hand tree retains fragment and variable interpolation; fixture passes pinned Smarty reference and full-engine render. [fixture](../test/corpus/interpolated-strings.txt); [Node checks](../test/interpolated-strings.test.mjs). |
| <a id="ev-is-tag-attr"></a>IS-tag-attr | Custom-tag attribute: `{widget value="id_{$item}"}` | **yes:** hand tree preserves the attribute field and braced variable interpolation; fixture passes pinned Smarty reference. [fixture](../test/corpus/interpolated-strings.txt); [Node checks](../test/interpolated-strings.test.mjs). |
| <a id="ev-is-tag-pos"></a>IS-tag-pos | Custom-tag positional value containing `{if}`: `{widget "before {if $a}yes{/if}"}` | **yes:** the interpolation owns the complete `if_block`; pinned Smarty reference confirms tag/branch event order. [Task 047 trees](../test/corpus/tags-in-quoted-attributes.txt); [Node/reference/compiler/recovery/edit checks](../test/tags-in-quoted-attributes.test.mjs). |
| <a id="ev-is-call-arg"></a>IS-call-arg | Function and method arguments containing `{if}` blocks | **yes:** both call forms retain the interpolated string argument and nested block; recorder and full compiler accept the reduced sources. [Task 047 trees](../test/corpus/tags-in-quoted-attributes.txt); [Node/reference/compiler checks](../test/tags-in-quoted-attributes.test.mjs). |
| <a id="ev-is-mod-input"></a>IS-mod-input | Modifier input: `{"before {if $a}yes{else}no{/if} after"|escape}` | **yes:** the modifier's `value` owns the complete interpolated string and nested conditional. [Task 047 trees](../test/corpus/tags-in-quoted-attributes.txt); [Node/reference/compiler checks](../test/tags-in-quoted-attributes.test.mjs). |
| <a id="ev-is-nested-output"></a>IS-nested-output | An output with an inner quoted method argument inside a conditional in an outer quoted attribute | **yes:** `output > method_call_expression > string` remains inside the conditional and the attribute interpolation; recorder and full compiler accept the exact fixture. [Task 047 trees](../test/corpus/tags-in-quoted-attributes.txt); [Node/reference/compiler checks](../test/tags-in-quoted-attributes.test.mjs). |
| <a id="ev-is-escaped-braces"></a>IS-escaped-braces | Escaped braces surrounding a conditional in an outer quoted attribute | **yes:** escaped brace spellings remain string-fragment text around the recognized conditional; recorder and full compiler accept the exact fixture. [Task 047 trees](../test/corpus/tags-in-quoted-attributes.txt); [Node/reference/compiler checks](../test/tags-in-quoted-attributes.test.mjs). |
| <a id="ev-is-unknown-tags"></a>IS-unknown-tags | Unknown opening and closing tags inside one quoted value | **yes:** accepted generic tags remain separate `string_interpolation(value: custom_tag/custom_close_tag)` children, with no inferred pairing. [Task 047 trees/reference check](../test/corpus/tags-in-quoted-attributes.txt); [Node/reference checks](../test/tags-in-quoted-attributes.test.mjs). |
| <a id="ev-is-mod-arg"></a>IS-mod-arg | Modifier argument: `{$value|default:"id_{$item}"}` | **yes:** hand tree preserves the modifier argument field and braced variable interpolation; fixture passes pinned Smarty reference. [fixture](../test/corpus/interpolated-strings.txt); [Node checks](../test/interpolated-strings.test.mjs). |

The backtick boundary is distinct from the three context cells above. In pinned
Smarty 5.8.4, a backtick immediately followed by `$` enters `TAGBODY`. Braces
inside ordinary backticks still start interpolation, with the backticks
preserved as string text. The function-like text in backticks that are not
immediately followed by `$` does not evaluate as a backtick expression. These
full-engine render results use `$name = "world"`:

```text
{"Hello `$name`"}         => Hello world
{"Hello `{$name}`"}       => Hello `world`
{"Hello `strtoupper($name)`"} => Hello `strtoupper(world)`
```

The pinned lexer rule is `backtick dollar` in
[`TemplateLexer.plex`](../vendor/smarty/smarty/src/Lexer/TemplateLexer.plex)
(around lines 658–663); full-engine render evidence and the source audit are
recorded in [Task 020](tasks/020-double-quoted-interpolation.md). Of the 23
current earliest-tag corpus contexts, all 23 contain a real direct-dollar,
braced, or immediate-backtick-dollar interpolation; six use the last form.
None is counted solely because a literal backtick-delimited function spelling
was mistaken for expression interpolation.

Task 020 also covers the lexer's dollar-ID boundary: non-ID dollars remain
literal string contents (`$`, `$!`, `$5`, and `Price $5` keep the `string`
node), while digit-prefixed `$5a` and `$5_` are interpolated variable nodes.
Pinned Smarty reference and full-engine checks cover both the literal outputs
and digit-prefixed variable rendering. The numeric prefix is supported only in
this interpolation path; unquoted `{$5a}` is valid Smarty but remains an
unsupported follow-up outside this task. A literal
`$` or `$5` fragment immediately followed by `$name` also remains a fragment
before the interpolation, rendering `$world` or `$5world` respectively.

## Task 021 bitwise AND composition audit (complete)

The reviewed grammar accepts `&` in the tested shared-expression contexts
below. Pinned Smarty 5.8.4 accepts each minimized source. The reference
projection confirms syntax and outer events only; hand-authored trees establish
operand structure, and controlled full-engine checks establish precedence and
values. Other context cells remain unverified. Corpus evidence and
implementation limitations are recorded in
[completed Task 021](tasks/021-bitwise-and.md).

| Cell | Minimized composition | Current result and evidence |
| --- | --- | --- |
| <a id="ev-ba-output"></a>BA-output | Output: `{$a & $b}` | **yes:** hand tree exposes `binary_expression` in the output value; the pinned recorder reports one output. [fixture](../test/corpus/bitwise-and.txt); [checks](../test/bitwise-and.test.mjs); [Task 021](tasks/021-bitwise-and.md) |
| <a id="ev-ba-condition"></a>BA-condition | Condition: `{if $flags & $smarty.const.FLAG_OK}Y{/if}` | **yes:** hand tree exposes method/value and config-index operands under the condition; the recorder reports the `if` and closer. The corpus gains 12 structurally inspected condition roots. [fixture](../test/corpus/bitwise-and.txt); [checks](../test/bitwise-and.test.mjs); [Task 021](tasks/021-bitwise-and.md) |
| <a id="ev-ba-tag-attr"></a>BA-tag-attr | Generic-tag attribute: `{widget value=($a & $b)}` | **yes:** hand tree exposes the parenthesized bitwise expression in the attribute value; pinned recording parser accepts the tag and named argument (full compiler lacks an application `widget` plugin). [fixture](../test/corpus/bitwise-and.txt); [checks](../test/bitwise-and.test.mjs); [Task 021](tasks/021-bitwise-and.md) |
| <a id="ev-ba-mod-arg"></a>BA-mod-arg | Parenthesized modifier argument: `{$x|default:($a & $b)}` | **yes:** hand tree exposes the modifier argument and the controlled full engine compiles it; the recorder accepts `default` with one argument. [fixture](../test/corpus/bitwise-and.txt); [checks](../test/bitwise-and.test.mjs); [Task 021](tasks/021-bitwise-and.md) |

## Task 030 section-index composition audit

Task 030 verifies the five `yes` cells below with explicit trees and pinned
Smarty syntax observations. Other section-index pairings remain unknown until
they have their own minimized probes; section block nesting does not prove them.

| Cell | Minimized composition | Current result and evidence |
| --- | --- | --- |
| <a id="ev-s-output"></a>S-output | Output: `{$smarty.section.rows.index}` and `{$items[rows]}` | **yes:** special properties and section-name bracket indices retain dedicated tree nodes. [reference trees](../test/corpus/smarty-reference.txt); [checks](../test/section-blocks.test.mjs) |
| <a id="ev-s-condition"></a>S-condition | Condition: `{if $smarty.section.rows.first && $items[rows.index]}...{/if}` | **yes:** the condition preserves `section_property_expression` and `section_property_index`. [composition tree](../test/corpus/section-blocks.txt); [checks](../test/section-blocks.test.mjs) |
| <a id="ev-s-tag-attr"></a>S-tag-attr | Custom-tag attribute: `{widget value=$items[rows]}` | **yes:** the attribute value contains `index_expression` and `section_index`. [composition tree](../test/corpus/section-blocks.txt); [checks](../test/section-blocks.test.mjs) |
| <a id="ev-s-mod-input"></a>S-mod-input | Modifier input: `{$items[rows]|default:0}` | **yes:** the modifier value preserves `section_index`. [composition tree](../test/corpus/section-blocks.txt); [checks](../test/section-blocks.test.mjs) |
| <a id="ev-s-mod-arg"></a>S-mod-arg | Modifier argument: `{$items[rows]|default:$smarty.section.rows.iteration}` | **yes:** the modifier argument remains `section_property_expression`. [composition tree](../test/corpus/section-blocks.txt); [checks](../test/section-blocks.test.mjs) |

## Task 034 word-comparison composition audit

Task 034 supports the listed cells with hand-authored trees and fixture-driven
checks. The grouped function/method cell is marked yes from the function-call
argument case; direct method-argument composition remains unverified.

| Cell | Minimized composition | Current result and evidence |
| --- | --- | --- |
| <a id="ev-wc-output"></a>WC-output | Output: `{$a eq $b}` | **yes:** `binary_expression` retains variable operands and a letter-only `word_operator`. [trees](../test/corpus/word-comparison-operators.txt); [checks](../test/word-comparison-operators.test.mjs) |
| <a id="ev-wc-condition"></a>WC-condition | `if`, `elseif`, and spaced `else if` comparison conditions | **yes:** each condition field retains the full binary expression. Task 046 also composes method calls and word comparisons inside a spaced branch nested in `foreach`, and a braced output condition in another spaced branch. [operator trees/checks](../test/corpus/word-comparison-operators.txt); [spaced-branch trees/checks](../test/corpus/else-if-branches.txt), [Task 046 checks](../test/else-if-branches.test.mjs) |
| <a id="ev-wc-tag-pos"></a>WC-tag-pos | `{widget $a lt $b ...}` | **yes:** the unknown tag keeps the comparison under a positional `argument`. [trees](../test/corpus/word-comparison-operators.txt); [checks](../test/word-comparison-operators.test.mjs) |
| <a id="ev-wc-tag-attr"></a>WC-tag-attr | `{widget ... value=$a gte $b}` | **yes:** the attribute `value` contains the full comparison tree. [trees](../test/corpus/word-comparison-operators.txt); [checks](../test/word-comparison-operators.test.mjs) |
| <a id="ev-wc-call-arg"></a>WC-call-arg | `{f($a lte $b, [...])}` | **yes:** the call retains its comparison argument; method-call arguments remain unverified. [trees](../test/corpus/word-comparison-operators.txt); [checks](../test/word-comparison-operators.test.mjs) |
| <a id="ev-wc-array-value"></a>WC-array-value | `f(..., [$a neq $b])` | **yes:** the array element `value` contains the comparison tree. [trees](../test/corpus/word-comparison-operators.txt); [checks](../test/word-comparison-operators.test.mjs) |
| <a id="ev-wc-mod-arg"></a>WC-mod-arg | `{$value|default:($a ge $b)}` | **yes:** a parenthesized modifier argument retains the complete comparison tree. [trees](../test/corpus/word-comparison-operators.txt); [checks](../test/word-comparison-operators.test.mjs) |

## Task 035 dynamic-dot index composition

Task 035 verifies the three `yes` cells with a full index-expression tree and
pinned Smarty syntax observations. The grouped function/method argument cell is
marked yes from a function-call argument; method-call arguments remain
unverified. Other dynamic-dot composition cells are still unknown.

| Cell | Minimized composition | Current result and evidence |
| --- | --- | --- |
| <a id="ev-ddi-output"></a>DDI-output | Output: `{$map.{$key + 1 * 2}}` | **yes:** `index_expression.index` retains the complete arithmetic expression and multiplication precedence. [trees](../test/corpus/dynamic-dot-index.txt); [checks](../test/dynamic-dot-index.test.mjs) |
| <a id="ev-ddi-tag-attr"></a>DDI-tag-attr | Generic-tag attribute: `{html_options selected=$labels.{$printer->get_id()}}` | **yes:** the tag name, `selected` attribute, receiver, and method-call index remain structural. Recorder checks confirm tag/argument names only. [trees](../test/corpus/dynamic-dot-index.txt); [checks](../test/dynamic-dot-index.test.mjs) |
| <a id="ev-ddi-call-arg"></a>DDI-call-arg | Function argument: `{helper($map.{$key})}` | **yes:** the function argument retains the complete dynamic index; method-call arguments remain unverified. [trees](../test/corpus/dynamic-dot-index.txt); [checks](../test/dynamic-dot-index.test.mjs) |

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
| <a id="ev-op-output"></a>OP-output, <a id="ev-op-condition"></a>OP-condition, <a id="ev-op-tag-pos"></a>OP-tag-pos, <a id="ev-op-tag-attr"></a>OP-tag-attr, <a id="ev-op-call-arg"></a>OP-call-arg, <a id="ev-op-mod-input"></a>OP-mod-input, <a id="ev-op-mod-arg"></a>OP-mod-arg, <a id="ev-op-bracket"></a>OP-bracket, <a id="ev-op-array-key"></a>OP-array-key | Unary/arithmetic/comparison/boolean expressions in output, condition, custom positional/attribute value, call argument, modifier input/argument, bracket index, and array keys. `OP-mod-input` is limited to the tested parenthesized unary value; `OP-mod-arg` requires parentheses around a full compound expression. `OP-array-key` now covers the tested unary keys (`-1`, `+1`, `-$x`, `!$x`, and `not $x`) plus the existing parenthesized compound key; unparenthesized binary keys remain rejected. Typecasts have separate reviewed composition evidence in Task 041. `OP-bracket` directly evidences arithmetic only. | [operators](../test/corpus/condition-operators.txt), [index](../test/corpus/index-access.txt), [arrays](../test/corpus/array-literals.txt) | [operators](../test/condition-operators.test.mjs#L5), [index](../test/index-access.test.mjs#L4), [array trees](../test/corpus/array-literals.txt), [unary-key checks](../test/unary-array-keys.test.mjs) |
| <a id="ev-m-output"></a>M-output, <a id="ev-m-tag-attr"></a>M-tag-attr, <a id="ev-m-mod-input"></a>M-mod-input | Modifier expression as output and attribute value; a nested modifier is also the input to the outer modifier. | [initial](../test/corpus/initial.txt), [operators](../test/corpus/condition-operators.txt) | [initial/reference](../test/reference.test.mjs#L4), [operators](../test/condition-operators.test.mjs#L5) |
| <a id="ev-pr-output"></a>PR-output, <a id="ev-pr-condition"></a>PR-condition, <a id="ev-pr-tag-pos"></a>PR-tag-pos, <a id="ev-pr-tag-attr"></a>PR-tag-attr, <a id="ev-pr-mod-input"></a>PR-mod-input, <a id="ev-pr-mod-arg"></a>PR-mod-arg, <a id="ev-pr-array-key"></a>PR-array-key | Property access in output, condition, custom-tag positional/attribute values, modifier input/argument, and as a compound array key. | [properties](../test/corpus/object-properties.txt), [arrays](../test/corpus/array-literals.txt) | [property checks](../test/object-properties.test.mjs#L5), [array checks](../test/array-literals.test.mjs#L6) |
| <a id="ev-mc-output"></a>MC-output, <a id="ev-mc-condition"></a>MC-condition, <a id="ev-mc-source"></a>MC-source, <a id="ev-mc-tag-pos"></a>MC-tag-pos, <a id="ev-mc-tag-attr"></a>MC-tag-attr, <a id="ev-mc-call-arg"></a>MC-call-arg, <a id="ev-mc-mod-input"></a>MC-mod-input, <a id="ev-mc-mod-arg"></a>MC-mod-arg | Method calls as output, condition, foreach source, custom-tag positional/attribute values, nested method argument, modifier input, and modifier argument. | [methods](../test/corpus/object-method-calls.txt), [foreach](../test/corpus/foreach.txt) | [method checks](../test/object-method-calls.test.mjs#L4), [foreach checks](../test/foreach.test.mjs#L5) |
| <a id="ev-ix-output"></a>IX-output, <a id="ev-ix-condition"></a>IX-condition, <a id="ev-ix-tag-pos"></a>IX-tag-pos, <a id="ev-ix-tag-attr"></a>IX-tag-attr, <a id="ev-ix-mod-input"></a>IX-mod-input, <a id="ev-ix-mod-arg"></a>IX-mod-arg | Index access as output, condition, custom-tag positional/attribute value, modifier input, and modifier argument. | [index access](../test/corpus/index-access.txt) | [index checks](../test/index-access.test.mjs#L4) |
| <a id="ev-lm-output"></a>LM-output, <a id="ev-lm-condition"></a>LM-condition, <a id="ev-lm-tag-attr"></a>LM-tag-attr, <a id="ev-lm-call-arg"></a>LM-call-arg, <a id="ev-lm-mod-input"></a>LM-mod-input | Loop metadata as output, condition operand, attribute value, function/method argument, and modifier input. The runtime property/binding is not validated by the recorder. | [metadata](../test/corpus/loop-metadata.txt) | [metadata fixture checks](../test/loop-metadata.test.mjs#L5), [call-argument structure](../test/loop-metadata.test.mjs#L71) |
| <a id="ev-lm-mod-arg"></a>LM-mod-arg | **yes:** direct `$item@index` modifier arguments preserve `loop_metadata_expression` fields; same-output `default`/`escape` composition retains ordinary arguments and chaining. Pinned Smarty confirms syntax/event order only. | [hand-authored direct and composition trees](../test/corpus/loop-metadata-modifier-arguments.txt); [reference, malformed-recovery and incremental-edit checks](../test/loop-metadata-modifier-arguments.test.mjs); [Task 016 evidence](tasks/016-loop-metadata-modifier-argument.md) | [recording adapter](../test/reference.php), pinned to Smarty 5.8.4 |
| <a id="ev-fc-output"></a>FC-output, <a id="ev-fc-condition"></a>FC-condition, <a id="ev-fc-tag-pos"></a>FC-tag-pos, <a id="ev-fc-tag-attr"></a>FC-tag-attr, <a id="ev-fc-call-arg"></a>FC-call-arg, <a id="ev-fc-mod-input"></a>FC-mod-input, <a id="ev-fc-mod-arg"></a>FC-mod-arg | Function calls as output, condition, custom-tag positional/attribute value, method argument, modifier input, and modifier argument. | [calls](../test/corpus/standalone-function-calls.txt) | [call checks](../test/standalone-function-calls.test.mjs#L5) |
| <a id="ev-ar-condition"></a>AR-condition, <a id="ev-ar-tag-pos"></a>AR-tag-pos, <a id="ev-ar-tag-attr"></a>AR-tag-attr, <a id="ev-ar-call-arg"></a>AR-call-arg, <a id="ev-ar-mod-arg"></a>AR-mod-arg, <a id="ev-ar-bracket"></a>AR-bracket, <a id="ev-ar-array-value"></a>AR-array-value | Array literal in condition, custom-tag positional/attribute value, method argument, modifier argument, bracket-index expression, and as a nested array value. | [arrays](../test/corpus/array-literals.txt) | [array checks](../test/array-literals.test.mjs#L6) |
| <a id="ev-cc-output"></a>CC-output, <a id="ev-cc-condition"></a>CC-condition, <a id="ev-cc-tag-pos"></a>CC-tag-pos, <a id="ev-cc-tag-attr"></a>CC-tag-attr, <a id="ev-cc-call-arg"></a>CC-call-arg, <a id="ev-cc-mod-input"></a>CC-mod-input, <a id="ev-cc-mod-arg"></a>CC-mod-arg, <a id="ev-cc-bracket"></a>CC-bracket, <a id="ev-cc-array-key"></a>CC-array-key, <a id="ev-cc-array-value"></a>CC-array-value | Class constant in each listed expression context; the new key/value fixture asserts the explicit `array_element` key and value fields. | [constants](../test/corpus/class-constants.txt) | [constant fixture/reference checks](../test/class-constants.test.mjs#L4), [array key/value field check](../test/class-constants.test.mjs#L18) |
| <a id="ev-mod-id-arg"></a>MOD-ID-arg | A direct static Smarty `ID` modifier argument is an `identifier`, including digit-prefixed `123foo`; numeric, boolean, null, and class-constant arguments retain their separate node types. | [hand-authored modifier trees](../test/corpus/modifier-identifiers.txt), [pinned reference, full-engine, context-exclusion and edit checks](../test/static-modifier-arguments.test.mjs#L1) | [Task 017 evidence](tasks/017-static-modifier-arguments.md) |
| <a id="ev-id-output"></a>ID-output, <a id="ev-id-condition"></a>ID-condition, <a id="ev-id-call-arg"></a>ID-call-arg, <a id="ev-id-array-value"></a>ID-array-value | A bare Smarty ID is an `identifier` primary in output comparisons, an `if` condition, function and method arguments, and array-element values. Digit-prefixed `123foo` remains one ID; lowercase/mixed-case boolean and null spellings keep their primitive types; tag-root `{123foo}` remains a custom tag. | [hand-authored trees](../test/corpus/static-identifier-expressions.txt) | [reference, full-engine, field/range, malformed recovery, tag boundary and edit checks](../test/static-identifier-expressions.test.mjs#L1); [Task 022 evidence](tasks/022-static-identifier-expressions.md#implementation-evidence-2026-10-01) |
| <a id="ev-gt-id-pos"></a>GT-ID-pos, <a id="ev-gt-id-attr"></a>GT-ID-attr | Direct static Smarty IDs, including `123foo`, are `identifier` nodes in generic-tag positional and attribute-value fields; primitive, numeric, variable, string, and class-constant values retain their distinct types. The recorder checks event names/order/count, and the full engine renders the built-in block example. | [hand-authored trees](../test/corpus/generic-tag-identifier-values.txt), [reference, full-engine, recovery and edit checks](../test/generic-tag-identifier-values.test.mjs) | Pinned Smarty 5.8.4 parser productions `value ::= ID`, `attribute ::= SPACE value`, and `attribute ::= SPACE ID EQUAL ID`; [018](tasks/018-generic-tag-identifier-values.md) |

### Unverified pairings

<a id="ev-u-variable-array-key"></a><a id="ev-u-primitive-source"></a><a id="ev-u-primitive-tag-pos"></a><a id="ev-u-parenthesized-condition"></a><a id="ev-u-parenthesized-source"></a><a id="ev-u-parenthesized-tag-pos"></a><a id="ev-u-parenthesized-tag-attr"></a><a id="ev-u-parenthesized-array-value"></a><a id="ev-u-operator-source"></a><a id="ev-u-operator-array-value"></a><a id="ev-u-modifier-condition"></a><a id="ev-u-modifier-source"></a><a id="ev-u-modifier-tag-pos"></a><a id="ev-u-modifier-call-arg"></a><a id="ev-u-modifier-mod-arg"></a><a id="ev-u-modifier-bracket"></a><a id="ev-u-modifier-array-key"></a><a id="ev-u-modifier-array-value"></a><a id="ev-u-property-source"></a><a id="ev-u-property-call-arg"></a><a id="ev-u-property-bracket"></a><a id="ev-u-property-array-value"></a><a id="ev-u-method-bracket"></a><a id="ev-u-method-array-key"></a><a id="ev-u-method-array-value"></a><a id="ev-u-index-source"></a><a id="ev-u-index-call-arg"></a><a id="ev-u-index-bracket"></a><a id="ev-u-index-array-key"></a><a id="ev-u-index-array-value"></a><a id="ev-u-metadata-source"></a><a id="ev-u-metadata-tag-pos"></a><a id="ev-u-metadata-bracket"></a><a id="ev-u-metadata-array-key"></a><a id="ev-u-metadata-array-value"></a><a id="ev-u-function-source"></a><a id="ev-u-function-bracket"></a><a id="ev-u-function-array-key"></a><a id="ev-u-function-array-value"></a><a id="ev-u-array-output"></a><a id="ev-u-array-source"></a><a id="ev-u-array-mod-input"></a><a id="ev-u-array-array-key"></a><a id="ev-u-constant-source"></a>

<a id="ev-u-is-condition"></a><a id="ev-u-is-source"></a><a id="ev-u-is-tag-pos"></a><a id="ev-u-is-call-arg"></a><a id="ev-u-is-mod-input"></a><a id="ev-u-is-bracket"></a><a id="ev-u-is-array-key"></a><a id="ev-u-is-array-value"></a><a id="ev-u-bitwise"></a>
<a id="ev-u-word-comparison"></a>
<a id="ev-u-dynamic-dot"></a>
<a id="ev-u-section-source"></a><a id="ev-u-section-tag-pos"></a><a id="ev-u-section-call-arg"></a><a id="ev-u-section-bracket"></a><a id="ev-u-section-array-key"></a><a id="ev-u-section-array-value"></a>
<a id="ev-u-assignment-rhs"></a>

<a id="ev-assignment-rhs"></a>

Assignment RHS composition is evidenced for direct variables; string, number and boolean literals; parenthesized and arithmetic/equality expressions; arrays; function calls; and modifiers. Only the compiler-confirmed `nocache` option is supported after the RHS, bare or valued; arbitrary trailing attributes are rejected. Config-variable RHS use is not directly tested, so the grouped variable/config-variable cell is `limited`. The linked hand-authored trees preserve each supported value shape and the Node/reference check exercises assignment tags. Full-engine execution is checked for a fixed variable assignment followed by output and the `nocache` option forms. Other RHS pairings remain `?`: interpolated strings, bitwise expressions, property/method/index expressions, section/loop metadata, class constants/static calls, and bare identifiers have no assignment-specific fixture. Evidence: [Task 033 trees](../test/corpus/shorthand-assignment-tags.txt), [recovery trees](../test/corpus/shorthand-assignment-recovery.txt), and [reference/full-engine/edit checks](../test/shorthand-assignment-tags.test.mjs). The `limited` operator cell means arithmetic and equality composition are tested; the grouped operator family is not exhaustively checked.

The remaining Assignment RHS cells marked `?` are unknown rather than
unsupported: interpolated strings, bitwise expressions, property/method/index
access, section/loop metadata, class constants/static calls, and bare
identifiers still need assignment-specific trees. Config-variable RHS is also
unverified; the matrix groups it with variables and marks that cell `limited`.

The cells marked `?` are unknown rather than unsupported. For bitwise AND, the
unverified contexts are foreach sources, custom-tag positional values,
function/method arguments, modifier inputs, bracket indices, and array keys and
values; completed Task 021 supports only its listed shared-expression contexts.
For section-name/property indices, foreach sources, custom-tag positional
arguments, function/method arguments, nested bracket-index expressions, and
array keys/values remain unverified.
For word comparisons, Task 034 now verifies outputs, conditions, custom-tag
positional/attribute values, function arguments, array values, and parenthesized
modifier arguments. Assignment RHS, foreach sources, modifier inputs, bracket
indices, array keys, and direct method arguments remain unverified. See the
[Task 034 composition audit](#task-034-word-comparison-composition-audit).
Each linked key names the exact form/context pair. Follow-up is to reduce that
pair to one source, write its expected tree manually, and check pinned Smarty
behavior before changing its status. The pairs are: variable/config variable–array key;
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
key; class constant–foreach source; interpolated string–assignment RHS,
condition, foreach source, bracket-index expression, array key, and array value.
The hand-written table
supplies a concrete follow-up pair for every unknown key; no cell is promoted
by grammar routing.

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
44 unverified expression-composition cells. Task 016 closes its single
confirmed gap. Task 030 verifies five additional section-index context cells;
the current matrix has 89 `yes`, 4 `limited`, no `no`, and 50 unverified cells.
The recording adapter proves syntax/event acceptance only,
not runtime binding. The separate `MOD-ID-arg` cell is not included in those
historical totals because Task 017 adds a modifier-only atom/context pairing.

## Planned current-template gap coverage (2026-10-17)

The current FBS/HDB audit added six bounded tasks. Tasks 046–050 are implemented
and independently reviewed; Task 051 remains a planning brief. Verified
compositions are linked below. The audit alone promotes no composition cell.

- [046](tasks/046-else-if-branches.md) adds a branch-header spelling; it reuses
  condition expressions and checks nested block ownership.
- [047](tasks/047-tags-in-quoted-attributes.md) extends quoted-string contents;
  probe shared string contexts and retain explicit nested tag/block structure.
- [048](tasks/048-namespaced-static-method-calls.md) extends the static-call
  receiver; its implementation and verified compositions are recorded below.
- [049](tasks/049-braced-modifier-arguments.md) adds a wrapper specifically in
  modifier argument position and checks ownership in enclosing expressions.
- [050](tasks/050-output-nofilter.md) adds an output-owned suffix; it does not
  make output attributes general expression operators. Its verified output
  contexts are recorded below.
- [051](tasks/051-ternary-expressions.md) adds a shared expression form with
  precedence and colon-boundary probes, including modifier arguments and arrays.

Each implementation must add/update rows or context evidence for the pairs it
actually verifies and leave other pairs explicitly unverified. The briefs name
representative contexts, malformed boundaries and incremental edits; the audit
alone supplies no new cross-context acceptance evidence.

## Task 050 output `nofilter` suffix

The suffix is an output-owned `attribute` child; `output.value` remains the
complete expression. Hand-authored trees cover variable, modifier, index,
method, and built-in function outputs, mixed and repeated ordered suffixes,
nested `if`/`foreach` blocks, and following outputs. Compiler checks cover
lowercase `nofilter` with accepted flag values and mixed/repeated `nocache`;
case variants and wider values remain parser syntax even where Smarty rejects
them. Generic tag positional and named arguments remain independent. These
checks verify the contexts explicitly listed here and do not imply support for
arbitrary output attributes or nofilter runtime behavior. See [Task 050
trees](../test/corpus/output-nofilter.txt), [reference/compiler/recovery/edit
checks](../test/output-nofilter.test.mjs), and its [implementation evidence](tasks/050-output-nofilter.md#implementation-evidence-2026-10-17).

## Task 048 namespace-qualified static calls

Smarty 5.8.4 accepts a rooted or unrooted qualified receiver with adjacent
namespace separators and `::`; Tree-sitter preserves its source as
`class: (qualified_name (identifier) ...)`. The static-call node and its
argument fields stay the same as for unqualified calls. Task 048 verifies these
pairs with hand-authored trees and recorder projections:

| Context | Minimized example | Verified ownership |
| --- | --- | --- |
| Output | `{Demo\Assets\Builder::build()}` | Output value is one static call; class node spans all segments and separators. |
| Condition | `{if Demo\Assets::enabled($x)}Y{/if}` | Condition owns one complete static call. |
| Foreach source | `{foreach Demo\Assets::items() as $item}{$item}{/foreach}` | Source owns one complete static call. |
| Generic positional/named value | `{widget Demo\Assets::build()}` / `{widget value=Demo\Assets::build()}` | Each value owns one call; recorder confirms argument count and named attribute order. |
| Nested function/method argument | `{strlen(Demo\Assets::name())}` / `{$o->run(Demo\Assets::name())}` | The nested call remains one argument. |
| Modifier input/argument | `{Demo\Assets::build()|escape}` / `{$x|default:Demo\Assets::fallback()}` | The call remains the complete modifier input or argument. |
| Bracket index and array key/value | `{$items[Demo\Assets::index()]}` / `{[Demo\Assets::key()=>Demo\Assets::build()]}` | Each index, key, and value owns its complete call. |

Rooted one-segment names, contextual and digit-prefixed segments, source ranges, the accepted
space before `(`, separator-spacing errors, malformed recovery, and incremental
qualification edits are checked in the same task. Namespaced standalone and
class constants are Smarty-valid but remain unsupported syntax gaps. See [Task 048
trees](../test/corpus/namespaced-static-method-calls.txt), [Node checks](../test/namespaced-static-method-calls.test.mjs), and [implementation evidence](tasks/048-namespaced-static-method-calls.md#implementation-evidence).
