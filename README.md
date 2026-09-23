# tree-sitter-smarty2

An initial Tree-sitter grammar for **Smarty 5**. The package name `smarty2`
distinguishes this project from another parser; it does not mean Smarty version 2.

This is a small working grammar and test harness, not a complete Smarty parser.

## Run the checks

Requires Node.js/npm, PHP/Composer, and a C/C++ build toolchain.

```sh
composer install
npm ci
npm test
```

`npm test` regenerates the parser and rebuilds its Node binding, then runs:

1. **Nine expected-tree cases.** Each template has a manually written expected
   tree, including fields, in [test/corpus/initial.txt](test/corpus/initial.txt).
2. **Smarty comparisons and focused checks.** The same templates go through
   Smarty's real lexer/parser with plugin compilation intercepted. Ordered tag
   names, positional/named arguments, and modifier names/argument counts must
   agree. Additional checks cover unfamiliar names and malformed expressions.
3. **An edit sequence.** Eight edits include incomplete expressions, branch
   insertion, closing-tag deletion/restoration, Unicode, and newlines. Every
   incremental tree must match a fresh tree, including fields, punctuation,
   ranges, and error/missing-node state.
4. **Three deliberate grammar bugs.** Temporary copies swallow a tag as text,
   mislabel an attribute value, and reverse arithmetic precedence. Each must
   generate successfully and then fail the intended expected-tree check. The
   working grammar is never modified by these experiments.

The end of a successful run includes:

```text
CAUGHT: custom tag swallowed as text (Custom tag arguments)
CAUGHT: attribute value gets the wrong field (Custom tag arguments)
CAUGHT: addition binds tighter than multiplication (Arithmetic precedence)
```

The harness exits unsuccessfully if a check fails or a deliberate bug escapes.
Dependency versions are recorded in `package-lock.json` and `composer.lock`.

## What is implemented

Text, output tags, variables, numbers, simple quoted strings, arithmetic,
parentheses, static config variables, Smarty comments, static object property
chains and static method calls, symbolic comparison/boolean/prefix operators,
custom tags with positional/named arguments, modifier chains, modern foreach
blocks, and nested `if`/`elseif`/`else` blocks. Custom closing tags remain separate nodes and
do not imply a validated block relationship.

See [the tree contract](test/CONTRACT.md) for the fields and exclusions. In
particular, standalone functions, interpolation, dynamic members, legacy loops,
literal blocks, and the remaining
Smarty language features are future work. The 467 application templates have
not been used as an acceptance gate for this milestone.

Smarty comparisons deliberately cover less than the exact-tree tests: the
recording compiler does not check plugin availability, block semantics, argument
values, or expression precedence. Expected trees provide structural checks;
this first milestone does not yet compare expression evaluation with Smarty.

The original small PHP demonstration remains available:

```sh
php demo/smarty-reference.php
```

Start with a template and expected tree in `test/corpus/initial.txt` to see what
the parser promises. Run `npm test` after changing the grammar. Changes to tree
expectations should be reviewed as changes to the contract, not automatically
accepted from parser output.

## Expanding syntax

Start with [AGENTS.md](AGENTS.md), the [feature inventory](docs/features.md), and
the [expansion workflow](docs/expanding.md). Three completed task briefs cover static
configuration variables, comments, and static object properties. Each defines
the tree shape, examples, exclusions, reference checks, and completion evidence.
Further completed briefs are [004: object method calls](docs/tasks/004-object-method-calls.md),
[005: symbolic condition operators](docs/tasks/005-condition-operators.md), and
[006: modern foreach blocks](docs/tasks/006-foreach-blocks.md), in that order.

Measure the local corpus without requiring all files to pass:

```sh
npm run corpus:report
```

The report groups lexical hints and records error locations in
`build/corpus-report.json`. Clean parses still need structural review. Minimized,
reviewed examples belong in the tracked `test/corpus/` regression set. Public CI
runs `npm test` without needing the local application corpus.
