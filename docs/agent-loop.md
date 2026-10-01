# Project completion and agent loop

This document defines how an orchestrator and five distinct agent roles can
advance the Smarty grammar from its current partial state to a reviewable
release target. It is a workflow contract, not a promise that agents can run
without supervision or that adding agents alone improves correctness.

## Project completion

The project is complete when all of these conditions hold:

1. Every existing feature row and every corpus-discovered gap has a truthful,
   reviewed status. Keep existing rows; do not remove or narrow inventory
   entries to make the project appear finished. Practical syntax in the target
   is supported with tracked evidence. Any deliberately excluded behavior has
   an explicit reason consistent with the project boundary. No intended feature
   remains `Ready`, `Partial`, or `Unimplemented`.
2. The supported surface covers the common expressions, outputs, tags, built-in
   blocks, literal/comment/delimiter forms, and recovery behavior identified by
   the inventory and real application corpus. Plugin execution and arbitrary
   plugin semantics remain outside the parser's goal; unknown tags still retain
   supported syntax and expressions.
3. Each supported syntax family has hand-authored expected trees for its node
   and field structure, representative composition, and relevant malformed or
   incomplete input. Relevant edit boundaries are checked. Smarty reference
   checks are used where the recorder/compiler can observe behavior; explicit
   trees remain the structural contract.
4. Task briefs, `docs/features.md`, `test/CONTRACT.md`, tests, and completion
   evidence agree. Every completed task links to its evidence. Any changed old
   expectation has a minimal Smarty observation and an explicit contract reason.
5. A clean checkout passes `npm test`, including parser generation/build, all
   expected trees and Node/reference/edit/mutation checks. Generated sources are
   current. Error-free parsing alone is not counted as structural support.
6. The fixed local application corpus has zero parse errors on a hash-matched
   run of the final parser. Every remaining error before that point is an
   unresolved completeness gap: investigate it and add or refine feature/task
   work. Inspect the tree structure of newly clean files so syntax swallowed as
   text is not counted as progress. If the corpus is unavailable, completion for
   this use case cannot be verified; do not claim it.

The corpus is the practical acceptance signal for this application, not merely
a source of prioritization hints. Its errors can reveal syntax absent from the
current inventory, so the task-creation loop must keep expanding or correcting
that inventory until the corpus gate passes. The inventory is a living map, not
a fixed ceiling.

The starting inventory already names gaps including standalone function calls,
array literals, string interpolation, bitwise and word operators, other
built-in blocks (including inheritance/capture/switch forms), literal
blocks/auto-literal, configurable delimiters, and HTML injections or queries.
All confirmed standard Smarty 5 syntax is in the parser target, including forms
that take several bounded tasks to implement. Difficulty and corpus frequency
guide task ordering and decomposition; they do not justify excluding standard
syntax. Each task creator still verifies actual Smarty behavior, identifies
the exact syntax boundary, and specifies structural and recovery evidence.
Plugin execution, arbitrary plugin semantics, and separate editor integrations
such as HTML injections remain outside the grammar target unless the project
scope is explicitly changed. Recovery is a cross-cutting requirement, and new
standard syntax families must enter the inventory and reviewed task queue.

## The five roles

Use five separate agent instances or clean role contexts. For a given task, no
agent may own both the artifact and its review. Each role returns the handoff
artifact named below; the orchestrator keeps the canonical task state in
`docs/tasks/` and `docs/features.md`.

### 1. Orchestrator

Owns project state, ordering, and the stop decision; does not write feature
implementations or approve its own work.

- Establish the completion inventory and decide whether a newly discovered
  syntax family is in the release target. Keep a finite queue and dependencies.
- Run and preserve the local corpus report when available. Use remaining errors
  to identify and prioritize gaps, while treating lexical hints as leads rather
  than diagnoses. Cluster related errors into bounded tasks.
- Select one bounded task at a time using corpus failures, common usage, consumer
  value, and prerequisite order.
- Assign different instances to task creation owner/reviewer and implementation
  owner/reviewer. Give reviewers the contract and evidence, but not the owner's
  hidden reasoning. Keep roles separate within each task.
- Enforce the state transitions below. Reopen a task only for a specific
  unresolved finding or failed gate; do not loop on preferences or speculative
  scope.
- Decide finding disposition from repository instructions and evidence. Record
  accepted limitations and unresolved disagreements in the task brief.
- After a task passes, record reviewer acceptance and evidence, update its
  canonical status to `complete`, and create a Git commit for that task before
  selecting the next task. Include its grammar/scanner changes, generated
  sources, tests, contract, inventory, brief, and evidence in the commit. Keep
  one commit per completed task; report the commit hash in the handoff. If the
  commit fails or the worktree contains unexplained changes, resolve that before
  advancing the queue.
- Make a project-finished decision only when all six conditions above hold;
  report blockers that need human input.

### 2. `task_creation_owner`

Turns one inventory gap into an implementable, bounded task brief. Does not
change the grammar.

- Read `AGENTS.md`, `test/CONTRACT.md`, `docs/features.md`, and
  `docs/expanding.md`, plus relevant task briefs, tests, and pinned Smarty
  reference source.
- Inspect remaining local corpus failures when the corpus is available. Group
  related failures, reduce representative examples, and decide whether each
  demonstrates a missing feature, an implementation/recovery defect, or an
  existing feature boundary that needs refinement. Update `docs/features.md`
  when the inventory needs a new row or a status/boundary correction; draft one
  bounded task brief for the confirmed gap.
- State motivation and evidence, a narrow acceptance boundary, proposed node
  shape/fields, representative positive and negative examples, composition,
  recovery/edit checks, and exclusions that remain project gaps.
- Write fixture examples and expected trees by hand in the brief; identify the
  failing check to add first. Identify a reference observation where useful and
  state its limitations.
- Call out ambiguity with Smarty behavior instead of encoding a guess. Do not
  put implementation details in the brief unless required by the tree contract.
- Handoff: task brief draft plus a short list of scope decisions that need
  review.

### 3. `task_creation_reviewer`

Tries to falsify the proposed task before implementation. Does not implement or
silently rewrite the scope.

- Independently check the proposed examples against the pinned Smarty source or
  a minimal compiler/reference observation where available.
- For corpus-driven tasks, verify that the reduced example reproduces the
  reported parse failure and that the proposed inventory change reflects the
  missing or incorrectly bounded syntax.
- Look for ambiguous boundaries, missing malformed cases, interactions with
  existing precedence/recovery, accidental generic fallbacks, loss of detail in
  unknown tags, application-specific assumptions, and claims unsupported by the
  reference adapter.
- Report only actionable findings, each with severity, the exact brief section
  or example, the violated repository rule/contract, a concrete counterexample
  or source evidence, and the smallest correction.
- Challenge exclusions that make the feature unhelpful, while distinguishing
  task-sized omissions from project-level exclusions. Preserve explicit dissent
  if a conflict remains.
- Handoff: `accept`, `revise`, or `reject` plus a finding list. Acceptance means
  the brief is testable and bounded, not that the planned feature is complete.

### 4. `tasks_completion_owner`

Implements the accepted brief and assembles reviewable completion evidence.

- Add hand-authored corpus trees and a failing Node check before grammar changes.
  Follow the bounded scope and do not hand-edit generated sources or modify the
  vendored Smarty reference.
- Implement the smallest coherent grammar/scanner change. Preserve precedence,
  comments, error recovery, unknown-tag expression detail, and existing tree
  contracts except for explicitly reviewed corrections.
- Cover composition and relevant incomplete/malformed forms and an edit crossing
  the new boundary. Never auto-update expected trees, delete failing fixtures,
  weaken assertions, or count swallowed syntax as support.
- Run the required gates from `AGENTS.md`, including `npm test`. Collect corpus
  before/after reports when available; preserve reports outside `build/` before
  rebuilding. Inspect both regressions and the tree structure of newly clean
  templates.
- Update the task evidence, feature row, and contract only after evidence exists.
  Report commands and results, limitations, changed expectations, and any
  deviation from the brief.
- Handoff: implementation diff plus evidence report. Do not mark the task
  complete if any required gate fails.

### 5. `task_completion_reviewer`

Independently tries to find defects in the implementation and its evidence. Does
not edit files or treat a green test run as proof by itself.

- Read the accepted brief and contract before reviewing the diff. Inspect the
  grammar, new and changed tests, generated-source status, and evidence claims.
- Attempt to falsify each acceptance claim: inspect exact trees and fields,
  unknown-tag preservation, precedence/ambiguity, recovery, edit equivalence,
  neighboring syntax, and any changed old expectation. Check for tests that
  pass by accepting swallowed syntax.
- Verify that commands/results are real and claims match them. Check that
  corpus-derived feature additions/status changes correspond to minimized,
  reproducible examples and that unaddressed failures remain visible. Do not
  demand unsupported plugin semantics.
- Return only actionable findings, each with severity, file/line or fixture,
  concrete reproduction/evidence, impact, and a minimal remedy. Label uncertainty
  and distinguish a proven defect from a possible follow-up.
- Handoff: `accept` or `revise` with findings and an explicit checklist of
  acceptance criteria verified. A review is not a merge or release authorization.

## Loop and state transitions

One task moves through these states in order:

```text
queued
  -> brief_draft (task_creation_owner)
  -> brief_review (task_creation_reviewer)
  -> brief_accepted
  -> implementation (tasks_completion_owner)
  -> implementation_review (task_completion_reviewer)
  -> evidence_accepted
  -> complete
```

- `revise` at brief review returns to the creation owner with the finding list.
  The owner replies point-by-point; the reviewer rechecks only changed scope
  and affected examples. Allow at most two revision rounds before the
  orchestrator narrows, splits, defers, or rejects the task with a recorded
  reason.
- `revise` at implementation review returns to the implementation owner. The
  owner fixes proven defects or gives a source/test-backed disposition for each
  finding. The same reviewer verifies the disposition and reruns affected
  checks; use a fresh reviewer if the changes materially expand scope. Allow at
  most two rounds before the orchestrator records a blocker or re-scopes.
- A reviewer cannot approve based on an owner's assertion alone. The evidence
  must be inspectable in repository files or reproduced by a named command.
- Reviewers do not negotiate toward consensus. The owner may rebut a finding;
  the reviewer must state whether the rebuttal changes the finding and why. The
  orchestrator resolves remaining disagreement against the written contract,
  pinned reference behavior, and executable evidence, and preserves unresolved
  uncertainty in the brief.
- Only the orchestrator advances a task to `complete`, after reviewer
  acceptance and all repository gates. It then schedules the next queued task.

These bounds prevent review loops from running forever. A blocked or deferred
task remains visible in the inventory and prevents project completion until it
is resolved. Corpus errors cannot be made to disappear by omitting their syntax
from the feature inventory; they need a task and resolution grounded in
investigation.

## Running this with Codex subagents

The orchestrator stays in the parent context and owns the task state. Spawn one
subagent for the current role, providing this document, `AGENTS.md`, the current
brief or draft, and the required handoff format. Run phases sequentially because
subagents share the workspace; parallel owners/reviewers could overwrite one
another or review a moving tree. A reviewer receives the frozen artifact and
must not edit it. Keep agent conversations scoped to one task and start review
agents with the artifact/evidence, not the owner's private analysis. On each
handoff, the orchestrator records the decision in the task brief and launches
the next role. Never ask a subagent to continue indefinitely: the orchestrator
advances one state per handoff and checks the six project completion conditions.

At the start of each task, tell the role its exact name from the five-role list,
its allowed files/actions, the current state, and the handoff artifact it must
return. At the end of each implementation/review pair, use the written evidence
to advance the state; agent confidence or agreement is not a gate.
The transition to the next queued task happens only after the accepted task is
committed. The commit is part of the orchestrator's completion responsibility,
not a task-owner or reviewer action.

## Adversarial review protocol

“Adversarial” means actively trying to disprove the artifact's important claims,
not being hostile to the author or manufacturing objections. Each review should
start from the contract and attack likely failure points independently, before
reading the author's rationale where practical. Findings must be evidence-first:
location, violated expectation, reproducer, and impact. The author answers each
finding separately; the reviewer tests those answers. A concise dissent record
is better than consensus without evidence.

The research supports a restrained protocol. Qiu and Gill's 2026 *Adversarial
Review* reports a three-role reviewer/critic/coder protocol and highlights
false consensus on SWE-PRBench; their abstract says explicitly prompting for
disagreement improved that result. This supports asking the reviewer to challenge
both the artifact and weak review conclusions, while keeping disagreement
structured and grounded. It does not prove this five-role workflow will improve
this repository, so the acceptance gates remain executable tests and human-
inspectable trees. Huang et al. find that intrinsic self-correction without
external feedback can fail or degrade reasoning, which motivates independent
review and concrete reference/test evidence instead of asking an owner to
self-certify. Multi-agent debate studies report mixed, task-dependent results;
this workflow therefore uses bounded review passes rather than open-ended debate
or a larger agent panel.

Research:

- Qiu & Gill, [*Adversarial Review: Structured Disagreement for Grounded Agentic
  Code Review* (2026)](https://arxiv.org/abs/2608.18167).
- Huang et al., [*Large Language Models Cannot Self-Correct Reasoning Yet*
  (2023)](https://arxiv.org/abs/2310.01798).
- Chun et al., [*Is Multi-Agent Debate (MAD) the Silver Bullet? An Empirical
  Analysis of MAD in Code Summarization and Translation* (2025)](https://arxiv.org/abs/2503.12029).
