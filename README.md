# tree-sitter-smarty-v5

A Tree-sitter grammar for **Smarty 5**. The grammar name is `smarty_v5`;
distinguishes this project from another parser; it does not mean Smarty version 2.

The goal is a reasonably full-featured, reusable parser for common Smarty 5
templates. Editor support is the primary use case: syntax trees should support
highlighting and remain useful while a template is incomplete or malformed. The
same trees should also serve CLI tools and other integrations. Syntax is added in
small, controlled, well-tested steps as coverage grows. Project-specific plugin
behavior and arbitrary custom tag semantics are outside the goal; unknown tags
should still preserve their syntax and contained expressions where possible.
The current grammar is an early, partial implementation of that goal.

## Run the checks

Requires Node.js/npm, PHP/Composer, and a C/C++ build toolchain.

```sh
composer install
npm ci
npm test
```

`npm test` regenerates the parser and rebuilds its Node binding, then runs:

1. **100 expected-tree cases.** Manually written trees, including fields, cover
   the initial subset and completed features in [test/corpus/](test/corpus/).
2. **151 Node checks.** Reference projections compare accepted syntax and tag/
   modifier events with Smarty. Controlled full-engine checks separately cover
   precedence and block validation; range and negative checks protect boundaries.
3. **Incremental edit checks.** Each feature includes edits through valid,
   incomplete and repaired syntax. Incremental trees must match fresh trees,
   including fields, punctuation, ranges and error/missing-node state.
4. **Ten deliberate grammar bugs.** Temporary copies corrupt node types,
   fields or precedence. Each must generate and fail its intended tree assertion.
   The working grammar is never modified by these experiments.

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
parentheses, boolean/null literals, static config variables, Smarty comments, static object property
chains, static method calls, dot/bracket reads, static class constants, symbolic comparison/boolean/prefix operators,
custom tags with positional/named arguments, modifier chains, modern foreach
blocks, and nested `if`/`elseif`/`else` blocks. Custom closing tags remain separate nodes and
do not imply a validated block relationship.

See [the tree contract](test/CONTRACT.md) for the fields and current exclusions.
Standalone functions, interpolation, dynamic members, legacy loops, literal
blocks, and other Smarty syntax remain future work. These are limits of the
current implementation, not a declaration that broad practical coverage is out
of scope. The 467 application templates are local triage evidence, not an
acceptance gate.

Smarty comparisons deliberately cover less than the exact-tree tests: the
recording compiler does not check plugin availability, block semantics, argument
values, or expression precedence. Expected trees provide structural checks.
A separate full-engine helper verifies selected fixed expressions and loop
validation; it never executes application corpus templates.

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
[006: modern foreach blocks](docs/tasks/006-foreach-blocks.md).
Tasks [007: index access](docs/tasks/007-index-access.md),
[008: primitive literals](docs/tasks/008-primitive-literals.md), and
[009: class constants](docs/tasks/009-class-constants.md) are also complete.
Further syntax expansions need separate briefs.

The ignored local corpora have separate roots:

- `corpus/application/` contains the fixed application templates and supplies
  the real-world completeness signal.
- `corpus/upstream-smarty-v5.8.4-core/` contains selected official Smarty test
  templates, materialized on demand from a pinned checkout.
- `corpus/upstream-smarty-v5.8.4-example/` contains the official demo template
  and is reported separately from the positive upstream tests.

The default report reads only the application corpus:

```sh
npm run corpus:report
```

The report groups lexical hints and records error locations in
`build/corpus-report.json`. Remaining parse errors identify gaps to investigate
and add to the feature inventory/task queue; the parser is not complete for this
application while any remain. Clean parses still need structural review.
Minimized, reviewed examples belong in the tracked
`test/corpus/` regression set. Public CI runs `npm test` without needing the
private local application corpus.

To report either upstream root, pass it explicitly, for example:

```sh
npm run corpus:report -- ./corpus/upstream-smarty-v5.8.4-core /tmp/smarty-upstream-core.json
npm run corpus:report -- ./corpus/upstream-smarty-v5.8.4-example /tmp/smarty-upstream-example.json
```

## Neovim

Smarty highlighting, combined HTML injection (with nested JavaScript/CSS through
HTML queries), and folds for recognized blocks are available. Smarty syntax
remains highlighted inside scripts and styles. See [the Neovim setup guide](docs/neovim.md)
for parser installation, filetype registration, required host queries, and checks.
