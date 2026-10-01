# Expanding the parser

## Choose and specify

Use [features.md](features.md) to select and prioritize work toward broad,
practically useful Smarty 5 coverage. Editor support is the primary use case, but
the syntax trees should also serve CLI tools and other integrations. Work on one
syntax family at a time to keep each change reviewable; bounded tasks are an
implementation method, not a limit on the project goal. Prefer common syntax and
recovery improvements that help downstream consumers, especially highlighting
and tree structure in real templates. Arbitrary project-specific plugin behavior
is out of scope, but unknown tags should not cause their supported contents to be
lost. The brief fixes the initial scope and proposed node fields; grammar
implementation choices remain the implementer's responsibility. Resolve a
demonstrated conflict with Smarty before changing the proposal.

Keep the cross-context expression checklist in [composition.md](composition.md).
Task creators must check it when writing a syntax brief: name the expression
contexts affected by the feature, add representative combinations that should
work or fail, and update the checklist when its coverage changes. Do not try to
test every Cartesian combination. Use [task 015](tasks/015-composition-audit.md)
for the initial audit of the existing grammar and to establish a checked
baseline before making this an ongoing task-creation responsibility.

Put minimized examples derived from the pinned Smarty source tests or official
documentation in the dedicated `test/corpus/smarty-reference.txt` Tree-sitter
corpus. Keep their source and Smarty version in the fixture names or accompanying
task evidence. These fixtures supplement the local application corpus; they do
not replace its role as the practical completeness signal. Task
[014](tasks/014-default-auto-literal-boundary.md) starts this section with
default delimiter-boundary examples.

When a task excludes syntax that Smarty accepts, distinguish the task boundary
from the project's overall goal. Briefly state why that form is outside this
task and whether it remains a known project gap or is intentionally out of
scope. Record only reasons supported by evidence or an explicit design decision.
Keep this rationale concise in the brief.

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

Implement the smallest coherent feature that advances practical syntax coverage
or useful recovery. Check it in output expressions, generic tag arguments,
modifiers, or built-in conditions where applicable. Include unfinished and
malformed forms where relevant, plus edits that break and repair the construct.
Check that neighboring syntax remains structured during recovery, as well as
after repair. Reuse the
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
not diagnoses. Ordinary parse errors are recorded in the report rather than
failing the reporting command; for this project, remaining errors are unresolved
real-world coverage failures and must drive investigation and tasks. A parsing
timeout, unreadable input, invalid UTF-8, or missing/empty corpus fails the
command.

Alternative corpus and output path:

```sh
npm run corpus:report -- ./corpus/application /tmp/smarty-before.json
```

Save before/after reports outside `build/`: rebuilding the native binding clears
that directory. Compare identical file hashes before attributing changes to the
grammar. Investigate files that newly fail, files that remain failing, and the
relevant node types and fields in newly clean files. Group related failures,
reduce representative examples, and update `docs/features.md` plus bounded task
briefs for confirmed syntax or recovery gaps. A complete-looking inventory does
not override unexplained errors in the application corpus.

The ignored local corpus roots are separate: `corpus/application/` is the fixed
application completeness corpus; `corpus/upstream-smarty-v5.8.4-core/` contains
selected official Smarty test templates; and
`corpus/upstream-smarty-v5.8.4-example/` contains the separate upstream demo.
The default report reads only the application root. Pass an upstream root
explicitly to report it, and keep those results separate. Reports contain source
snippets; they stay local under ignored `build/` by default. Public CI uses
tracked fixtures. Do not add local corpora or their reports to the repository to
satisfy CI.

## Promote evidence into the regression set

For each corpus failure pattern or useful discovery:

1. Reduce it to a small example, replacing application names and unrelated content.
2. Record its local source path and the behavior/error it demonstrates in the task brief.
3. Manually specify its tree in `test/corpus/`, including fields. Add a reference
   comparison where Smarty can actually independently verify the behavior.
4. Check that relevant syntax is represented explicitly, not merely accepted.

Those tracked expected trees are the protected regression set: every future
`npm test` runs them, even without the original corpus. Protection means required
tests and reviewed expectation changes; it is not an immutable security boundary.
Whole-file no-error snapshots are not substitutes for reviewed structural tests.
They are still required as the real-world completeness signal for this
application: remaining errors mean the parser's practical feature coverage is
not finished and should produce further inventory/task work. Project completion
requires zero parse errors in the fixed local corpus and structural inspection
of newly clean files. Keep existing feature rows; append or refine the inventory
as corpus failures expose additional gaps.

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
