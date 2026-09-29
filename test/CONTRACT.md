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
children with `name` and `value` fields. `custom_close_tag` has a `name`. These
nodes do not assert block pairing or plugin availability.

Known `if` blocks are nested: `if_tag`, body nodes, optional `elseif_clause`
nodes, optional `else_clause`, and `if_close_tag`. Conditions have a `condition`
field. Branch clauses contain their opening tag and body nodes. Generic tags
must not consume malformed built-in control tags.

The manually specified trees in `test/corpus/*.txt` are the structural
contract. Do not regenerate their expectations from parser output to fix a failure.
The reference tests compare a smaller projection (ordered tag names, argument
names, and modifier names) with the installed Smarty parser. Smarty's generated
PHP fragments are not treated as Tree-sitter syntax trees.

Currently not supported: other built-in blocks, word operator aliases, bitwise operators,
standalone calls/dynamic member access, dynamic config variables,
arrays, interpolated strings, literal blocks, configurable delimiters, auto-literal braces,
or HTML injection. These are current gaps to assess and address according to
common usage and usefulness to parser consumers; the explicit plugin/custom-tag
boundary is the exception. Recovery on unfinished and malformed input is part
of the parser's goal, especially for interactive editor use, and should be
represented in tests for each relevant syntax family.

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
Standalone functions remain unsupported; `{f(1)}` overlaps the existing generic
tag syntax and is a custom tag with a parenthesized argument, not a function node.
Evidence: [method trees](corpus/object-method-calls.txt) and
[reference/range/edit checks](object-method-calls.test.mjs).

Symbolic comparisons `== != === !== < <= > >=` and booleans `&& ||` reuse
`binary_expression` with `left`, `operator`, and `right` fields. Prefix `! + -`
produces `unary_expression` with `operator` and `argument` fields; numbers remain
unsigned leaves. Binding from tight to loose is property/call chains, modifiers,
prefixes, multiplicative arithmetic, additive arithmetic, relational comparisons,
equality comparisons, `&&`, `||`. Arithmetic/booleans associate left, prefixes
right. Relational and equality levels each forbid unparenthesized repeated
comparisons; parentheses can make grouping explicit. Adjacent prefix sign pairs
are excluded INCDEC syntax; spaced signs such as `+ +$a` are nested unary nodes.
Modifier arguments retain the prior narrow subset; parenthesize full expressions.
Evidence: [operator trees](corpus/condition-operators.txt) and
[reference/full-engine/edit checks](condition-operators.test.mjs). The full-engine
helper uses only controlled fixtures and temporary compile directories. It does
not execute application corpus templates.

The retained generic parenthesized-argument shape also means `{widget ($a > 0)}`
overlaps Smarty's function-output syntax, just like `{f(1)}`. This limitation is
explicitly recorded; `{widget $a > 0}` is the reference-backed generic tag form.

Modern foreach loops produce `foreach_block` with `foreach_tag`, direct body
nodes, optional `foreachelse_clause` (opening tag plus body), and
`foreach_close_tag`. Header fields are `source`, optional `key`, and `item` in
source order; bindings are simple variables. Whitespace is required after
`foreach` and on both sides of contextual `as`. Branches belong to their own
nested block; missing or crossed closers are errors. Reserved control names
cannot escape as generic tags, while `{as}`, variables/config names and property/
method keywords remain valid in their established contexts. Legacy headers,
extra attributes, metadata and runtime iteration semantics are outside the
subset. Recorder events normalize names to `from`, `item`, then optional `key`
and do not validate pairing; full-compiler checks supplement exact trees for
that purpose. Evidence: [foreach trees](corpus/foreach.txt) and
[reference/compiler/edit checks](foreach.test.mjs).

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
Both names retain exact spelling, including contextual control/primitive words.
Constants compose as primary expressions and modifier arguments; `{Class}` stays
a generic tag. Internal whitespace is rejected. Case-insensitive `self`/`parent`
are excluded class receivers but remain generic tag names. Namespaces, dynamic
receivers, static calls/properties, constant access suffixes, global constants
and runtime symbol validation remain outside this bounded feature.
Evidence: [constant trees](corpus/class-constants.txt) and
[reference/field/range/edit checks](class-constants.test.mjs).
