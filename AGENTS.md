# Working on this grammar

For multi-agent, end-to-end project work, follow [the agent loop](docs/agent-loop.md).
It defines the project completion target, role boundaries, handoffs, and review gates.

Target a broadly useful Smarty 5 parser with practical coverage and robust
recovery; editor support is the primary use case, and CLI tools and other
integrations are also expected consumers. `smarty2` is the package name, not the
language version. Use bounded, tested syntax changes to build toward that goal.
Project-specific plugin behavior and arbitrary custom tag semantics are out of
scope; preserve unknown tags and their supported contents where possible.
Read `test/CONTRACT.md`, `docs/features.md`, and the selected brief in
`docs/tasks/` before extending syntax. Follow `docs/expanding.md`.

## Commands

- Install locked dependencies: `composer install` and `npm ci`.
- Required acceptance gate: `npm test` (regenerates and rebuilds first).
- Local corpus evidence: `npm run corpus:report`. Save its JSON outside `build/`
  before another build if comparing before/after; node-gyp rebuild clears build/.
- New Node checks go in `test/*.test.mjs`; the runner discovers them automatically.
- Expected trees go in `test/corpus/*.txt`; Tree-sitter discovers them automatically.
- The PHP reference adapter is `test/reference.php`; no application plugins are needed.

## Expansion rules

1. Take one bounded task. Add manually specified trees and a failing check before
   implementation. Keep unrelated syntax changes out of the task.
2. Preserve full expression detail inside unknown tags. Unknown opening/closing
   tags stay separate; do not add application-specific tag allowlists.
3. Do not auto-update expected trees, delete failing fixtures, weaken assertions,
   skip checks, or add broad text fallbacks to obtain passing results. If an
   existing expectation is wrong, show a minimal Smarty observation and explain
   the contract correction explicitly in the change report.
4. Preserve comments explaining non-obvious precedence, conflicts, and recovery.
   Put the roadmap in docs, not TODOs scattered through the grammar.
5. Edit `grammar.js` (and a scanner if justified), then regenerate. Do not hand-edit
   generated files under `src/` or modify the vendored Smarty reference.
6. Treat the local application corpus as the real-world completeness signal for
   this use case. Remaining parse errors are evidence of gaps: investigate and
   feed confirmed syntax/recovery gaps into `docs/features.md` and task briefs.
   A no-error parse is not proof of support. Promote reviewed, minimized examples
   into tracked expected-tree tests; never count swallowed syntax as progress.
7. Test composition and an edit crossing the new boundary. Extend mutation checks
   when a new failure mode could otherwise escape; not every rule needs a mutation.
8. Update the feature row, contract, task status, and evidence links. A task is
   complete only after `npm test` passes. Report corpus results and remaining
   failures; the parser is complete for this use case only when the fixed local
   corpus has zero parse errors and newly clean files have structurally reviewed
   trees. If the corpus is absent, completion cannot be verified; do not fabricate
   coverage or make public CI depend on it.

## Reference limits

The recording compiler bypasses plugin execution and compiler block validation.
Its current projection checks names/order/argument names and counts, not argument
values, runtime behavior, or arithmetic precedence. Use explicit trees for structure.
The initial reference suite reads `initial.txt`; opt new feature fixtures into
their own reference tests using `fixtures(filename)` from `test/helpers.mjs`.
If a brief conflicts with real Smarty behavior, document the minimal discrepancy
and resolve the contract before implementing a guessed interpretation.

## Completion report

State the supported syntax, changed tree shape, tests run, before/after corpus
evidence when available, and limitations. Include any changed expectations and why.
Do not treat this repository's instructions as a substitute for external review:
CI and tests are editable too.
