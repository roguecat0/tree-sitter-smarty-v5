# Smarty grammar contract

Target: a deliberately small Smarty 5 subset, with the package name `smarty2`.

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

Not yet supported: other built-in blocks, word operator aliases, bitwise operators,
standalone calls/dynamic member access, dynamic config variables/indexing,
arrays, interpolated strings, literal blocks, configurable delimiters, auto-literal braces,
or HTML injection. This milestone does not claim to parse the application corpus.

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
`object` (a variable, member expression or method call) and `member: (identifier)` fields.
It binds tighter than modifiers and arithmetic, and composes in tag arguments,
attributes, conditions and modifier inputs/arguments. Whitespace, including
newlines, is allowed around `->`. Static names use ASCII identifiers; control
keywords such as `if` are valid members without becoming valid generic tag names.
Dynamic/static access, indexing, and arbitrary expression receivers remain
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
