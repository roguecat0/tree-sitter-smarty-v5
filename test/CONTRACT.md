# Smarty grammar contract

Target: a reusable Smarty 5 parser with broad practical coverage and robust
recovery, with the package name `smarty2`. Editor support is the primary use
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

Custom tag names are unrestricted identifiers except the recognized control
keywords. `custom_tag` has a `name`, positional `argument` fields, and `attribute`
children with `name` and `value` fields. These two value positions accept either
a supported expression or one direct static Smarty `ID`, represented as an
`identifier`; digit-prefixed `123foo` is an identifier, while pure decimals,
booleans, nulls, variables, strings, and class constants retain their existing
node types. This does not make a bare identifier a general expression or enable
it in function/method arguments or array values. See
[018 trees and checks](../docs/tasks/018-generic-tag-identifier-values.md).
`custom_close_tag` has a `name`. These nodes do not assert block pairing or
plugin availability.

Known `if` blocks are nested: `if_tag`, body nodes, optional `elseif_clause`
nodes, optional `else_clause`, and `if_close_tag`. Conditions have a `condition`
field. Branch clauses contain their opening tag and body nodes. Generic tags
must not consume malformed built-in control tags.

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
nodes and source ranges. This boundary rule does not cover `{literal}` regions,
custom literal sequences, alternate delimiters, or `auto_literal=false`.
Evidence: [manual Smarty-reference trees](corpus/smarty-reference.txt) and
[full-engine/reference/edit/recovery checks](default-auto-literal.test.mjs).

Double-quoted strings support direct, braced, and immediate-backtick-dollar
interpolation, and preserve dollars not followed by a Smarty ID as literal
string content. Digit-prefixed Smarty IDs are supported only in that
interpolation path; unquoted `{$5a}` remains unsupported outside Task 020. The
reviewed composition contexts are output, generic-tag attribute, and modifier
argument; other pairings remain unverified. The 23 current earliest-error
contexts and syntax boundary are audited in
[task 020](../docs/tasks/020-double-quoted-interpolation.md); backticks not
followed immediately by `$` remain string content,
literal blocks, configurable delimiters,
or HTML injection. Other built-in blocks, word operator aliases, bitwise
operators, dynamic member access, and dynamic config variables remain current
gaps to assess and address according to
common usage and usefulness to parser consumers; the explicit plugin/custom-tag
boundary is the exception. Recovery on unfinished and malformed input is part
of the parser's goal, especially for interactive editor use, and should be
represented in tests for each relevant syntax family.
Static unqualified calls are supported below; their namespace and dynamic-call
exclusions remain listed with that syntax contract.

Short `[...]` and `array(...)` literals produce `array_literal` nodes. Each
comma-separated value is an `array_element` with a `value` field; keyed entries
also have a `key` field. Empty arrays and trailing commas are supported. Keys
may be supported primary expressions or bare identifier names; a compound
expression key must be parenthesized. Values use the full supported expression
grammar. Nested literals compose as primary expressions and are retained in
unknown tag arguments and attributes. Leading and repeated commas, spread,
assignment, and PHP runtime array behavior are outside this tree contract.
Evidence: [array trees](corpus/array-literals.txt) and
[reference/recovery/edit checks](array-literals.test.mjs).

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
Modifier arguments retain the current narrow subset; parenthesize full
expressions. A direct static Smarty `ID` after a modifier colon is an
`identifier` argument, including IDs with a digit prefix such as `123foo`;
pure decimal tokens remain `number` nodes. Direct static IDs are also allowed
in generic-tag positional arguments and named attribute values. These bounded
contexts do not make bare identifiers general expressions or enable them in
function/method arguments or array values. See [017 trees and checks](../docs/tasks/017-static-modifier-arguments.md)
and [018 trees and checks](../docs/tasks/018-generic-tag-identifier-values.md).
The exact Smarty predicate `is div by` is also a `binary_expression` with a
named `div_by_operator`; it is available anywhere the shared full-expression
rule is used, including outputs, conditions, and parenthesized modifier
arguments. The operator's source range spans `is` through `by`, retaining the
original whitespace between words. Its left side uses supported expressions;
its right side uses a supported value, including unary and parenthesized forms.
Other word aliases and `is ...` predicates remain unsupported, as do direct
unparenthesized modifier arguments that use the narrower argument rule. Evidence:
[divisibility trees](corpus/divisibility-predicate.txt) and
[reference/full-engine/recovery/edit checks](divisibility-predicate.test.mjs).
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
not validate runtime properties or binding to the enclosing loop. A confirmed
composition gap remains for loop metadata as a direct modifier argument; it is
recorded in [015](../docs/tasks/015-composition-audit.md), with a proposed fix
in the noncanonical [016 draft candidate](../docs/tasks/016-loop-metadata-modifier-argument.md)
that is not yet queued or accepted. Legacy headers, extra attributes and
runtime iteration semantics remain outside the subset. Recorder events
normalize names to `from`, `item`, then optional `key`
and do not validate pairing; full-compiler checks supplement exact trees for
that purpose. Evidence: [foreach trees](corpus/foreach.txt),
[reference/compiler/edit checks](foreach.test.mjs), and
[item metadata trees](corpus/loop-metadata.txt) and
[item metadata checks](loop-metadata.test.mjs).

Dot/bracket read access produces left-nested `index_expression` with `object` and
`index` fields. Dot keys are adjacent ASCII identifiers or unsigned integers;
bracket indices preserve supported expressions and permit whitespace. Variable
and property receivers can acquire repeated indices, then property/method chains.
Config receivers can acquire repeated indices only. Method results cannot acquire
indices directly. Binding is above modifiers/operators. Empty append, bare-name
section, dynamic dot and arbitrary-expression receivers remain excluded.
Evidence: [index trees](corpus/index-access.txt) and
[reference/range/edit checks](index-access.test.mjs).

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
