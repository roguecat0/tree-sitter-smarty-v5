# First grammar milestone

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

The manually specified trees in `test/corpus/initial.txt` are the structural
contract. Do not regenerate their expectations from parser output to fix a failure.
The reference tests compare a smaller projection (ordered tag names, argument
names, and modifier names) with the installed Smarty parser. Smarty's generated
PHP fragments are not treated as Tree-sitter syntax trees.

Not yet supported: other built-in blocks, comparisons, boolean operators,
unary operators, calls/member access, dynamic config variables/indexing, arrays, interpolated
strings, comments, literal blocks, configurable delimiters, auto-literal braces,
or HTML injection. This milestone does not claim to parse the application corpus.

Static `#name#` expressions produce `config_variable` with a `name: (identifier)`
field in outputs, conditions, tag arguments/attributes and modifier inputs/arguments.
Names use the existing ASCII identifier subset; internal whitespace is rejected.
Plain and quoted hash text stays text/string. Structural evidence:
[test/corpus/config-variables.txt](corpus/config-variables.txt).
