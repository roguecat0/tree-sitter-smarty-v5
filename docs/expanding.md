# Expanding the parser

## Choose and specify

Use [features.md](features.md) to select a ready task. Work on one syntax family.
The brief fixes the initial scope and proposed node fields; grammar implementation
choices remain the implementer's responsibility. Resolve a demonstrated conflict
with Smarty before changing the proposal.

Start with the listed small fixtures, manually write their expected trees, and
run `npm test` to observe the intended failure. New corpus files are discovered
by Tree-sitter; new `test/*.test.mjs` files are discovered by our runner. For
Smarty comparisons, explicitly load the new file with `fixtures('feature.txt')`.
Keep rejected/recovery cases in separate Node tests or separate Tree-sitter
fixtures; the simple `fixtures()` helper only reads the ordinary valid-case format.

Use the locked Smarty source as a reference, especially
`vendor/smarty/smarty/src/Parser/TemplateParser.y` and
`vendor/smarty/smarty/src/Lexer/TemplateLexer.plex`. Adapt `test/reference.php`
only when needed to observe additional syntax; explain any new bypass and test
its failure behavior. Do not replace reference observations with hand-coded
answers that merely duplicate the grammar.

## Implement and verify

Implement the smallest coherent feature. Check it in output expressions, generic
tag arguments, modifiers, or built-in conditions where applicable. Include an
unfinished form and an edit that breaks and repairs the construct. Reuse the
full-tree `snapshot()` helper for incremental comparisons, not just node names.

Run `npm test`: exact trees, Node reference/recovery/edit checks, and isolated
mutation checks must pass. If grammar refactoring breaks a mutation's source
anchor, update the anchor while preserving the same fault and demonstrate that
the mutation still generates and fails its intended tree assertion.

## Use the corpus now

```sh
npm run corpus:report
```

This writes `build/corpus-report.json` with file hashes, generated-parser hash,
all error/missing-node locations, snippets, and overlapping lexical hints.
Positions are 1-based line/column in the Node binding's UTF-16 coordinate system.
Source line endings are preserved. Hints can match strings or comments and are
not diagnoses. A parsing timeout, unreadable input, invalid UTF-8, or missing/empty
corpus fails the command; ordinary parse errors do not.

Alternative corpus and output path:

```sh
npm run corpus:report -- ./corpus /tmp/smarty-before.json
```

Save before/after reports outside `build/`: rebuilding the native binding clears
that directory. Compare identical file hashes before attributing changes to the
grammar. Investigate files that newly fail, but also inspect relevant node types
and fields in newly clean files. No percentage threshold is a completion gate.

`corpus/` is locally supplied and ignored by Git. Reports contain source snippets;
they stay local under ignored `build/` by default. Public CI uses tracked fixtures.
Do not add the entire corpus or its reports to the repository to satisfy CI.

## Promote evidence into the regression set

For each useful corpus discovery:

1. Reduce it to a small example, replacing application names and unrelated content.
2. Record its local source path and the behavior it demonstrates in the task brief.
3. Manually specify its tree in `test/corpus/`, including fields. Add a reference
   comparison where Smarty can actually independently verify the behavior.
4. Check that relevant syntax is represented explicitly, not merely accepted.

Those tracked expected trees are the protected regression set: every future
`npm test` runs them, even without the original corpus. Protection means required
tests and reviewed expectation changes; it is not an immutable security boundary.
Whole-file no-error snapshots are not substitutes for reviewed structural tests.

## Finish and hand off

Update the inventory status and links, the contract, and the brief's evidence
section. Report exact commands and outcomes, remaining unsupported forms, and
any changes to existing expectations. Mark partial work as partial.

CI runs the same acceptance command and checks generated sources are current.
After the workflow is pushed, the repository owner should make **Grammar checks**
a required status check and require review for test/contract changes. Local files
alone cannot enforce these hosted repository settings. The workflow has not yet
been exercised on a hosted runner.

Workflow action references: [checkout](https://github.com/actions/checkout),
[setup-node](https://github.com/actions/setup-node), and
[setup-php](https://github.com/shivammathur/setup-php).
