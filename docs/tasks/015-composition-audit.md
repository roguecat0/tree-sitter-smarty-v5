# 015 — Audit expression composition in the existing grammar

Status: complete (2026-10-01). Independent implementation review accepted.
Brief review accepted (2026-10-01) after one revision round. Dependencies:
implemented syntax tasks 001–012. Later tasks, including 013, must extend the
checklist when they add or change expression forms or contexts.

## Audit evidence

Baseline before test changes: exact command `npm test`, exit 0. It passed 124
hand-authored corpus trees, 180 Node checks, and all 11 mutation checks. The
baseline repository revision was
`df8d2d2c986cac66effd42081368a42f800a727f`; `grammar.js` SHA-256 was
`0aa37be6cac42830e34cd5524e5d88489ab65f32ef1fea2bd34cfd0154ef4d5c`.
Full repeat output: `/tmp/smarty-015-baseline.log`.

Final audit command: `npm test`, exit 0; 126 expected trees, 184 Node checks,
and all 11 mutation checks were caught. Final revision remained
`df8d2d2c986cac66effd42081368a42f800a727f`; final `grammar.js` SHA-256 remained
`0aa37be6cac42830e34cd5524e5d88489ab65f32ef1fea2bd34cfd0154ef4d5c`. Full
output: `/tmp/smarty-015-final.log`. No grammar rules changed, so no parser or
application-corpus delta was expected; no corpus report was generated.

The matrix now records 132 cells: 83 `yes`, four `limited`, one confirmed
`no`, and 44 `?` pairings without direct composition evidence. The confirmed
gap is loop metadata as a modifier argument. Exact source:
`{foreach $items as $item}{$item|default:$item@index}{/foreach}`. Tree-Sitter
currently produces an `ERROR` after the modifier argument `$item`; the pinned
`php test/reference.php` observation uses Smarty 5.8.4 and returns `error:null`
with foreach/default/output/close events. `test/CONTRACT.md` and the foreach
feature row now state this boundary. Task 016 exists only as a noncanonical
draft candidate; it is not queued or accepted and requires a separate task-
creation owner and reviewer. This audit does not implement the grammar gap or
mark that brief accepted.

Two high-value composition examples were added: class constants as both an
array key and value, and loop metadata as function/method arguments. Their
hand-authored trees and checks are linked from the corresponding matrix cells.
Unknown pairings remain explicit and linked to a concrete row/context follow-up;
they are not inferred from shared grammar routing.

## Motivation

Syntax features are introduced incrementally, but the grammar has several
expression entry points with different accepted subsets. A form may work in an
output and fail in a tag attribute, modifier argument, array index, or nested
call. [The composition checklist](../composition.md) gives those contexts one
shared inventory. Before using it for ongoing task creation, audit what the
existing grammar and fixtures actually cover.

## Scope

Audit the currently implemented expression forms against the expression
contexts listed in `docs/composition.md`. For each cell, inspect the grammar and
existing expected-tree/reference tests, then record `yes`, `limited`, or `no`
with evidence and a short boundary. Add a test only where the cell's current
status is uncertain or a high-value gap is exposed. This is a bounded audit;
it does not require the full Cartesian product of every feature and context.

Prioritize interactions likely to drift because they use separate rules:

- full expressions versus modifier arguments;
- call, method, and array expressions nested in one another;
- access expressions (property, method, index, loop metadata) around modifiers
  and operators;
- generic tag positional arguments and attribute values;
- `foreach` sources and built-in conditions.

Use Smarty's pinned parser/compiler for behavior where it can observe syntax.
Use manually specified trees for the intended Tree-sitter structure. Do not
infer runtime binding, plugin semantics, or precedence from the event-only
recorder.

## Acceptance work

1. Review every matrix cell against `grammar.js`, `test/CONTRACT.md`, existing
   hand-authored trees, and Node/reference checks. Use the distinct rows and
   columns in `docs/composition.md`: property access, method calls, index
   access, loop metadata, and class constants are separate forms; modifier
   input and modifier argument are separate contexts; and a bracket-index
   expression is the expression inside `[ ]`, not the index-access expression
   that contains it.
2. Run `npm test` before making any test changes to establish the baseline.
   Record the exact command, pass/fail result, and all reported suite counts
   (corpus trees, Node checks, and mutation checks) in this task's evidence.
   Record `git rev-parse HEAD` and the SHA-256 of `grammar.js` alongside the
   baseline and final results so the parser revision is unambiguous. Add only
   hand-authored expected trees and focused checks for uncovered high-value or
   ambiguous cells. Keep each addition small enough to identify which
   composition boundary it protects.
3. This task is an audit: do not change grammar rules. Record a confirmed
   composition defect as a concrete gap and create or update a separate bounded
   syntax brief for it. If an unsupported form is a deliberate Smarty or
   project boundary, document that instead of broadening syntax to fill a cell.
4. Update every cell in `docs/composition.md` with `yes`, `limited`, or `no`
   plus evidence. A `yes` needs a link to a hand-authored tree and a Node or
   Smarty-reference check exercising that composition. One fixture/check may
   evidence multiple cells only when its expected tree exposes each form and
   its check runs that fixture. A `limited` cell must state the exact accepted
   subset and boundary. A `no` cell must distinguish a grammar support gap from
   Smarty rejection or a project exclusion. For a gap, cite pinned positive
   Smarty behavior and link its tracked brief/contract entry; for rejection,
   cite pinned negative behavior; for an exclusion, cite the contract decision.
   Absence from the current grammar alone proves none of these. Cite a minimized
   Smarty observation where recorder/full-engine behavior distinguishes a
   syntax claim. This evidence protocol does not require a Cartesian product of
   tests; existing combined fixtures can be reused, and new tests are limited
   to cells that lack adequate evidence or have an unresolved high-value
   ambiguity. Keep runtime, plugin, and value-semantics claims outside the
   matrix when the recorder cannot observe them.
5. Reconcile every audited claim with `test/CONTRACT.md` and the affected
   syntax rows in `docs/features.md`. Change those documents only where the
   audit proves that a current claim needs correction or clarification. An
   unchanged, already accurate claim needs no mechanical edit.
6. Run `npm test` after changes. Record its exact command, result, corpus-tree,
   Node-check and mutation-check counts, `git rev-parse HEAD`, and SHA-256 of
   `grammar.js` in the task evidence. If grammar rules changed, report
   before/after corpus reports with the same input hashes, and structurally
   inspect all newly clean files. If no grammar rules changed, state that no
   parser/corpus delta was expected; do not invent corpus evidence.
7. Update the audit status and links. Summarize cells changed, evidence
   limitations, and any remaining unverified scope.

## Ongoing rule

After this audit, every syntax task brief must identify affected rows/columns,
select representative composition tests, and update the checklist when support
changes. Task reviewers verify that check. A task that audits a cell without
changing coverage may cite its established matrix evidence in task evidence
without mechanically changing the cell. Every populated cell must retain
evidence that can be followed from the matrix to the exact fixture/check or
pinned behavior/exclusion and its stated boundary.

## Brief-review disposition

Independent task-creation review accepted (2026-10-01) after one revision
round: (1) separate property, method, index-access,
loop-metadata, and class-constant rows; distinguish modifier input from
modifier argument and bracket-index contents from index access; (2) define
per-cell evidence that connects hand-authored structure with Node/reference
checks or pinned Smarty behavior/project exclusions, while avoiding a required
Cartesian test suite; and (3) record the `npm test` command, results/counts,
parser revision/hash, and reconcile audit claims with the contract and feature
inventory.

The reviewer accepted the revision with no remaining findings. Revision
response: the composition matrix now has those five separate syntax
rows, separate modifier input/argument and bracket-index-expression/index-access
entries, plus separate array-key/value contexts. The matrix defines `yes`,
`limited`, and `no` evidence and boundary notation. Its protocol permits one
combined fixture to evidence multiple cells only when the tree and executed
check directly demonstrate those cases, so it does not mandate Cartesian tests.
The brief requires exact `npm test` results and suite counts plus commit revision
and `grammar.js` SHA-256 at baseline and completion. It also requires a
claim-by-claim reconciliation with `CONTRACT.md` and `features.md`, editing only
claims the audit shows need correction or clarification. The task is explicitly
documentation/tests only: a confirmed parser gap becomes a separate syntax
brief instead of a grammar edit in this audit.
