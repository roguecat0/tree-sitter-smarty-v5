# Smarty grammar contract

Target: a reusable Smarty 5 parser with broad practical coverage and robust
recovery, with the grammar name `smarty_v5` and package name
`tree-sitter-smarty-v5`. Editor support is the primary use
case, and the syntax trees should also serve CLI tools and other integrations.
The grammar is currently partial. Bounded feature tasks are the development
method, not the intended coverage ceiling. Project-specific plugin behavior and
arbitrary custom tag semantics are out of scope; unknown tags must remain
parseable without hiding their supported arguments and expressions.

The root is `source_file`. Text becomes `text`; output tags become `output`
with a `value` field. Expressions preserve variable names, strings, numbers,
parentheses, left-associative arithmetic, and modifier applications. Multiplication,
division, and remainder bind tighter than addition and subtraction. Modifier
applications bind tighter than arithmetic in this subset.

Every currently supported expression output accepts one or more trailing,
case-insensitive `nocache` suffixes. Each occurrence is a separate ordered
direct `attribute` child of `output`, with an exact-spelling `identifier` in
`name`; `value` continues to own the complete output expression. A bare suffix
has no `value` field, while a valued suffix preserves its complete expression
under `attribute.value`. Suffix parsing includes the shared symbolic and word
comparison/boolean operators, bitwise `&`, and `is div by` expression families.
Standalone bare identifiers remain supported outputs without a suffix; the
ambiguous `{widget nocache}` remains a generic tag with a positional identifier
argument. Smarty's compiler accepts nocache flag values
`true`, `false`, `1`, and `0`, quoted or unquoted, while the syntax tree retains
wider parsed expressions and case spelling. `assign`, `nofilter`, other output
attributes, and runtime caching behavior remain separate gaps. The recorder's
acceptance of `{$x nocache|escape}` does not establish ownership after the
suffix; the full compiler rejects that form. See [Task 042 trees and
checks](../test/corpus/output-nocache-attribute.txt),
[Node checks](../test/output-nocache-attribute.test.mjs), and the
[implementation evidence](../docs/tasks/042-output-nocache-attribute.md#implementation-and-corpus-evidence).

Whitespace-delimited, case-insensitive prefix `not` is a shared expression
operator. It produces `unary_expression` with a `word_operator` in `operator`
and its complete operand in `argument`, at the same binding level as symbolic
prefix `!`. The word requires whitespace before its operand. A bare `not` in a
generic tag name, positional value, attribute name/value, or function-call name
retains the existing `identifier` classification; `not($value)` remains a
function call. Case-insensitive binary `and`, `or`, and `xor` are shared
expression operators with `binary_expression(left, operator: word_operator,
right)` shape. Their word nodes preserve the exact letters and source range;
Smarty requires whitespace on both sides. `and` binds at the existing `&&`
level, `or` at `||`, and `xor` below `or`. Bare identifier, call, string, and
comment uses keep their existing classifications. Evidence: [031 trees and
checks](../test/corpus/word-boolean-operators.txt), [032 trees and
checks](../test/corpus/word-binary-boolean-operators.txt), and
[reference/full-engine/edit checks](../test/word-binary-boolean-operators.test.mjs).

Custom tag names preserve the Smarty `ID` token, including digit-prefixed
`123foo`, except for recognized control keywords. `custom_tag` has a `name`,
positional `argument` fields, and `attribute` children with `name` and `value`
fields. These two value positions accept either
a supported expression or one direct static Smarty `ID`, represented as an
`identifier`; digit-prefixed `123foo` is an identifier, while pure decimals,
booleans, nulls, variables, strings, and class constants retain their existing
node types. Bare IDs are also primary expressions in the tested output,
condition, function/method argument, and array-element value contexts. See
[018 trees and checks](../docs/tasks/018-generic-tag-identifier-values.md).
In a generic-tag named attribute, a direct expression value such as
`selected=$labels.{$key}` remains the direct expression in `attribute.value`.
For the Smarty-valid braced form `selected={$labels.{$key}}`, the attribute
owns a nested `output` node in `attribute.value`, and `output.value` owns the
expression. The wrapper retains its two source braces and full expression
detail. This applies to supported expression types generally, not only to
dynamic-dot indices. The application witness
`view_labels/cable_label.tpl:35` exercises the method-index composition; see
[Task 037 trees and checks](../test/corpus/braced-tag-attribute-values.txt),
[reference trees](../test/corpus/smarty-reference-braced-tag-attribute-values.txt),
[Node checks](braced-tag-attribute-values.test.mjs), and the
[Task 037 evidence](../docs/tasks/037-braced-generic-tag-attribute-values.md).
The attribute-name field preserves simple ASCII identifiers and existing
primitive aliases. It also supports `tag_attribute_name` leaves for hyphenated
names, digit-prefixed names, and nonempty segments separated by single colons
(for example `data-id`, `123data-id`, and `foo:bar:baz`). These leaves are
local to the attribute `name` field and do not broaden expression identifiers.
Smarty's contextual words `parent`, `self`, `if`, `else`, `elseif`, `foreach`,
and `foreachelse` are also accepted as generic-tag attribute names and remain
`identifier` leaves with their original spelling and source range. `parent` and
`self` are accepted in every ASCII case variant in this attribute context.
These contextual aliases do not change built-in control-tag parsing or allow
case-insensitive `self`/`parent` as static class receivers.
Smarty 5.8.4 accepts terminal-colon `foo:=MODE` and repeated-colon `foo::bar=`
spellings, but this partial Tree-sitter contract retains both as explicit
error/recovery gaps and preserves following independent output. The malformed
`{widget foo:}` form is also an error/recovery case and is rejected by Smarty.
Task 023 specifies all three boundary witnesses, their Smarty recorder results,
and hand-authored Tree-sitter expectations in
[Task 023](../docs/tasks/023-smarty-tag-attribute-names.md#partial-boundary-revision-2026-10-01).
The Task 025 trees and checks cover contextual attribute aliases, malformed
value recovery, control-tag/class-receiver boundaries, case preservation, and
incremental edits. Eight corpus roots with `data-*`/`aria-*` names are covered
by the Task 023 fixture.
`custom_close_tag` has a `name`. These nodes do not assert block pairing or
plugin availability.

Smarty shorthand assignment tags such as `{$name = $value}` and indexed
targets such as `{$rows[$index] = $value}` produce `assignment_tag` with
explicit `target` and `value` fields. Targets preserve supported variable or
nonempty index-expression trees; RHS expressions preserve their existing
structure. The only supported trailing assignment option is `nocache`, either
bare or with a value; it remains a direct `attribute` child. Arbitrary
attributes are rejected because the pinned compiler rejects them. Assignment
itself has no `output` node; following output remains separate. Empty append
and bare identifier section-index targets remain
explicit syntax gaps. Malformed assignment recovery uses a navigable
`assignment_recovery` node with the hidden missing-error marker; it must retain
the surrounding comment, later output and block closer as siblings. A grammar
alias named `ERROR` is ordinary syntax in Tree-sitter and is not a substitute
for a real error state. See [Task 033](../docs/tasks/033-shorthand-assignment-tags.md).

Known `if` blocks are nested: `if_tag`, body nodes, optional `elseif_clause`
nodes, optional `else_clause`, and `if_close_tag`. Conditions have a `condition`
field. Branch clauses contain their opening tag and body nodes. Generic tags
must not consume malformed built-in control tags.

Within `{if}` and `{elseif}` conditions, a complete braced expression is one
primary operand represented as `output(value: expression)` inside the owning
`condition` expression. For example, `{if {$x} > 0}Y{/if}` has a
`binary_expression` condition whose left operand is `output(value: variable)`;
the wrapper includes both braces, and its value excludes them. Direct conditions
remain unwrapped. Existing expression precedence, associativity, operator
fields, and comparisons around or inside the wrapper are unchanged. Tests cover
arithmetic inside braces, an outer comparison and boolean expression, modifier
and method-chain operands, `elseif`, nested blocks, and the application-shaped
method condition. This support is limited to tested compositions with currently
supported expressions; the broader if/elseif feature remains partial. See
[Task 039 trees](corpus/braced-conditions.txt),
[reference/compiler/recovery/edit checks](braced-conditions.test.mjs), and the
[Task 039 brief and completion evidence](../docs/tasks/039-braced-expressions-in-conditions.md).

Recovery must reject inner-leading whitespace in the braced operand as a real
parse error and preserve a distinct error-free trailing output. For a missing
right operand after a braced left operand, retain the left wrapper in
`if_tag.condition`, report the operator as a localized error, and keep body,
the actual `if_close_tag`, and later output separate. When the outer header
close is missing, preserve the complete condition and a recognizable
`{/if}` close/recovery node plus trailing output without requiring a specific
error extent or an `if_block` split. The ambiguous one-close form requires a
real error, recognizable close recovery, and independent tail output. An
unclosed block retains its recognizable `if_tag`, condition, and body under
error or missing-close recovery. For a crossed close with no matching
`{/if}`, the recovery `ERROR` retains the `if_tag`, complete condition, body,
crossed-close recovery, and a distinct error-free trailing output descendant;
it need not synthesize an `if_close_tag` or form a completed `if_block`.

Standard `{for}` blocks are nested as `for_block` nodes with a `for_tag`, direct
body nodes, optional `forelse_clause`, and `for_close_tag`. `for_tag` retains
distinct `range_for_header` and `c_style_for_header` structures. Range headers
preserve a target, start/end expressions, optional `step`, optional `max`,
`nocache`, and parser-accepted trailing shorthand arguments. C-style headers
preserve ordered initializers, a condition, one assignment/increment/decrement
update, and syntactically accepted attributes including `max` even when the
full compiler rejects that attribute. Indexed targets keep their
`index_expression` tree. `{forelse}` belongs only to `{for}` and remains
distinct from `{foreachelse}`. Nested for/foreach/if blocks own their own
closers. The recording compiler checks only a syntax projection and does not
validate branch pairing; pinned full-engine checks cover orphan/duplicate
branches, missing closers, and crossed loop ownership. For the tested malformed
C-style header with an omitted update, Tree-sitter currently puts the loop's
own closer in a top-level `ERROR`, while retaining a neighboring valid
`if_close_tag` and following output as separate siblings. This exact recovery
shape is fixed by test. When its condition is omitted as in `{for $i=0; ; $i++}`,
the parser keeps a `for_block`, its `for_close_tag`, and later siblings while
marking the `c_style_for_header` erroneous with a missing internal recovery
marker. This preserves editor navigation through the malformed block. Evidence:
[for loop trees](corpus/for-loops.txt),
[reference/compiler/recovery/edit checks](for-loops.test.mjs), and
[Task 026 corpus report and structural review](../docs/tasks/026-for-loops.md).

Classic Smarty `{section}` blocks and their section-name/property index forms
produce structured `section_block`, `section_header`, branch, close, and index
nodes. Headers support long named fields and short positional `name, loop`
forms, plus `start`, `step`, `max`, `show`, `properties`, and bare `nocache`
options. `$array[sectionName]`, `$array[sectionName.property]`, and
`$smarty.section.name.property` use distinct tree shapes. All ten documented
property names and other static property identifiers are retained. The pinned
recording parser verifies syntax/event order; full-engine checks establish
header and branch behavior. Runtime iteration, active-section lookup, and
property values remain outside the syntax tree contract. Evidence:
[hand-authored trees](corpus/section-blocks.txt),
[Smarty-reference trees](corpus/smarty-reference.txt),
[reference/compiler/recovery/edit checks](section-blocks.test.mjs), and
[Task 030 corpus and implementation evidence](../docs/tasks/030-section-blocks-and-indices.md).
The minimal source `{$a[key]}` returns no error from both the pinned recorder
and full-engine compiler, so the former `index-access` test expectation that it
must fail was incorrect. It is now asserted as a `section_index`; empty append
`{$a[]}` remains a separate unsupported index form.
An orphan `{/section}` or `{sectionelse}` produces a top-level `ERROR` followed
by a separate `$after` output node. A duplicate `{sectionelse}` stays inside
its `section_block` as an `ERROR`, with the following output as a root sibling.
For crossed section/if or section/foreach closes, the recovery tree wraps the
entire malformed region and `$after` in one root `ERROR`; the nested control
block, its own closer, and the neighboring output remain named descendants.
This is the observed recovery boundary, and the tests pin it explicitly.

The manually specified trees in `test/corpus/*.txt` are the structural
contract. Do not regenerate their expectations from parser output to fix a failure.
The reference tests compare a smaller projection (ordered tag names, argument
names, and modifier names) with the installed Smarty parser. Smarty's generated
PHP fragments are not treated as Tree-sitter syntax trees.

With Smarty's default `{` and `}` delimiters and `auto_literal=true`, literal
text preserves a left brace followed immediately by whitespace, the empty `{}`
pair, and raw right braces. A left brace immediately followed by non-whitespace
starts the existing tag/output grammar; whitespace before that tag's closing
brace does not deactivate it. Text and active constructs retain separate named
nodes and source ranges. `{literal}` regions have a separate contract in
[Task 029](../docs/tasks/029-literal-blocks.md). Custom literal sequences,
alternate delimiters, and `auto_literal=false` remain outside this boundary
rule.
Evidence: [manual Smarty-reference trees](corpus/smarty-reference.txt) and
[full-engine/reference/edit/recovery checks](default-auto-literal.test.mjs).

With default delimiters, `{literal}` starts a raw region. Its opener name is
case-insensitive and may have whitespace before `}`; the closer is
case-insensitive and must be exactly `{/literal}` with no spacing inside the
marker. The `literal_block` contains its delimiter nodes and optional
`literal_content`, which preserves every body byte, including Smarty-looking
constructs and nested literal marker spellings. Empty bodies omit content.
The outer matching closer ends the raw region; following Smarty constructs
resume as siblings. A standalone `{/literal}` is a `stray_literal_close`, not
an ordinary custom closing tag. Alternate delimiters and `auto_literal=false`
remain unsupported. Evidence: [literal trees](corpus/literal-blocks.txt),
[Smarty-reference trees](corpus/smarty-reference.txt), and
[reference/full-engine/range/recovery/edit checks](literal-blocks.test.mjs).

Double-quoted strings support direct, braced, and immediate-backtick-dollar
interpolation, and preserve dollars not followed by a Smarty ID as literal
string content. Digit-prefixed Smarty IDs are supported only in that
interpolation path; unquoted `{$5a}` remains unsupported outside Task 020. The
reviewed composition contexts are output, generic-tag attribute, and modifier
argument; other pairings remain unverified. The 23 current earliest-error
contexts and syntax boundary are audited in
[task 020](../docs/tasks/020-double-quoted-interpolation.md); backticks not
followed immediately by `$` remain string content. Configurable delimiters
remain outside this contract. Editor queries are
specified in Task 045: field-specific Smarty highlights, combined HTML text
and literal-content injection, and recognized-block folds. Tree shapes are
unchanged. Smarty captures use priority 110 so nested JavaScript/CSS captures
at their default priority 100 cannot obscure template syntax. Other built-in
blocks besides
`if`, `foreach`, `for`, `section`, and `literal`, word arithmetic alias `mod`,
`is not div by`, other `is ...` predicates, additional bitwise/math operators,
dynamic member access, and dynamic config variables remain current gaps to assess and address according to
common usage and usefulness to parser consumers; the explicit plugin/custom-tag
boundary is the exception. Recovery on unfinished and malformed input is part
of the parser's goal, especially for interactive editor use, and should be
represented in tests for each relevant syntax family.
Static unqualified calls are supported below; their namespace and dynamic-call
exclusions remain listed with that syntax contract.

Binary Smarty grouping predicates `is [not] odd/even by` are shared expression
operators with a `binary_expression(left, operator: parity_by_operator,
right)` shape. The operator retains its original case, internal whitespace,
and exact source range from `is` through `by`; its whitespace-delimited `odd`
or `even` word must be separate. These predicates preserve the existing
`is div by` precedence and compose in supported output and condition contexts.
The unary forms `is odd`, `is even`, `is not odd`, and `is not even` are
`single_condition_expression(left, operator: single_condition_operator)`
postfix predicates with no right operand. Their operator node preserves case
and internal whitespace and starts at `is`, excluding the required leading
separator. Their precedence preserves the observed distinction between
`0 < 2 is odd` and `(0 < 2) is odd`, and permits following arithmetic to wrap
the predicate result. The external scanner consumes the required whitespace
before `is`; the pinned compiler's semantic mapping mishandles tabs/newlines
inside that lexer token despite accepting them lexically, so runtime evidence
for those separators is intentionally limited. `{if 3 is oddness}` leaves
`ness` after Smarty's `SINGLECOND` prefix and remains a compiler error. See
[Task 043 trees and checks](../test/corpus/parity-grouping-predicates.txt) and
its implementation evidence in
[the task brief](../docs/tasks/043-parity-grouping-predicates.md), plus [Task
044 trees and checks](corpus/unary-parity-predicates.txt),
[reference/full-engine/recovery/edit checks](unary-parity-predicates.test.mjs),
and [its brief](../docs/tasks/044-unary-parity-predicates.md).

Short `[...]` and `array(...)` literals produce `array_literal` nodes. Each
comma-separated value is an `array_element` with a `value` field; keyed entries
also have a `key` field. Empty arrays and trailing commas are supported. Keys
may be supported primary expressions or bare identifier names; supported
`unary_expression` forms are also accepted directly as keys and retain their
`operator` and `argument` fields. An unparenthesized compound expression key
remains rejected; a compound key must be parenthesized. Task 041 adds a
`typecast_expression` key and value shape for Smarty's shared `TYPECAST value`
production; this is separate from unary-key support. The independently reviewed
implementation and all audited context trees are covered by [Task 041](../docs/tasks/041-typecast-expressions.md).
Values use the full supported expression grammar. Nested literals compose as
primary expressions and are retained in unknown tag arguments and attributes.
Leading and repeated commas, spread, assignment, and PHP runtime array behavior
are outside this tree contract.
Evidence: [array trees](corpus/array-literals.txt), [unary key trees and
reference/recovery/edit checks](unary-array-keys.test.mjs).

Static `#name#` expressions produce `config_variable` with a `name: (identifier)`
field in outputs, conditions, tag arguments/attributes and modifier inputs/arguments.
Names use the existing ASCII identifier subset; internal whitespace is rejected.
Plain and quoted hash text stays text/string. Structural evidence:
[test/corpus/config-variables.txt](corpus/config-variables.txt).

Smarty comments are named leaf `comment` nodes spanning `{*` through the first
`*}`; they do not nest and contain no executable children. Following newlines
remain text. Unterminated comments produce recovery errors. Single-quoted comment
markers remain strings. The existing simple double-quoted string rule over-accepts
`"{* ... *}"`, which Smarty rejects through its interpolation handling; this
is a documented limitation, not supported Smarty syntax. See
[comment trees](corpus/comments.txt) and [reference checks](comments.test.mjs).

Static property access produces left-nested `member_expression` nodes with
`object` (a variable, member expression, method call or index expression) and `member: (identifier)` fields.
It binds tighter than modifiers and arithmetic, and composes in tag arguments,
attributes, conditions and modifier inputs/arguments. Whitespace, including
newlines, is allowed around `->`. Static names use ASCII identifiers; control
keywords such as `if` are valid members without becoming valid generic tag names.
Dynamic/static access and arbitrary expression receivers remain
outside this subset. Evidence: [property trees](corpus/object-properties.txt) and
[reference/range/recovery/edit checks](object-properties.test.mjs).

Static object methods produce `method_call_expression` with `object`, `method`
and repeated `argument` fields. Ordinary comma-separated lists permit zero
arguments, require each supplied expression, and reject trailing/leading commas.
Calls and properties form left-nested chains above modifiers and arithmetic.
Whitespace around arrows, method names and argument punctuation is accepted.
Smarty's recorder accepts a leading comma; this subset deliberately rejects it.
Arguments retain standalone function calls when used inside a method argument;
`{$a->f(f(1))}` is supported by the 011 expression-call contract.
Evidence: [method trees](corpus/object-method-calls.txt) and
[reference/range/edit checks](object-method-calls.test.mjs).

Unqualified static identifier calls produce `function_call_expression` with
`name: (identifier)` and repeated `argument` fields. Calls accept zero or more
ordinary comma-separated expressions and bind as primary values. They compose
in outputs, conditions, generic-tag positional/named values and modifier
arguments; nested method/array expressions retain their trees. A tag-shaped
`{name(args)}` parses as an output call, while `{widget}` and
`{widget value=("x")}` remain generic tags. Smarty also treats
`{widget ($a > 0)}` as function output; this corrects the former 005 generic-tag
expectation. Trailing attributes on function outputs are Smarty-valid but
remain unsupported: the parser reports an error at them and recovers later
comments and independent closers. The recorder routes function values through
its modifier-in-expression callback; it reports the callee and counts supplied
arguments after the first as modifier parameters. This projection does not
verify argument values, runtime function behavior, plugin resolution, or
callee semantics. Namespaced callees, variable/dynamic callees,
function-result chains, and nonordinary argument forms remain outside this
subset. Static class method calls produce `static_method_call_expression` with
`class` and `method` identifier fields and repeated ordinary `argument` fields.
The node is distinct from `class_constant_expression`, composes through the
contexts listed below, and does not include method-result chains. Smarty's
`{Thing::READY()}` is a method call; the pinned recorder accepts it. The former
constant-only test exclusion was corrected after that direct observation.
Evidence:
[call trees](corpus/standalone-function-calls.txt) and
[reference/recovery/edit checks](standalone-function-calls.test.mjs).

Symbolic comparisons `== != === !== < <= > >=` and booleans `&& ||` reuse
`binary_expression` with `left`, `operator`, and `right` fields. Prefix `! + -`
produces `unary_expression` with `operator` and `argument` fields; numbers remain
unsigned leaves. Binding from tight to loose is property/call chains, modifiers,
prefixes, multiplicative arithmetic, additive arithmetic, relational comparisons,
equality comparisons, `&&`, `||`. Arithmetic/booleans associate left, prefixes
right. Relational and equality levels each forbid unparenthesized repeated
comparisons; parentheses can make grouping explicit. Adjacent prefix sign pairs
are excluded INCDEC syntax; spaced signs such as `+ +$a` are nested unary nodes.
Binary word aliases share these logical levels: `and` with `&&`, `or` with `||`,
and `xor` below `or`. The word tokens are case-insensitive, require whitespace
on each side, and preserve exact operator spelling/ranges in `word_operator`.
See [Task 032 trees and checks](../test/corpus/word-binary-boolean-operators.txt)
and its [reference, precedence, recovery, and edit checks](../test/word-binary-boolean-operators.test.mjs).
Case-insensitive comparison aliases `eq`, `ne`, `neq`, `gt`, `ge`, `gte`, `lt`,
`le`, and `lte` also produce `binary_expression` with `left`,
`operator: (word_operator)`, and `right`. Equality aliases share symbolic
equality precedence; relational aliases share symbolic relational precedence.
Relational comparisons bind more tightly than equality, and repeated
same-level comparisons require parentheses. Smarty requires whitespace on both
sides; the exact-case word token excludes those gaps. Without the two-sided gap,
Smarty can compile a different expression, so no operator node is emitted and
the form is not automatically an error. In malformed `{if $left neq }`, the
observed recovery tree retains `condition: (variable ...)` plus a sibling
`(ERROR (word_operator))` inside `if_tag`; no missing right operand is
represented. The error must not swallow later comments, output, unknown-tag
arguments, or the block closer. See [Task 034 trees, checks, and corpus
evidence](../docs/tasks/034-word-comparison-operators.md).
Modifier arguments retain the current narrow subset; parenthesize full
expressions. A direct static Smarty `ID` after a modifier colon is an
`identifier` argument, including IDs with a digit prefix such as `123foo`;
pure decimal tokens remain `number` nodes. Direct static IDs are also allowed
in generic-tag positional arguments and named attribute values. These contexts
are separate from bare IDs as primary expressions. See [017 trees and
checks](../docs/tasks/017-static-modifier-arguments.md) and [018 trees and
checks](../docs/tasks/018-generic-tag-identifier-values.md). Task 022 extends
the primary expression in tested outputs, conditions, function/method arguments,
and array-element values. The static-tag-name boundary remains distinct:
`{$f(foo)}` is rejected because Smarty does not support variable-callee output,
while `{isset(foo)}` is a built-in function form whose bare ID argument is
accepted by Smarty. `{123foo}` is a custom tag whose recorded name is exactly
`123foo`, while `{$a == 123foo}` contains an `identifier` expression node.
Pinned reference and full-engine observations for `{in_array(foo, $list)}` are
recorded in Task 022; the recorder projection does not expose argument values.
See the [Task 022 trees and checks](../docs/tasks/022-static-identifier-expressions.md)
and its composition evidence.

The pinned Smarty 5.8.4 lexer/parser and recording compiler accept adjacent
modifier spellings `|@name` and `|@@name`; both report the same modifier name
without the prefix characters. The parser preserves that name and the existing
`modifier_expression` tree shape for both forms in outputs, and for `|@name` in
generic-tag named attribute values. It rejects whitespace between the pipe and
the prefix, reports the malformed region, and retains a later output. Ordinary
`|name` behavior is unchanged. Acceptance of prefixed forms in other existing
`modifier_expression` contexts remains unverified. Hand-authored trees and
reference, range, recovery, and edit checks are in [Task 036](../docs/tasks/036-modifier-at-prefix.md).
The recorder establishes syntax and modifier event/name only, not registration
or execution.
The exact Smarty predicate `is div by` is a `binary_expression` with a
named `div_by_operator`; it is available anywhere the shared full-expression
rule is used, including outputs, conditions, and parenthesized modifier
arguments. The operator's source range spans `is` through `by`, retaining the
original whitespace between words. Its left side uses supported expressions;
its right side uses a supported value, including unary and parenthesized forms.
Other `is ...` predicates remain unsupported, as do direct unparenthesized
modifier arguments that use the narrower argument rule. Evidence:
[divisibility trees](corpus/divisibility-predicate.txt) and
[reference/full-engine/recovery/edit checks](divisibility-predicate.test.mjs).
Binary bitwise AND `&` is a shared-expression operator, represented by
`binary_expression` with `left`, exact anonymous `operator`, and `right` fields.
It binds below arithmetic, relational, and equality operators and above `&&`
and `||`; repeated `&` operators associate left. The tested contexts are output,
conditions, generic-tag attribute values, and parenthesized modifier arguments.
Incomplete operands remain parse errors and recover with a missing `true` token
under the bitwise expression, while surrounding comments, block closers, and
later outputs remain separate. Pinned Smarty 5.8.4 rejects the malformed
examples at `}`. Other lexer math operators `**`, `^`, `<<`, and `>>` remain
unimplemented gaps. Evidence: [bitwise trees](corpus/bitwise-and.txt) and
[reference, full-engine, recovery and edit checks](bitwise-and.test.mjs);
reviewed implementation evidence and remaining unverified contexts are tracked
in [completed Task 021](../docs/tasks/021-bitwise-and.md).
Evidence: [operator trees](corpus/condition-operators.txt) and
[reference/full-engine/edit checks](condition-operators.test.mjs). The full-engine
helper uses only controlled fixtures and temporary compile directories. It does
not execute application corpus templates.

The generic-tag operator fixture uses `{widget $a > 0 ...}` and retains its
comment and independent closer. Its former `{widget ($a > 0) ...}` form was
Smarty function-output syntax; see the standalone-call contract and 011
evidence. Function-output trailing attributes remain a documented gap.

Modern foreach loops produce `foreach_block` with `foreach_tag`, direct body
nodes, optional `foreachelse_clause` (opening tag plus body), and
`foreach_close_tag`. Header fields are `source`, optional `key`, and `item` in
source order; bindings are simple variables. Whitespace is required after
`foreach` and on both sides of contextual `as`. Branches belong to their own
nested block; missing or crossed closers are errors. Reserved control names
cannot escape as generic tags, while `{as}`, variables/config names and property/
method keywords remain valid in their established contexts. An adjacent static
`$item@identifier` expression produces `loop_metadata_expression` with `item:
(variable)` and `property: (identifier)` fields; `@` is anonymous punctuation.
The syntax accepts identifier suffixes without a property allowlist, but does
not validate runtime properties or binding to the enclosing loop. Loop metadata
is also supported as a direct modifier argument, retaining its
`loop_metadata_expression` shape; see the explicit composition trees and checks
in [016](../docs/tasks/016-loop-metadata-modifier-argument.md). Legacy headers
are also standard syntax. Nonempty named/positional legacy headers have a
`legacy_foreach_header` child retaining source-ordered `attribute` and
`argument` fields; bare `nocache` is an explicit `foreach_option`. The
parser-valid empty `{foreach}` list has no header child. These nodes preserve
syntax and do not validate required attributes, positional value types,
bindings, or runtime iteration behavior; full-compiler checks distinguish
those compiler errors.
Modern and legacy loops share directly owned `foreachelse_clause` branches.
Recorder events preserve legacy entry order and names, while modern events
normalize their binding names; the recorder does not validate pairing.
Full-compiler checks supplement exact trees for that purpose. Evidence:
[foreach trees](corpus/foreach.txt),
[legacy foreach trees](corpus/legacy-foreach.txt),
[reference/compiler/edit checks](foreach.test.mjs),
[legacy reference/compiler/recovery/edit checks](legacy-foreach.test.mjs), and
[item metadata trees](corpus/loop-metadata.txt) and
[item metadata checks](loop-metadata.test.mjs).
Pinned Smarty accepts modern `as` headers with trailing `name`, `key`,
`properties`, `from`, and `item` attributes and `nocache`, despite designer
prose saying the modern form has no named attributes. The modern tree retains
source-ordered trailing entries as direct `attribute`/`foreach_option` children
after the synthesized `source`, optional `key`, and `item` fields; redundant
`from`/`item` names remain attributes. Bare `nocache` is a `foreach_option`;
valued `nocache` is an `attribute` in either header form, with whitespace
around `=` preserved. The compiler accepts `true`, `false`, `1`, and `0`,
quoted or unquoted; other values can be parser-valid yet fail compiler option
validation. Recorder checks cover names/order, not values or runtime cache
effects. See the [028 trees](corpus/foreach-header-options.txt),
[028 checks](foreach-header-options.test.mjs), and
[028 evidence](../docs/tasks/028-foreach-header-options.md).

Dot/bracket read access produces left-nested `index_expression` with `object` and
`index` fields. Dot keys are adjacent ASCII identifiers or unsigned integers;
dynamic dot indices use the adjacent `.{$expr}` form and preserve the complete
expression beneath `index`; bracket indices preserve supported expressions and
permit whitespace. Variable and property receivers can acquire repeated indices,
then property/method chains.
Config receivers can acquire repeated indices only. Method results cannot acquire
indices directly. Binding is above modifiers/operators. Empty append and
arbitrary-expression receivers remain excluded. Bare section-name and
section-name-property bracket forms have dedicated nodes under the `index`
field; see the section syntax contract above. Dynamic dot indices are checked in
outputs, generic-tag attributes, and function arguments; other composition cells
remain unverified. Smarty requires no whitespace between the dot and `{`.
Evidence: [index trees](corpus/index-access.txt) and
[reference/range/edit checks](index-access.test.mjs); [dynamic-dot trees and
reference/recovery/edit checks](corpus/dynamic-dot-index.txt) and
[Task 035 checks](dynamic-dot-index.test.mjs).

A complete Smarty expression enclosed in `{...}` is also accepted inside a
variable/config bracket index. Preserve the usual left-nested `index_expression`
and place a nested `output(value: EXPR)` in its `index` field; the inner braces
belong to that wrapper, not a template-level sibling. Ordinary `$a[$x]` keeps
its direct index child. Whitespace between the outer `[`/`]` and the braced
expression is accepted, but whitespace immediately after the inner `{` is
rejected by Smarty. Missing-bracket recovery may expose a localized `ERROR`
containing the receiver followed by the inner `output`; following output and a
surrounding block closer remain separate navigable nodes. See [Task 038 trees,
reference/recovery/edit checks, and corpus evidence](../docs/tasks/038-braced-expressions-in-bracket-indices.md).

Case-insensitive `true`/`false` and `null` produce named leaf `boolean` and `null`
nodes, retaining their original text/ranges. They are primary expressions and
modifier arguments. Only opening tag names reserve primitive words; longer names,
independent closing tags, attributes, modifiers and contextual access keys keep
identifier structure. Bare primitive bracket keys are excluded section names;
parenthesized or compound primitive indices retain full expression structure.
The recorder now observes modifier lists passed directly to print-expression
compilation for literal output, without executing plugins. Evidence:
[primitive trees](corpus/primitive-literals.txt) and
[reference/type/range/edit checks](primitive-literals.test.mjs).

Adjacent static `Class::NAME` values produce `class_constant_expression` with
`class: (identifier)` and `constant: (identifier)` fields and anonymous `::`.
Static class method calls such as `Class::method($value)` produce a distinct
`static_method_call_expression` with `class` and `method` identifier fields and
repeated `argument` fields. They compose in outputs, conditions, foreach
sources, generic-tag arguments and attributes, function/method arguments,
modifier inputs/arguments, bracket indices, and array keys/values. A direct
generic-tag value retains the complete call rather than splitting it into a
constant plus another argument. Do not classify a method call as a class
constant plus separate tag arguments. Method-result chains remain unsupported.
Class and method names retain exact spelling. Control-word and primitive-token
class names, such as `if`, `true`, and `null`, are accepted and represented by
identifier nodes. Constants compose as primary expressions and modifier
arguments; `{Class}` stays a generic tag. Internal whitespace is rejected.
Case-insensitive `self`/`parent` remain excluded static class receivers; the
pinned recorder rejects those forms. Namespaces, dynamic receivers, static
properties, constant access suffixes, global constants and runtime symbol
validation remain outside this bounded feature.
Evidence: [constant trees](corpus/class-constants.txt) and
[reference/field/range/edit checks](class-constants.test.mjs); [static method
call trees](corpus/static-class-method-calls.txt) and
[reference/full-engine/recovery/edit checks](static-class-method-calls.test.mjs).
