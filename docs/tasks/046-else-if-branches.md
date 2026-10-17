# 046 — Spaced `else if` branches

**Status:** complete (2026-10-17); brief and implementation reviews accepted.
**Type:** standard Smarty syntax gap.
**Dependencies:** 005, 039.

## Motivation and confirmed witness

FBS `process_feedback.tpl:207`, `view_actions/step2.tpl:10`, and
`view_config/watches_table.tpl:16` use `{else if ...}`. Nine failing FBS
application files contain this spelling; `view_actions/edit_action.tpl` also
needs Task 049. Recovery currently cascades into outer blocks and loop closers.

```smarty
{if $a}A{else if $b}B{else}C{/if}
```

## Bounded scope and proposed tree contract

Accept the spaced alternative to `elseif` with the existing `elseif_clause`
and `elseif_tag(condition: expression)` structure. Keep the whole `{else if ...}`
header range and existing branch/body ownership; do not represent it as an
`else_clause` followed by an independent `if_block`. Preserve `{elseif}` trees.

The pinned Smarty 5.8.4 lexer recognizes the literal lowercase spelling `else if`
with one ASCII space and maps it to `elseif`. The recorder and full compiler
accept that spelling. Two spaces, a tab, a newline, and mixed-case `Else if`
do not form the same branch; the mixed-case probe compiles as an unknown tag.
Accept exactly `{else if ...}` and existing `{elseif ...}` in this task. Preserve
rejected separator/case forms as errors or independent generic-tag recovery as
appropriate; do not normalize whitespace or case. Other conditional syntax
remains separate work.

## Failing-first trees, composition, recovery and edits

- Hand-author simple, repeated and mixed `{elseif}` / `{else if}` branch trees.
- Compose inside foreach/if nesting, with braced conditions, method calls, word
  comparisons, and independent trailing output. Conditions reuse the existing
  expression contract; this task adds no new expression operators.
- Check a missing condition, missing header brace, crossed closer and unfinished
  branch. Require real errors and recognizable later output/closers without
  making one exact recovery extent mandatory.
- Edit `{elseif $b}` to `{else if $b}`, break the condition, then repair it.
- Add a mutation that would reinterpret the spaced branch as an else body if
  ordinary exact-tree coverage would otherwise miss branch ownership.

## Implementation and completion gate

Before implementation, read `test/CONTRACT.md`, `docs/expanding.md` and
`docs/composition.md`. Add manually specified trees in `test/corpus/else-if-branches.txt`
and a failing check in `test/else-if-branches.test.mjs`; explicitly opt valid fixtures into
`fixtures('else-if-branches.txt')`. Confirm the intended failure before changing grammar.
Keep malformed cases separate from the valid reference fixture projection.

Use pinned Smarty lexer/parser sources and `test/reference.php`; use
`test/full-engine.php` for controlled full-compiler or render checks. The
recorder bypasses plugin execution and compiler block validation and does not
prove argument values or precedence. Never render application templates for this
syntax task. Add minimized pinned-source examples to `smarty-reference.txt`
when available, with provenance. Edit grammar/scanner sources and regenerate;
never hand-edit generated parser files or vendored Smarty.

Run `npm test`, including existing mutation checks. Compare full fresh and
incremental snapshots for the edits above. Update the contract, feature row,
composition evidence for verified pairs only, and task status/evidence. Review
editor query impacts for new/changed named nodes without expanding into an
unrelated editor redesign.

Save hash-matched before/after corpus JSON outside `build/`. Report the fixed
`corpus/application/`, upstream core and upstream demo separately. Also rerun
current `../b3-app/fbs` and `../b3-app/hdb` as separate roots if available; they
are not the fixed application corpus. Inspect explicit structure in newly
clean files and changed trees, report remaining errors and regressions, and do
not count swallowed syntax as progress. If a root is absent, say so. Tests and
local reports do not replace independent review.

## Evidence status

## Implementation evidence

Added a single exact token for lowercase `else if` with one ASCII space as a
second `elseif_tag` spelling. Both spellings retain the existing
`elseif_clause` tree and condition field. The new valid trees cover simple,
repeated/mixed spelling, a braced expression condition, and foreach/if nesting
with method calls and word comparisons. The braced case
`{if $a}A{else if {$b}}B{/if}` keeps the existing `output` wrapper inside
`elseif_tag.condition`; both the recorder and compile-only engine accept it.
Malformed branch headers retain real parse errors and recognizable
neighbors. Incremental edits compare complete snapshots against fresh parses
while switching spellings, deleting a condition, and repairing it. Exact-tree
branch ownership assertions cover the mutation described above, so no separate
branch-specific mutation was needed.

The pinned Smarty 5.8.4 recorder and compile-only engine accept both supported
spellings. Lexer/parser probes confirm only the exact lowercase one-space
`else if` token maps to `elseif`; doubled spaces, tab, and newline are recorded
as `else`, while `Else if` is a distinct unknown tag. The minimized pinned-source
tree is in [smarty-reference.txt](../../test/corpus/smarty-reference.txt), based
on `TemplateLexer.plex` line 333 and `TemplateParser.y` lines 434–452.

The brief review was accepted by the orchestrator before implementation.
`npm test` passes with 399 expected trees, 565 Node checks, and all isolated
mutation checks caught. Generated parser files are current. Hand-matched input
hashes were compared in the following separate reports:

- Fixed application corpus: 467 clean of 467 before and after.
- Upstream Smarty core: 33 clean of 33 before and after; upstream demo: 1 clean
  of 1 before and after.
- Current FBS templates: 186/201 clean before and 194/201 after, with no
  regressions. The eight newly clean files contain 56 explicit spaced
  `elseif_tag` nodes across recognized `if_block` structures. Reports are
  `/tmp/smarty-046-before-fbs.json` and `/tmp/smarty-046-after-fbs.json`.
- Current HDB templates: 470/472 clean before and after, with no regressions.

The fixed and upstream reports are in `/tmp/smarty-046-before-{application,upstream-core,upstream-demo}.json` and their matching `after` paths; FBS/HDB reports are likewise saved as before/after files. The remaining seven FBS errors and two HDB errors are still visible and belong to other syntax gaps, including the separate braced modifier argument in `view_actions/edit_action.tpl`. This task changes no existing expected trees.

The implementation is awaiting re-review for the braced-condition composition
finding. The task is not complete.

## Independent implementation review

The task completion reviewer accepted the implementation after requesting one
medium revision: add the explicitly required braced `{else if ...}` condition
composition as a hand-authored tree and confirm it with the pinned recorder and
full compiler. The added fixture pins the condition as
`elseif_tag.condition: output(value: variable)`. The reviewer verified exact
spelling boundaries, branch ownership, mixed/nested composition, braced
conditions, malformed recovery, full-snapshot incremental edits, corpus hash
matching and the complete test gate. The reviewer reran `npm test` successfully
with 399 expected trees, 565 Node checks and all deliberate mutations caught.
No old expectations changed.
